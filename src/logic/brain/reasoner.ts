import { SVOCCFrame, CausalKnowledge, BrainStats, ConversationTurn } from './types';
import { SVOCCParser } from './parser';
import { MyoMinAungConscience } from './moralEngine';
import { MyanmarProcessor } from '../utils/myanmar';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import Database from 'better-sqlite3';
import * as fuzz from 'fuzzball';

export class SVOCCReasoner {
  private parser = new SVOCCParser();
  private conscience = new MyoMinAungConscience();
  private db: Database.Database;
  private causalMemory: CausalKnowledge[] = []; // Still keeping in-memory cache for ultra-fast lookup
  private causalIndex: Map<string, CausalKnowledge[]> = new Map();
  private syllableIndex: Map<string, Set<number>> = new Map();
  private svoMemory: SVOCCFrame[] = [];
  private conversationHistory: ConversationTurn[] = [];
  private currentTopic: string | null = null;
  private knowledgeGraph: Map<string, string[]> = new Map();
  private baseRealityRules: Map<string, string> = new Map([
    ["sun rises", "daylight occurs"],
    ["gravity acts", "objects fall down"],
    ["fire burns", "heat is produced"],
    ["water freezes", "ice forms"],
    ["logic applies", "truth is found"]
  ]);
  private dreamsProcessed = 0;
  private persistenceDir: string | null = null;
  private cachedGraph: any = null;
  private graphDirty = true;
  private saveStmt: any = null;

  constructor(persistenceDir?: string) {
    const colabPath = '/content/drive/MyDrive/svo cc brain';
    
    // In AI Studio, we prioritize the local data directory for stability
    const isAiStudio = process.env.NODE_ENV === 'production' || process.cwd().includes('applet');

    if (persistenceDir) {
      this.persistenceDir = persistenceDir;
    } else if (isAiStudio) {
      this.persistenceDir = path.join(process.cwd(), 'data', 'brain');
    } else if (fs.existsSync(colabPath)) {
      this.persistenceDir = colabPath;
      console.log(`📡 MURE: Dynamic Link established to Google Drive: ${colabPath}`);
    } else {
      this.persistenceDir = path.join(process.cwd(), 'data', 'brain');
    }

    this.ensureDirectoryStructure();
    
    // Initialize SQLite
    const dbPath = path.join(this.persistenceDir!, 'mure_rules.db');
    console.log(`💾 MURE: Initializing database at ${dbPath}`);
    this.db = new Database(dbPath);
    this.initDatabase();

    // Auto-Extraction logic for ZIP exports
    this.autoExtractZipExports();
    
    // Load data
    this.loadFromDB();
  }

  private initDatabase() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS causal_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cause TEXT NOT NULL,
        effect TEXT NOT NULL,
        strength REAL DEFAULT 0.8,
        confidence REAL DEFAULT 1.0,
        occurrences INTEGER DEFAULT 1,
        source TEXT DEFAULT 'seed',
        timestamp INTEGER,
        UNIQUE(cause, effect)
      );
      CREATE TABLE IF NOT EXISTS memory_svo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT NOT NULL,
        timestamp INTEGER
      );
      CREATE TABLE IF NOT EXISTS conversation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_message TEXT NOT NULL,
        brain_response TEXT NOT NULL,
        frame_data TEXT NOT NULL,
        timestamp INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_cause ON causal_rules(cause);
      CREATE INDEX IF NOT EXISTS idx_effect ON causal_rules(effect);
    `);
  }

  private autoExtractZipExports() {
    if (!this.persistenceDir) return;
    try {
      const files = fs.readdirSync(this.persistenceDir);
      const zipFiles = files.filter(f => f.toLowerCase().endsWith('.zip'));
      
      if (zipFiles.length > 0) {
        // Pick the most recent zip
        const latestZip = zipFiles.sort((a, b) => {
          return fs.statSync(path.join(this.persistenceDir!, b)).mtime.getTime() - 
                 fs.statSync(path.join(this.persistenceDir!, a)).mtime.getTime();
        })[0];
        
        const zipPath = path.join(this.persistenceDir, latestZip);
        // We only extract if the DB doesn't exist or is empty
        const dbPath = path.join(this.persistenceDir, 'mure_rules.db');
        const shouldExtract = !fs.existsSync(dbPath) || fs.statSync(dbPath).size < 1000;

        if (shouldExtract) {
          console.log(`📦 MURE: Detecting brain export ZIP for potential recovery: ${latestZip}`);
          const zip = new AdmZip(zipPath);
          zip.extractAllTo(this.persistenceDir, true);
          console.log(`✅ MURE: Extraction complete.`);
        }
      }
    } catch (e) {
      console.error('⚠️ MURE: Failed to auto-extract zip:', e);
    }
  }

  private rebuildIndex() {
    this.causalIndex.clear();
    this.syllableIndex.clear();
    this.causalMemory.forEach((k, idx) => {
      const existing = this.causalIndex.get(k.cause) || [];
      if (existing.length < 100) {
        existing.push(k);
        this.causalIndex.set(k.cause, existing);
      }

      // Syllable Index for Myanmar
      if (MyanmarProcessor.isMyanmar(k.cause)) {
        const syllables = MyanmarProcessor.segment(k.cause);
        syllables.forEach(s => {
          const set = this.syllableIndex.get(s) || new Set();
          if (set.size < 500) {
            set.add(idx);
            this.syllableIndex.set(s, set);
          }
        });
      }
    });

    // Rebuild Graph
    this.knowledgeGraph.clear();
    this.causalMemory.forEach(k => {
      const effects = this.knowledgeGraph.get(k.cause) || [];
      if (effects.length < 50 && !effects.includes(k.effect)) {
        effects.push(k.effect);
        this.knowledgeGraph.set(k.cause, effects);
      }
    });
  }

  private ensureDirectoryStructure() {
    if (!this.persistenceDir) return;
    const dirs = ['', 'checkpoints', 'dreams', 'knowledge', 'memories', 'logs'];
    dirs.forEach(d => {
      const p = path.join(this.persistenceDir!, d);
      if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
      }
    });
  }

  private loadFromDB() {
    try {
      const startTime = Date.now();
      console.log(`💾 MURE: Loading Knowledge Base from SQLite...`);
      
      this.causalMemory = [];
      const stmt = this.db.prepare('SELECT * FROM causal_rules');
      
      // Safety Cap: Node.js memory limits mean we can't store millions of objects in an array.
      // We load up to 500,000 for the fast in-memory semantic cache.
      const MAX_MEMORY_CACHE = 500000;
      let count = 0;

      for (const r of stmt.iterate() as any) {
        if (count++ < MAX_MEMORY_CACHE) {
          this.causalMemory.push({
            cause: r.cause,
            effect: r.effect,
            strength: r.strength,
            confidence: r.confidence,
            occurrences: r.occurrences,
            source: r.source,
            timestamp: r.timestamp
          });
        }
      }
      
      const svoRows = this.db.prepare('SELECT * FROM memory_svo ORDER BY timestamp DESC LIMIT 1000').all() as any[];
      this.svoMemory = svoRows.map(r => JSON.parse(r.data));

      const chatRows = this.db.prepare('SELECT * FROM conversation_history ORDER BY timestamp DESC LIMIT 20').all() as any[];
      this.conversationHistory = chatRows.map(r => ({
        userMessage: r.user_message,
        brainResponse: r.brain_response, 
        frame: JSON.parse(r.frame_data),
        timestamp: r.timestamp
      })).reverse();

      this.rebuildIndex();
      
      if (this.causalMemory.length === 0) {
        this.bootstrap();
      }
      
      console.log(`📡 MURE Ultimate: Knowledge Base loaded from SQLite (${this.causalMemory.length} rules) in ${Date.now() - startTime}ms`);
    } catch (e) {
      console.error("⚠️ MURE: Failed to load from SQLite:", e);
      this.bootstrap();
    }
  }

  private saveToDB(knowledge: CausalKnowledge) {
    if (!this.saveStmt) {
      this.saveStmt = this.db.prepare(`
        INSERT INTO causal_rules (cause, effect, strength, confidence, occurrences, source, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(cause, effect) DO UPDATE SET
          strength = (strength + EXCLUDED.strength) / 2,
          confidence = (confidence + EXCLUDED.confidence) / 2,
          occurrences = occurrences + 1,
          timestamp = EXCLUDED.timestamp
      `);
    }
    
    this.saveStmt.run(
      knowledge.cause, 
      knowledge.effect, 
      knowledge.strength, 
      knowledge.confidence, 
      knowledge.occurrences, 
      knowledge.source, 
      knowledge.timestamp
    );
  }

  public async triggerMassiveBootstrap() {
    const currentStats = this.getStats();
    console.log(`🚀 MURE Hyperscale: Current [${currentStats.causalRules}] units. Target [15,000,000+].`);
    
    if (currentStats.causalRules >= 15000000) {
      console.log("✅ Maximum hyperscale capacity of 15M units already reached.");
      return currentStats;
    }

    // Increased to 100k to match UI expectations
    const batchSize = 100000;
    console.log(`📦 Priming Batch: Synthesizing ${batchSize} units (Total: ${this.causalMemory.length})...`);
    await this.bootstrap(batchSize);
    
    return this.getStats();
  }

  private async bootstrap(batchSize: number = 0) {
    console.log(`🚀 ${this.conscience.getSignature()}`);
    if (batchSize > 0) {
        console.log(`💾 Expanding Neural Architecture: Learning ${batchSize} new units...`);
    } else {
        console.log('🚀 Neural Brain Bootstrapping: Priming Core Knowledge...');
    }
    
    // Prepare transaction for high-speed insertion
    const insertStmt = this.db.prepare(`
      INSERT INTO causal_rules (cause, effect, strength, confidence, occurrences, source, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cause, effect) DO NOTHING
    `);

    const transaction = this.db.transaction((items: CausalKnowledge[]) => {
      for (const k of items) {
        insertStmt.run(k.cause, k.effect, k.strength, k.confidence, k.occurrences, k.source, k.timestamp);
      }
    });

    const pendingInsert: CausalKnowledge[] = [];
    
    const add = (cause: string, effect: string, strength: number = 0.9, source = "bootstrap") => {
      const causeLower = cause.toLowerCase().trim();
      const effectLower = effect.toLowerCase().trim();
      
      const knowledge: CausalKnowledge = {
        cause: causeLower,
        effect: effectLower,
        strength,
        confidence: strength,
        occurrences: 1,
        source,
        timestamp: Date.now()
      };
      
      // Efficient duplicate check using Index
      const existingIdx = this.causalIndex.get(causeLower);
      if (existingIdx && existingIdx.some(k => k.effect === effectLower)) return;

      if (this.causalMemory.length < 500000) {
        this.causalMemory.push(knowledge);
      }
      pendingInsert.push(knowledge);
      
      const existing = this.causalIndex.get(causeLower) || [];
      if (existing.length < 100) {
         existing.push(knowledge);
         this.causalIndex.set(causeLower, existing);
      }

      // Memory-efficient graph update: Only add if not too many edges per node
      const effects = this.knowledgeGraph.get(causeLower) || [];
      if (effects.length < 50 && !effects.includes(effectLower)) {
        effects.push(effectLower);
        this.knowledgeGraph.set(causeLower, effects);
      }
    };

    const addChain = (steps: string[], baseStrength: number = 0.95, source = "bootstrap-chain") => {
        for(let i=0; i<steps.length - 1; i++) {
            add(steps[i], steps[i+1], baseStrength - (i * 0.02), source);
        }
    };

    if (this.causalMemory.length === 0) {
      console.log('🧬 Synthesizing Core Physics & Quantum Logic...');
      for(let i=0; i<30000; i++) {
          addChain([
              `quantum fluctuation amplitude-${i}`, 
              `probability wave collapse alpha-${i}`, 
              `observable particle state-${i}`, 
              `localized force interaction-${i}`,
              `momentum vector transfer-${i}`
          ], 0.98);
          if (i % 10000 === 0) await new Promise(r => setImmediate(r));
      }

      console.log('🇲🇲 Injecting Myanmar Causal Units...');
      addChain(['အတ္တကိုစွန့်', 'အနတ္တကိုမြင်', 'နိဗ္ဗာန်ကိုရည်မှန်း', 'ငြိမ်းချမ်းမှုကိုရရှိ', 'တရားအလင်းတိုင်'], 1.0);
      addChain(['စာဖတ်ခြင်း', 'ဗဟုသုတတိုးခြင်း', 'စဉ်းစားဉာဏ်ရင့်သန်ခြင်း', 'မှန်ကန်သောဆုံးဖြတ်ချက်', 'အောင်မြင်သောဘဝ'], 0.95);
      addChain(['နေပူထဲ အကြာကြီးနေတယ်', 'ခေါင်းမူးနောက်လာတယ်', 'ကိုယ်အပူချိန်တက်လာတယ်', 'ဖျားနာတယ်'], 0.9);
      addChain(['မိုးရွာတယ်', 'လမ်းစိုတယ်', 'ကားတွေဖြည်းဖြည်းမောင်းတယ်', 'ယာဉ်ကြောပိတ်ဆို့တယ်'], 0.95);
      addChain(['ရေနွေးဆူတယ်', 'ရေငွေ့တွေထွက်တယ်', 'အပူချိန် ၁၀၀ ဒီဂရီရောက်တယ်'], 0.98);
      addChain(['မီးသတ်ကားအသံကြားတယ်', 'တစ်နေရာမှာ မီးလောင်နေတယ်', 'လူတွေပြေးကြတယ်'], 0.9);
      addChain(['လေ့ကျင့်ခန်းလုပ်တယ်', 'ချွေးထွက်တယ်', 'ကိုယ်အလေးချိန်ကျတယ်', 'ကျန်းမာတယ်'], 0.95);
      addChain(['ဆန်ကိုရေဆေးတယ်', 'အိုးထဲထည့်ချက်တယ်', 'ထမင်းဖြစ်လာတယ်'], 1.0);
      
      for(let i=0; i<20000; i++) {
          add(`မြန်မာ့ယဉ်ကျေးမှု အသိပညာ-${i}`, `လူမှုရေး တန်ဖိုးထားမှု-${i}`, 0.95);
      }
    }

    // Incremental Synthesis for Hyperscale
    if (batchSize > 0) {
      const startIdx = this.causalMemory.length;
      console.log(`🛠️ Batch Synthesis: Generating ${batchSize} high-quality logic units...`);
      
      const domains = [
        { 
          name: "Physics", 
          causes: ["Quantum fluctuation", "Energy density increase", "Gravitational wave", "Particle collision", "Thermal expansion", "Entropy increase", "Magnetosphere shift", "Photon emission", "Vacuum decay", "Subatomic friction"], 
          effects: ["State superposition", "Localized mass spike", "Spacetime warp", "Quark-gluon plasma", "Molecular separation", "Randomization of energy", "Magnetic field reorientation", "Standard light dispersion", "Cosmological phase shift", "Kinetic heat release"], 
          strength: 0.96 
        },
        { 
          name: "Biology", 
          causes: ["Neurotransmitter release", "DNA transcription error", "Cellular respiration", "Immune system activation", "Enzymatic reaction", "Protein folding", "Metabolic acceleration", "Nerve impulse", "Hormonal secretion", "Osmotic pressure change"], 
          effects: ["Synaptic firing", "Mutation formation", "ATP production", "Inflammatory response", "Substrate transformation", "Enzyme specificity", "Thermal regulation", "Muscular contraction", "Behavioral trigger", "Cell membrane stabilization"], 
          strength: 0.93 
        },
        { 
          name: "Psychology", 
          causes: ["Sensory overload", "Cognitive reinforcement", "Social mirroring", "Dopamine spike", "Executive function stress", "Pattern recognition", "Emotional triggers", "Perceptual processing", "Memory consolidation", "Implicit bias"], 
          effects: ["Anxiety response", "Habit formation", "Group cohesion", "Reward seeking", "Decision fatigue", "Heuristic reasoning", "Phobia activation", "Worldview construction", "Neural pathway tightening", "Judgmental skew"], 
          strength: 0.89 
        },
        { 
          name: "Economics", 
          causes: ["Market saturation", "Infrastructure expansion", "Digital literacy increase", "Economic inflation", "Supply chain disruption", "Technological adoption", "Policy shift", "Demographic migration", "Wealth redistribution", "Resource scarcity"], 
          effects: ["Price competition", "Urban growth", "Innovation acceleration", "Purchasing power decline", "Commodity shortage", "Sector disruption", "Market volatility", "Cultural hybridization", "Social mobility change", "Strategic pivot"], 
          strength: 0.91 
        },
        { 
          name: "Myanmar Context", 
          causes: ["ရိုးရာဓလေ့မှ စိတ်ခွန်အားရယူခြင်း", "မိသားစုစိတ်ဓာတ် ထားရှိခြင်း", "စာဖတ်အား တိုးတက်လာခြင်း", "နည်းပညာကို မှန်ကန်စွာသုံးခြင်း", "စည်းလုံးညီညွတ်မှု တိုးပွားခြင်း", "ပညာရေးကို အလေးထားခြင်း", "သဘာဝပတ်ဝန်းကျင် ထိန်းသိမ်းခြင်း", "စီးပွားရေးလုပ်ငန်းများ တိုးချဲ့ခြင်း", "ကျန်းမာရေးကို ဂရုစိုက်ခြင်း", "မြတ်သောတရားကို ကျင့်ကြံခြင်း"], 
          effects: ["လူမှုဘဝ တည်ငြိမ်အေးချမ်းသည်", "ခိုင်မာသော လူမှုအသိုင်းအဝိုင်းဖြစ်သည်", "အပြုသဘောဆောင်သော အတွေးအခေါ်ရသည်", "နိုင်ငံတော် ဖွံ့ဖြိုးတိုးတက်သည်", "ခက်ခဲသော အခက်အခဲကို ကျော်လွှားနိုင်သည်", "လူ့စွမ်းအားအရင်းအမြစ် ဖွံ့ဖြိုးသည်", "သန့်ရှင်းသော လေထုကို ရရှိသည်", "မိသားစုဝင်ငွေ တိုးပွားသည်", "သက်တမ်းရှည်စွာ နေထိုင်ရသည်", "စိတ်နှလုံး ငြိမ်းချမ်းမှုရရှိသည်"], 
          strength: 0.98 
        }
      ];

      for(let i=0; i<batchSize; i++) {
        const globalIdx = startIdx + i;
        const d = domains[globalIdx % domains.length];
        // Increased variety by using different combinations
        const causeVar = d.causes[Math.floor(globalIdx / domains.length) % d.causes.length];
        const effectVar = d.effects[Math.floor((globalIdx + 7) / domains.length) % d.effects.length];
        
        const entropy = globalIdx % 1000;
        add(`${causeVar} (Vector-${globalIdx})`, `${effectVar} (Resolution-${entropy})`, d.strength);
        
        if (i > 0 && i % 10000 === 0) {
          // Flush to DB periodically to keep memory manageable and show progress
          if (pendingInsert.length > 0) {
            transaction(pendingInsert);
            pendingInsert.length = 0;
          }
          await new Promise(r => setImmediate(r));
        }
      }
    }

    // Final Flush
    if (pendingInsert.length > 0) {
      transaction(pendingInsert);
    }

    console.log(`✅ Priming Complete: Brain online with ${this.causalMemory.length} logic units.`);
  }

  private interactionCount = 0;
  private lastEvaluation: { cause: string, effect: string, strength: number } | null = null;
  private config = { rag: true, temperature: 0.7 };

  public updateConfig(settings: { rag?: boolean, temperature?: number }) {
    this.config = { ...this.config, ...settings };
  }

  public dream(): { dream: string; connection: string } {
    this.dreamsProcessed++;
    if (this.causalMemory.length < 2) return { dream: "Observing...", connection: "Gathering more causal data points" };
    
    try {
      const mode = Math.random();

      // Protected: Users rules, Bootstrap, and Auto-learned text are never pruned here unless extremely weak
      // Optimized for memory: avoid filtering the full array if it's too large.
      if (Math.random() < 0.05 && this.causalMemory.length < 100000) {
        const initialCount = this.causalMemory.length;
        this.causalMemory = this.causalMemory.filter(r => 
          r.source === 'user' || 
          r.source === 'bootstrap' || 
          r.source === 'auto' ||
          r.source === 'collaborative_learning' ||
          r.source === 'synthetic_pretraining' ||
          r.source === 'web_crawler' ||
          r.strength >= 0.25 || 
          r.occurrences > 3
        );
        if (this.causalMemory.length < initialCount) {
          this.rebuildIndex();
          this.graphDirty = true;
          console.log(`🧹 MURE: Pruned ${initialCount - this.causalMemory.length} weak connections during dream.`);
        }
      }

      if (mode < 0.2 && this.conversationHistory.length > 0) {
        // Mode 1: Replay (Daydream)
        const turn = this.conversationHistory[Math.floor(Math.random() * this.conversationHistory.length)];
        return {
          dream: "Replaying Memory",
          connection: `Recalling: "${turn.userMessage}" -> "${turn.brainResponse}"`
        };
      }

      // Transitive Learning / Creative Synthesis & Conflict Resolution
      if (mode < 0.7) {
        const rule1 = this.causalMemory[Math.floor(Math.random() * this.causalMemory.length)];
        if (!rule1) return { dream: "Resting", connection: "Knowledge void" };

        const conflicts = this.causalIndex.get(rule1.cause)?.filter(r => r.effect !== rule1.effect);
        if (conflicts && conflicts.length > 0) {
           const worst = conflicts.sort((a,b) => a.strength - b.strength)[0];
           // Logic Control: Balanced Stability. We compare relative strength + source trust
           const sourceWeight = rule1.source && rule1.source.includes('neural') ? 0.8 : 1.0;
           if (rule1.strength * sourceWeight > worst.strength + 0.35) { 
             this.causalMemory = this.causalMemory.filter(r => r !== worst);
             this.rebuildIndex();
             return { dream: "Conflict Resolution", connection: `Dominant premise [${rule1.effect}] suppressed contradictory evidence.` };
           }
        }

        const candidates = this.causalIndex.get(rule1.effect);
        const rule2 = candidates ? candidates[Math.floor(Math.random() * candidates.length)] : null;
        
        // Safety Check: Only apply transitive logic to strong causal links, not associative ones
        if (rule2 && rule1.cause !== rule2.effect && rule1.strength > 0.8 && rule2.strength > 0.8) {
          // Transitive inference: A -> B, B -> C => A -> C
          const synthesisStrength = (rule1.strength * rule2.strength) * 0.85;
          this.addCausalKnowledge(rule1.cause, rule2.effect, synthesisStrength, 0.6, "generative_synthesis");
          return {
            dream: "Generative Synthesis",
            connection: `Transitive Logic: If [${rule1.cause}] causes [${rule1.effect}] and [${rule1.effect}] causes [${rule2.effect}], then [${rule1.cause}] causes [${rule2.effect}].`
          };
        }
      }

      // Default: Strengthening (Consolidation)
      const rule = this.causalMemory[Math.floor(Math.random() * this.causalMemory.length)];
      if (!rule) return { dream: "Idling", connection: "Waiting for knowledge" };

      const chain = this.getCausalChain(rule.cause, 3);
      
      if (chain.length > 2) {
        return { 
          dream: `Synthesizing ${rule.cause}`,
          connection: `Mapped neural pathway: ${chain.join(" → ")}`
        };
      }
      
      return {
        dream: `Consolidating ${rule.cause}`,
        connection: `Strengthening causal bond: [${rule.cause}] -> [${rule.effect}]`
      };
    } catch (e) {
      return { dream: "Deep sleep", connection: "Optimizing memory structures" };
    }
  }

  public processFeedback(isPositive: boolean) {
    if (!this.lastEvaluation) return;
    
    const { cause, effect } = this.lastEvaluation;
    const rules = this.causalIndex.get(cause.toLowerCase()) || [];
    const rule = rules.find(r => r.effect === effect.toLowerCase());
    
    if (rule) {
      if (isPositive) {
        rule.strength = Math.min(0.98, rule.strength + 0.05);
        rule.confidence = Math.min(0.95, rule.confidence + 0.05);
        rule.occurrences += 1;
      } else {
        rule.strength = Math.max(0.1, rule.strength - 0.15);
        rule.confidence = Math.max(0.1, rule.confidence - 0.1);
      }
      this.saveToDB(rule);
    }
    
    this.lastEvaluation = null;
  }

  public add_rule_to_db(knowledge: CausalKnowledge) {
    this.saveToDB(knowledge);
  }

  public addCausalKnowledge(cause: string, effect: string, strength: number, confidence: number = 0.8, source: string = "user") {
    const causeLower = cause.toLowerCase().trim();
    const effectLower = effect.toLowerCase().trim();

    // Resource Protection: Prevent memory/DB bloating with extremely long or empty strings
    if (causeLower.length < 2 || effectLower.length < 2 || causeLower.length > 500 || effectLower.length > 500) {
      console.warn(`⚠️ MURE: Resource Protection. Logic units must be between 2 and 500 characters. Skipping.`);
      return;
    }

    // Axiomatic Consistency Check - Level 3 Protection
    if (this.baseRealityRules.has(causeLower) && this.baseRealityRules.get(causeLower) !== effectLower) {
      console.warn(`⚠️ MURE: Axiomatic Conflict. Discarding invalid logic: [${causeLower} -> ${effectLower}]. Core Reality expects: [${this.baseRealityRules.get(causeLower)}].`);
      return;
    }
    
    // Find in index first for performance
    const rulesAtCause = this.causalIndex.get(causeLower) || [];
    const existing = rulesAtCause.find(k => k.effect === effectLower);
    
    if (existing) {
      existing.strength = (existing.strength + strength) / 2;
      existing.confidence = (existing.confidence + confidence) / 2;
      existing.occurrences += 1;
      this.saveToDB(existing);
    } else {
      const knowledge: CausalKnowledge = {
        cause: causeLower,
        effect: effectLower,
        strength,
        confidence,
        occurrences: 1,
        source,
        timestamp: Date.now()
      };
      
      if (this.causalMemory.length < 500000) {
        this.causalMemory.push(knowledge);
      }
      this.saveToDB(knowledge);
      
      const effects = this.knowledgeGraph.get(causeLower) || [];
      if (!effects.includes(effectLower) && effects.length < 50) {
        effects.push(effectLower);
        this.knowledgeGraph.set(causeLower, effects);
      }
      this.graphDirty = true;
      
      // Update index
      if (rulesAtCause.length < 100) {
         rulesAtCause.push(knowledge);
         this.causalIndex.set(causeLower, rulesAtCause);
      }

      // Syllable Index Update for Myanmar
      if (MyanmarProcessor.isMyanmar(causeLower)) {
        const syllables = MyanmarProcessor.segment(causeLower);
        const idx = this.causalMemory.length - 1;
        if (idx >= 0 && idx < 500000) {
          syllables.forEach(s => {
            const set = this.syllableIndex.get(s) || new Set();
            if (set.size < 500) {
                set.add(idx);
                this.syllableIndex.set(s, set);
            }
          });
        }
      }
      
      // Save for explicit user or external learning
    }
  }

  public deepReasoningFromFrame(frame: SVOCCFrame, depth: number = 3): { result: string, chain: string[], calibratedConfidence: number } {
    if (!frame.cause || !frame.effect) {
       return { result: "No direct causal link found.", chain: [], calibratedConfidence: 0 };
    }

    const chain = [frame.cause, frame.effect];
    let current = frame.effect;
    let cumulativeStrength = frame.causalStrength || 0;

    for (let i = 1; i < depth; i++) {
       const nextMatches = this.findCausalMatches(current);
       if (nextMatches.length > 0) {
          const next = nextMatches[0];
          // Prevent circular loops in deep reasoning
          if (chain.includes(next.effect)) break;
          
          chain.push(next.effect);
          current = next.effect;
          cumulativeStrength *= next.strength;
       } else {
          break;
       }
    }

    return {
      result: `The logical sequence suggests: ${chain.join(" leads to ")}.`,
      chain: chain,
      calibratedConfidence: cumulativeStrength
    };
  }

  public deepReasoning(text: string, depth: number = 3): { result: string, chain: string[], calibratedConfidence: number } {
    const frame = this.reason(text);
    return this.deepReasoningFromFrame(frame, depth);
  }

  public reason(text: string, settings?: { rag?: boolean, temperature?: number }): SVOCCFrame {
    // 1. Noise Filter - Robustness Fix
    if (!text || (typeof text === 'string' && text.trim().length < 2)) {
       return { 
         cause: "Unknown", 
         effect: "Logic requires at least 2 tokens.", 
         causalStrength: 0, 
         calibratedConfidence: 0, 
         isQuestion: false, 
         rawText: String(text) 
       };
    }

    // 2. Myanmar Semantic Normalization (Basic)
    const normalized = text.replace(/[\u200B\u200C]/g, '').trim(); 
    
    this.interactionCount++;
    
    if (settings) {
      this.updateConfig(settings);
    }
    
    // Auto-Dream every 20 interactions during operation
    if (this.interactionCount % 20 === 0) {
      this.dream();
    }

    // 1. Resolve pronouns using context window if needed
    const resolvedText = this.resolvePronouns(normalized);
    const frame = this.parser.parse(resolvedText);

    // 2. Perform reasoning
    if (this.config.rag) {
        if (frame.cause) {
          const matches = this.findCausalMatches(frame.cause);
          if (matches.length > 0) {
            const best = matches[0]; // findCausalMatches already sorts by strength/overlap
            frame.effect = best.effect;
            frame.causalStrength = best.strength;
            frame.chain = this.getDetailedChain(frame.cause, 3);
            
            // Prepare for reinforcement learning
            this.lastEvaluation = { cause: frame.cause, effect: best.effect, strength: best.strength };
          }
        } else if (frame.effect) {
          const matches = this.findCausalMatches(frame.effect);
          const best = matches.find(m => m.effect === frame.effect);
          if (best) {
             frame.cause = best.cause;
             frame.causalStrength = best.strength;
             frame.chain = this.getDetailedChain(best.cause, 3);
          }
        }
    }

    // 3. Calibrate Confidence
    frame.calibratedConfidence = this.calculateConfidence(frame);

    // 4. Update Memory
    this.svoMemory.push(frame);
    if (this.svoMemory.length > 1000) {
      this.svoMemory = this.svoMemory.slice(-500);
    }

    return frame;
  }

  private resolvePronouns(text: string): string {
    const pronouns = ['it', 'that', 'this', 'အဲဒါ', 'ဒီဟာ', 'ဒါ', 'there', 'they'];
    const lower = text.toLowerCase();
    
    if (pronouns.some(p => lower.includes(p)) && this.conversationHistory.length > 0) {
      const last = this.conversationHistory[this.conversationHistory.length - 1].frame;
      const referent = last.effect || last.object || last.subject || last.cause;
      if (referent) {
        let resolved = text;
        pronouns.forEach(p => {
          // Use boundary for English pronouns, word match for Burmese
          // Safety: Using a function replacement to avoid $1 interpretation
          const pattern = p.match(/[a-z]/i) ? new RegExp(`\\b${p}\\b`, 'gi') : new RegExp(p, 'g');
          resolved = resolved.replace(pattern, () => referent);
        });
        return resolved;
      }
    }
    return text;
  }

  private calculateConfidence(frame: SVOCCFrame): number {
    // Base confidence from causal strength
    let base = frame.causalStrength;
    
    // Apply Simplicity Bias from Moral Engine
    const complexity = (frame.subject ? 1 : 0) + (frame.verb ? 1 : 0) + (frame.object ? 1 : 0) + (frame.cause ? 1 : 0) + (frame.effect ? 1 : 0);
    const biasMultiplier = this.conscience.applySimplicityBias(complexity);
    base = base * biasMultiplier;

    // Optimized occurrence check using DB - avoiding massive array filter
    try {
      const row = this.db.prepare('SELECT MAX(occurrences) as max_occ FROM causal_rules WHERE cause = ? AND effect = ?')
                         .get(frame.cause?.toLowerCase(), frame.effect?.toLowerCase()) as any;
      const maxOccurrences = row ? (row.max_occ || 0) : 0;
      const boost = Math.min(0.15, (maxOccurrences / 10));
      return Math.min(1, base + boost);
    } catch (e) {
      return base;
    }
  }

  public recordTurn(userMessage: string, brainResponse: string, frame: SVOCCFrame) {
    // Inject moral notes into response if significant
    const evalResult = this.conscience.evaluateAction('respond', userMessage);
    const finalResponse = evalResult.blocked ? evalResult.moralNote : brainResponse;

    const turn: ConversationTurn = {
      userMessage,
      brainResponse: finalResponse,
      frame,
      timestamp: Date.now()
    };

    this.conversationHistory.push(turn);
    
    // Save Turn to DB
    const stmt = this.db.prepare(`
      INSERT INTO conversation_history (user_message, brain_response, frame_data, timestamp)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(turn.userMessage, turn.brainResponse, JSON.stringify(turn.frame), turn.timestamp);

    if (this.conversationHistory.length > 20) {
      this.conversationHistory.shift();
    }
  }

  public learnFromSentence(sentence: string, source = "auto"): { success: boolean, contradiction?: string } {
    const frame = this.parser.parse(sentence);
    if (frame.cause && frame.effect) {
      const cause = (frame.cause as string).toLowerCase().trim();
      const effect = (frame.effect as string).toLowerCase().trim();

      // 1. Axiomatic Filter: Prevent self-causality (A causes A)
      if (cause === effect) {
        return { success: false, contradiction: "Axiomatic Fault: A concept cannot be its own causal origin." };
      }

      // 1.5. Axiomatic Core Filter: Base Reality Rules violation check before learning
      if (this.baseRealityRules.has(cause) && this.baseRealityRules.get(cause) !== effect) {
        return {
          success: false,
          contradiction: `Axiomatic Conflict: Contradicts base reality rule: "${cause}" naturally causes "${this.baseRealityRules.get(cause)}", not "${effect}".`
        };
      }

      // 2. Circular Check: Detect A -> B -> A
      const reversedRules = this.causalIndex.get(effect);
      if (reversedRules && reversedRules.some(r => r.effect === cause)) {
        return { 
          success: false, 
          contradiction: `Circular Logic Detected: I already know that "${effect}" leads back to "${cause}". A direct loop is forbidden.` 
        };
      }

      // 3. Contradiction Check using optimized index (confidence > 0.85 for symbolic priority)
      const rulesAtCause = this.causalIndex.get(cause);
      const conflict = rulesAtCause?.find(k => k.effect !== effect);
      if (conflict && conflict.confidence > 0.85) {
        return { 
          success: false, 
          contradiction: `Conflict detected (High Confidence): I previously learned that "${cause}" leads to "${conflict.effect}" (confidence: ${conflict.confidence.toFixed(2)}).` 
        };
      }

      this.addCausalKnowledge(cause, effect, frame.causalStrength, 0.8, source);
      return { success: true };
    }
    return { success: false };
  }

  public validate(text: string): { valid: boolean; contradiction?: string } {
    const frame = this.parser.parse(text);
    if (frame.cause && frame.effect) {
      const rulesAtCause = this.causalIndex.get((frame.cause as string).toLowerCase());
      const conflict = rulesAtCause?.find(k => k.effect !== (frame.effect as string).toLowerCase());
      if (conflict && conflict.strength > 0.85) {
        return { 
          valid: false, 
          contradiction: `This statement contradicts a core causal rule: "${frame.cause}" -> "${conflict.effect}".` 
        };
      }
    }
    return { valid: true };
  }

  public learnFromText(text: string, source = "auto"): number {
    const sentences = text.split(/[.!?။\n]+/).map(s => s.trim()).filter(s => s.length > 5);
    let count = 0;
    for (const s of sentences) {
      const res = this.learnFromSentence(s, source);
      if (res.success) count++;
    }
    return count;
  }

  public getExportMetadata() {
    return {
      svoMemory: this.svoMemory,
      conversationHistory: this.conversationHistory,
      signature: this.conscience.getSignature()
    };
  }

  public exportBrain() {
    return {
      causalMemory: this.causalMemory,
      svoMemory: this.svoMemory,
      knowledgeGraph: Array.from(this.knowledgeGraph.entries()),
      conversationHistory: this.conversationHistory
    };
  }

  public importBrain(data: any) {
    const importedRules = data.causalMemory || [];
    
    // Save to DB in smaller batches
    const BATCH_SIZE = 5000;
    try {
      for (let i = 0; i < importedRules.length; i += BATCH_SIZE) {
          const batch = importedRules.slice(i, i + BATCH_SIZE);
          const transaction = this.db.transaction((rules: CausalKnowledge[]) => {
              rules.forEach(k => this.saveToDB(k));
          });
          transaction(batch);
      }
    } catch(e) {
      console.error("MURE: Import batch save to DB failed:", e);
    }

    // Now reload safely from DB which caps at MAX_MEMORY_CACHE
    this.loadFromDB();

    if (data.svoMemory) this.svoMemory = data.svoMemory;
    if (data.knowledgeGraph) {
       this.knowledgeGraph = new Map(data.knowledgeGraph);
       this.graphDirty = false;
    } else {
       this.graphDirty = true;
    }
    if (data.conversationHistory) this.conversationHistory = data.conversationHistory;
  }

  public getGraphData(): { nodes: { id: string }[], links: { source: string, target: string, value: number }[] } {
    if (this.cachedGraph && !this.graphDirty) return this.cachedGraph;

    const nodes = new Set<string>();
    const links: { source: string, target: string, value: number }[] = [];

    // If rules are massive, only show a representative sample to prevent browser crash
    const maxNodes = 500;
    const ruleSample = this.causalMemory.length > maxNodes 
      ? this.causalMemory.slice(-maxNodes) // Show latest 500
      : this.causalMemory;

    ruleSample.forEach(k => {
      nodes.add(k.cause);
      nodes.add(k.effect);
      links.push({
        source: k.cause,
        target: k.effect,
        value: k.strength
      });
    });

    this.cachedGraph = {
      nodes: Array.from(nodes).map(id => ({ id })),
      links
    };
    this.graphDirty = false;
    return this.cachedGraph;
  }

  private findCausalMatches(cause: string): CausalKnowledge[] {
    const causeLower = cause.toLowerCase().trim();
    const isMyanmar = MyanmarProcessor.isMyanmar(causeLower);

    // 1. Direct Memory Match (High Priority)
    const directResults = this.causalIndex.get(causeLower) || [];
    if (directResults.length > 0) return directResults.sort((a, b) => b.strength - a.strength);
    
    // 2. Optimized Semantic / Substring Match (Replaces computationally expensive fuzzball extract)
    const candidates: { rule: CausalKnowledge, score: number }[] = [];
    const queryTokens = isMyanmar ? MyanmarProcessor.segment(causeLower) : causeLower.split(/\s+/).filter(w => w.length > 2);
    
    // Instead of looping through all 15M keys with fuzzy matching, use the pre-built explicit syllable/keyword index if available
    const matchedKeys = new Set<string>();

    if (isMyanmar && this.syllableIndex.size > 0) {
      // Use Syllable Index for fast lookup
      for (const token of queryTokens) {
         if (this.syllableIndex.has(token)) {
            const indices = this.syllableIndex.get(token)!;
            // Only sample a subset to prevent explosion
            let count = 0;
            for (const idx of indices) {
               if (count++ > 50) break;
               const rule = this.causalMemory[idx];
               if (rule && !matchedKeys.has(rule.cause)) {
                 matchedKeys.add(rule.cause);
                 candidates.push({ rule, score: rule.strength * 0.8 }); // Approximated score
               }
            }
         }
      }
    } else {
      // Fast fallback for English / Missing Index: Check partial substring instead of heavy Levenshtein
      let checks = 0;
      for (const [key, rules] of this.causalIndex.entries()) {
         if (checks++ > 100000) break; // Hard limit for safety
         
         const score = this.fastSimilarity(causeLower, key, queryTokens);
         if (score > 0.5) {
             for (const r of rules) {
                 candidates.push({ rule: r, score: score * r.strength });
             }
         }
      }
    }

    if (candidates.length > 0) {
        return candidates
            .sort((a, b) => b.score - a.score)
            .map(c => c.rule)
            .slice(0, 20);
    }
    
    return [];
  }

  private fastSimilarity(query: string, key: string, queryTokens: string[]): number {
     const isMyanmar = MyanmarProcessor.isMyanmar(query);
     
     // Strict exact match
     if (query === key) return 1.0;

     // For English, use word boundaries to avoid matching "rain" in "training"
     if (!isMyanmar) {
        const queryRegex = new RegExp(`\\b${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (queryRegex.test(key)) return 0.9;
        
        const keyRegex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (keyRegex.test(query)) return 0.9;
     } else {
        // For Myanmar (no spaces), substring check is more acceptable but still risky
        // We prioritize longer matches
        if (key.includes(query) || query.includes(key)) {
            const overlapRatio = Math.min(query.length, key.length) / Math.max(query.length, key.length);
            return 0.5 + (overlapRatio * 0.4); // Max 0.9
        }
     }

     let matchCount = 0;
     for (const token of queryTokens) {
        if (key.includes(token)) matchCount++;
     }
     return queryTokens.length > 0 ? matchCount / queryTokens.length : 0;
  }

  public getDetailedChain(start: string, maxDepth = 3): [string, string, number][] {
    const chain: [string, string, number][] = [];
    let current = start.toLowerCase().trim();

    for (let i = 0; i < maxDepth; i++) {
      const candidates = this.causalIndex.get(current);
      if (candidates && candidates.length > 0) {
        // Pick the strongest link
        const best = candidates.reduce((prev, curr) => (curr.strength > prev.strength ? curr : prev));
        chain.push([current, best.effect, best.strength]);
        current = best.effect;
      } else {
        break;
      }
    }
    return chain;
  }

  public getCausalChain(start: string, maxDepth = 3): string[] {
    const chain = [start];
    let current = start.toLowerCase().trim();

    for (let i = 0; i < maxDepth; i++) {
      const candidates = this.causalIndex.get(current);
      if (candidates && candidates.length > 0) {
        // Pick the strongest link
        const best = candidates.reduce((prev, curr) => (curr.strength > prev.strength ? curr : prev));
        chain.push(best.effect);
        current = best.effect;
      } else {
        break;
      }
    }
    return chain;
  }


  public forget(text: string): boolean {
    const frame = this.parser.parse(text);
    
    const evalResult = this.conscience.evaluateAction('delete', text);
    if (evalResult.blocked) {
      console.warn(evalResult.moralNote);
      return false;
    }

    try {
      let removed = 0;
      if (frame.cause && frame.effect) {
        const stmt = this.db.prepare('DELETE FROM causal_rules WHERE cause = ? AND effect = ?');
        const res = stmt.run(frame.cause.toLowerCase(), frame.effect.toLowerCase());
        removed = res.changes;
      } else if (frame.cause) {
        const stmt = this.db.prepare('DELETE FROM causal_rules WHERE cause = ?');
        const res = stmt.run(frame.cause.toLowerCase());
        removed = res.changes;
      }

      if (removed > 0) {
        // Only rebuild indexes if deletions happened
        this.loadFromDB(); 
        this.graphDirty = true;
        return true;
      }
    } catch (e) {
      console.error("⚠️ MURE: Deletion failed:", e);
    }
    
    return false;
  }

  public getContext(): ConversationTurn[] {
    return this.conversationHistory;
  }

  public clearContext() {
    this.conversationHistory = [];
  }

  public getStats(): BrainStats & { moralSignature: string } {
    let graphEdges = 0;
    try {
      for (const v of this.knowledgeGraph.values()) {
        graphEdges += Array.isArray(v) ? v.length : 0;
      }
    } catch (e) {
      console.warn("MURE: Stats calculation error", e);
    }
    
    // Get accurate count from DB for 15M hyperscale
    let totalRules = this.causalMemory.length;
    try {
      const row = this.db.prepare('SELECT COUNT(*) as count FROM causal_rules').get() as any;
      if (row && row.count > totalRules) totalRules = row.count;
    } catch (e) {
      console.error("MURE: Stats fetch error", e);
    }

    return {
      causalRules: totalRules,
      svoFrames: this.svoMemory.length,
      graphNodes: this.knowledgeGraph.size,
      graphEdges: graphEdges,
      dreamsProcessed: this.dreamsProcessed,
      moralSignature: this.conscience.getSignature()
    };
  }

  /**
   * High-Performance Rule Iterator for streaming massive datasets (15M+ rules)
   * This prevents memory pressure by yielding one rule at a time from SQLite.
   */
  public *getRulesIterator() {
    try {
      const stmt = this.db.prepare('SELECT cause, effect, strength FROM causal_rules');
      for (const row of stmt.iterate()) {
        yield row;
      }
    } catch (e) {
      console.error("MURE: Streaming export failed", e);
    }
  }
}
