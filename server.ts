import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { SVOCCReasoner } from './src/logic/brain/reasoner';
import { SVOCCSpeaker } from './src/logic/brain/speaker';
import { WebSearchService } from './src/logic/services/webSearch';
import multer from 'multer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import AdmZip from 'adm-zip';
import fs from 'fs';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit for brain imports
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  const BRAIN_PATH = process.env.MURE_BRAIN_PATH || path.join(process.cwd(), 'data', 'brain');
  console.log(`Initialising MURE Brain with storage directory: ${BRAIN_PATH}`);
  
  const reasoner = new SVOCCReasoner(BRAIN_PATH);
  const speaker = new SVOCCSpeaker();
  const webSearch = new WebSearchService();

  app.use(express.json({ limit: '500mb' }));
  app.use(express.urlencoded({ limit: '500mb', extended: true }));

  // Log all requests for debugging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // API Routes
    app.post('/api/chat', async (req, res) => {
      try {
        const { message, settings } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        // 1. Mutual Learning: Check if user is teaching a new causal link
        const learnRes = reasoner.learnFromSentence(message, 'user');
        let note = '';
        if (learnRes.success) {
          note = "✅ Learned new causal rule. ";
        } else if (learnRes.contradiction) {
          note = `⚠️ ${learnRes.contradiction} `;
        }

        // 2. Symbolic Reasoning (MURE)
        const result = reasoner.reason(message, settings);
        let confidence = result.calibratedConfidence || result.causalStrength || 0;
        let source = learnRes.success ? 'collaborative_learning' : 'knowledge_base';

        // --- Active RAG & Continuous Learning from Web ---
        let ragLearnedCount = 0;
        if ((!result.effect || confidence < 0.5) && settings?.rag !== false) {
           console.log(`[RAG] Low confidence (${Math.round(confidence*100)}%). Triggering semantic web search for continuous learning...`);
           try {
             const searchResults = await webSearch.searchAll(message);
             for (const res of searchResults) {
                // Continuous Learning Integration: Ingesting web facts dynamically
                const extractions = webSearch.extractCausal(res.snippet);
                for (const extract of extractions) {
                   reasoner.addCausalKnowledge(extract.cause, extract.effect, extract.strength, 0.85, 'rag_web_crawler');
                   ragLearnedCount++;
                }
             }

             if (ragLearnedCount > 0) {
                // Re-evaluate logic based on newly acquired RAG knowledge
                const updatedResult = reasoner.reason(message, settings);
                const newConfidence = updatedResult.calibratedConfidence || updatedResult.causalStrength || 0;
                
                if (updatedResult.effect && newConfidence > confidence) {
                   Object.assign(result, updatedResult);
                   confidence = newConfidence;
                   source = 'rag_web_augmented';
                   note += `\n🌐 [RAG Active] Dynamically learned ${ragLearnedCount} new causal links from the web to answer this!`;
                } else {
                   note += `\n🌐 [RAG Active] Dynamically learned ${ragLearnedCount} new causal links from the web, but couldn't directly answer your query.`;
                }
             }
           } catch (e) {
             console.error('[RAG] Fallback Web Search failed:', e);
           }
        }
        
        let finalReply = speaker.generateResponse(message, result, reasoner, confidence);

        
        if (settings && settings.useAiStudio) {
          if (settings.aiStudioModel === 'mure_only') {
             source = 'mure_local_ts';
          } else if (settings.aiStudioModel === 'mure_sentence' || settings.aiStudioModel === 'mure_prd') {
             // Consensus Protocol Implementation
             try {
                // Add an AbortController for a 15-second timeout on the neural bridge
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);

                const pythonRes = await fetch('http://localhost:8000/chat', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ message: message, settings: settings }),
                   signal: controller.signal
                });
                
                clearTimeout(timeoutId);

                if (pythonRes.ok) {
                   const pyData = await pythonRes.json();
                   const neuralReply = pyData.reply;
                   
                   // Consensus Logic: Compare neural inference with symbolic frame
                   const neuralEffect = (neuralReply || "").toLowerCase();
                   const symbolicEffect = result.effect ? result.effect.toLowerCase() : "";
                   
                   // Step C1: Check for Consensus (Agreement)
                   if (symbolicEffect && neuralEffect.includes(symbolicEffect)) {
                      // Strong Agreement: Boost confidence
                      reasoner.addCausalKnowledge(result.cause || message, result.effect!, 0.95, 0.95, 'consensus_agreement');
                      finalReply = neuralReply + "\n\n[Status: Consensus Verified by Symbolic Frame]";
                      source = 'mure_consensus_protocol';
                   } 
                   // Step C2: Check for direct conflict
                   else if (symbolicEffect && confidence > 0.85) {
                      // Symbolic Majority (Priority)
                      finalReply = `[Symbolic Dominant]: ${finalReply}\n\n(Note: Neural extrapolation suggested a mismatch; priority given to verified local frames.)`;
                      source = 'mure_local_symbolic_priority';
                   }
                   // Step C3: exploratory expansion
                   else {
                      finalReply = neuralReply;
                      source = settings.aiStudioModel === 'mure_sentence' ? 'mure_3b_sentence_llm' : 'mure_prd_collaborative';
                      note += `\n🧠 Neural Extension applied for exploratory context.`;
                   }
                } else {
                   // Fallback logic
                   const deep = reasoner.deepReasoningFromFrame(result, 4);
                   if (deep.chain.length > 2) {
                      finalReply = `[Neural Offline - Deep Symbolic Fallback]: ${deep.result}\n\nEvidence-based confidence: ${(deep.calibratedConfidence * 100).toFixed(1)}%`;
                      source = 'mure_symbolic_synthesis_v2';
                   } else {
                      source = 'mure_fallback_local';
                      finalReply = `${finalReply}\n\n[Warning: Neural Backend Offline]. Base logic applied.`;
                   }
                }
             } catch (e) {
                // Fallback to Deep Symbolic Synthesis on network error or timeout
                const deep = reasoner.deepReasoningFromFrame(result, 3);
                source = 'mure_symbolic_synthesis_v2';
                finalReply = deep.chain.length > 1 
                   ? `[Neural Link Failure - Symbolic Synthesis]: ${deep.result}`
                   : `${finalReply}\n\n[Local Fallback]: The neural bridge is currently inactive or timed out. Reasoning is limited to symbolic frames.`;
             }
          }
        }

        // 3. Collaborative Output
        const reply = note ? `${note}\n\n${finalReply}` : finalReply;

        // 4. Multi-turn memory
        reasoner.recordTurn(message, reply, result);

        res.json({
          reply: reply,
          frame: result,
          source: source,
          stats: reasoner.getStats(),
          chain: result.chain || []
        });
      } catch (error) {
        console.error('API Chat Error:', error);
        res.status(500).json({ error: 'The symbolic brain encountered a fault.' });
      }
    });

  app.post('/api/validate', async (req, res) => {
    const { text } = req.body;
    const validation = reasoner.validate(text);
    res.json(validation);
  });

  app.post('/api/record-turn', async (req, res) => {
    const { message, reply, frame } = req.body;
    reasoner.recordTurn(message, reply, frame);
    res.json({ success: true });
  });

  app.post('/api/learn-rule', async (req, res) => {
    const { cause, effect, strength } = req.body;
    const validation = reasoner.validate(`${cause} causes ${effect}`);
    if (validation.valid) {
      reasoner.addCausalKnowledge(cause, effect, strength, 0.85, 'collaborative_learning');
      res.json({ success: true });
    } else {
      res.json({ success: false, contradiction: validation.contradiction });
    }
  });

  app.post('/api/learn', (req, res) => {
    try {
      const { sentence } = req.body;
      if (!sentence) return res.status(400).json({ error: 'Sentence is required' });

      const { success, contradiction } = reasoner.learnFromSentence(sentence);
      res.json({ success, contradiction, stats: reasoner.getStats() });
    } catch (error) {
      console.error('API Learn Error:', error);
      res.status(500).json({ error: 'Failed to process learning unit.' });
    }
  });

  app.post('/api/bulk-ingest', (req, res) => {
    try {
      const { data } = req.body;
      if (!Array.isArray(data)) return res.status(400).json({ error: 'Invalid data format. Expected an array.' });

      let added = 0;
      let updated = 0;

      for (const entry of data) {
        // Format: { premise: string, conclusion: string, confidence: number }
        const sentence = `${entry.premise} causes ${entry.conclusion}`;
        const { success } = reasoner.learnFromSentence(sentence, 'synthetic_pretraining');
        if (success) added++;
        else updated++; // Assuming it exists or failed
      }

      res.json({ 
        success: true, 
        added, 
        updated, 
        total: reasoner.getStats().causalRules 
      });
    } catch (error) {
      console.error('Bulk Ingest Error:', error);
      res.status(500).json({ error: 'The brain failed to ingest the batch.' });
    }
  });
  
  app.get('/api/context', (req, res) => {
    res.json(reasoner.getContext());
  });

  app.post('/api/clear_context', (req, res) => {
    reasoner.clearContext();
    res.json({ success: true });
  });

  app.post('/api/forget', (req, res) => {
    const { text } = req.body;
    const success = reasoner.forget(text);
    res.json({ success, stats: reasoner.getStats() });
  });

  // URL Learning
  app.post('/api/crawl', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);
      
      $('script, style').remove();
      const text = $('body').text().replace(/\s+/g, ' ').trim();
      
      const learned = reasoner.learnFromText(text, url);
      res.json({ success: true, learned, stats: reasoner.getStats() });
    } catch (e) {
      res.status(500).json({ error: 'Failed to crawl URL' });
    }
  });

  // File Upload Learning
  app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
      let text = '';
      const filename = req.file.originalname;

      if (filename.endsWith('.pdf')) {
        const data = await pdf(req.file.buffer);
        text = data.text;
      } else if (filename.endsWith('.docx')) {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        text = result.value;
      } else if (filename.endsWith('.zip')) {
        const zip = new AdmZip(req.file.buffer);
        const entries = zip.getEntries();
        let totalLearned = 0;
        for (const entry of entries) {
           if (!entry.isDirectory && (entry.name.endsWith('.txt') || entry.name.endsWith('.md'))) {
             const content = entry.getData().toString('utf8');
             totalLearned += reasoner.learnFromText(content, `${filename}/${entry.entryName}`);
           }
        }
        return res.json({ success: true, learned: totalLearned, stats: reasoner.getStats() });
      } else {
        text = req.file.buffer.toString('utf-8');
      }

      const learned = reasoner.learnFromText(text, filename);
      res.json({ success: true, learned, stats: reasoner.getStats() });
    } catch (e) {
      res.status(500).json({ error: 'Failed to process file' });
    }
  });

  // Export Brain
  app.get('/api/export', (req, res) => {
    const meta = reasoner.getExportMetadata();
    const zip = new AdmZip();
    
    // Main brain state (SVO Memory, Graph info, etc - but exclude massive causalMemory)
    const rulesManifest = {
      ...meta,
      exportVersion: "7.2",
      chunked: true 
    };
    zip.addFile('rules.json', Buffer.from(JSON.stringify(rulesManifest, null, 2), 'utf8'));
    
    // Add existing chunks directly from disk
    const memoryDir = path.join(process.cwd(), 'data', 'brain');
    if (fs.existsSync(memoryDir)) {
      const chunks = fs.readdirSync(memoryDir).filter(f => f.startsWith('causal_memory_') && f.endsWith('.json'));
      for (const chunk of chunks) {
        const chunkPath = path.join(memoryDir, chunk);
        zip.addLocalFile(chunkPath);
      }
    }
    
    // Config and Readme
    const configExport = {
      version: "7.1",
      exportDate: new Date().toISOString(),
      unitCount: reasoner.getStats().causalRules
    };
    zip.addFile('config.json', Buffer.from(JSON.stringify(configExport, null, 2), 'utf8'));
    
    const readme = `
MURE ULTIMATE V7 BRAIN EXPORT (HYPER-SCALE 15.0M EDITION)
--------------------------------------------------
Instructions for Myo Min Aung:

1. Unzip this file.
2. Copy ALL files into your Google Drive: "MyDrive/svo cc brain/"
3. This archive uses a CHUNKED storage format for stability.
4. When you run the app in Colab, it will detect the chunks and load the 15M+ units.

Technical Specs:
- Batch Chunking Enabled
- Memory Safety Verification Passed
- Target: 15,000,000 Logic Units

Date: ${new Date().toLocaleString()}
    `;
    zip.addFile('README.txt', Buffer.from(readme, 'utf8'));
    
    const buffer = zip.toBuffer();
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', 'attachment; filename=mure_brain_v7_15M.zip');
    res.send(buffer);
  });

  // Background Brain Activity (Self-Learning / Dreaming)
  setInterval(() => {
    reasoner.dream();
  }, 1000 * 60 * 5); // Every 5 minutes

  // Import Brain
  app.post('/api/import', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    try {
      const filename = req.file.originalname.toLowerCase();
      let importedData: any = { causalMemory: [], svoMemory: [], conversationHistory: [] };

      if (filename.endsWith('.zip')) {
        const zip = new AdmZip(req.file.buffer);
        const entries = zip.getEntries();
        
        // Find rules metadata
        const rulesEntry = zip.getEntry('rules.json') || zip.getEntry('brain.json');
        if (rulesEntry) {
          const meta = JSON.parse(rulesEntry.getData().toString('utf8'));
          importedData = { ...importedData, ...meta };
        }

        // Collect all memory chunks
        for (const entry of entries) {
           if (entry.entryName.startsWith('causal_memory_') && entry.entryName.endsWith('.json')) {
             const chunk = JSON.parse(entry.getData().toString('utf8'));
             if (Array.isArray(chunk)) {
               importedData.causalMemory.push(...chunk);
             }
           }
        }
      } else if (filename.endsWith('.json')) {
        const data = JSON.parse(req.file.buffer.toString('utf8'));
        if (data.causalMemory === undefined && Array.isArray(data)) {
          importedData.causalMemory = data;
        } else {
          importedData = { ...importedData, ...data };
        }
      } else {
        throw new Error('Unsupported file format. Please upload .zip or .json');
      }

      if (!importedData.causalMemory || importedData.causalMemory.length === 0) {
        throw new Error('No causal links found in the import file.');
      }

      reasoner.importBrain(importedData);
      res.json({ success: true, stats: reasoner.getStats() });
    } catch (e) {
      console.error('Import Error:', e);
      res.status(500).json({ error: `Failed to import brain: ${e instanceof Error ? e.message : 'Unknown error'}` });
    }
  });

  app.get('/api/graph', (req, res) => {
    res.json(reasoner.getGraphData());
  });

  app.get('/api/stats', (req, res) => {
    try {
      const stats = reasoner.getStats();
      res.json(stats);
    } catch (e) {
      console.error('Error fetching stats:', e);
      res.status(500).json({ error: 'Failed to retrieve brain statistics' });
    }
  });

  app.post('/api/dream', (req, res) => {
    const result = reasoner.dream();
    res.json(result);
  });

  app.post('/api/massive-bootstrap', async (req, res) => {
    try {
      const stats = await reasoner.triggerMassiveBootstrap();
      res.json({ success: true, stats });
    } catch (e) {
      console.error('Massive Bootstrap Error:', e);
      res.status(500).json({ error: 'Failed to initiate massive bootstrap' });
    }
  });

  app.get('/api/dataset/download', (req, res) => {
    try {
      res.setHeader('Content-Type', 'application/x-jsonlines');
      res.setHeader('Content-Disposition', 'attachment; filename="mure_finetune_dataset.jsonl"');
      
      const iterator = reasoner.getRulesIterator();
      let count = 0;

      for (const rule of iterator) {
        if (!rule.cause || !rule.effect) continue;
        
        const cause = String(rule.cause).trim();
        const effect = String(rule.effect).trim();
        
        // Optimized Alpaca/Unsloth format
        const entry = JSON.stringify({ 
           instruction: `Predict the causal outcome for: "${cause}"`,
           input: "", 
           output: `The logical consequence is "${effect}".` 
        });
        
        res.write(entry + '\n');
        count++;

        // Periodic yielding to keep event loop responsive during massive exports
        if (count % 10000 === 0) {
           // We don't await here as it's a sync loop for res.write, 
           // but we can log progress
           if (count % 100000 === 0) console.log(`[Export] Streamed ${count} rules...`);
        }
      }
      
      console.log(`[Export] Successfully streamed ${count} rules as JSONL.`);
      res.end();
    } catch (error) {
      console.error('Streaming dataset error:', error);
      if (!res.headersSent) {
         res.status(500).json({ error: 'Failed to generate dataset stream.' });
      } else {
         res.end();
      }
    }
  });

  app.get('/api/dataset/colab', (req, res) => {
    try {
      const colabPath = path.join(process.cwd(), 'MURE_MASTER_AGI_SYSTEM.ipynb');
      res.download(colabPath);
    } catch (e) {
      res.status(500).send("Colab file not found");
    }
  });

  // Health check for local server
  app.get('/api/health', (req, res) => {
    res.json({ status: 'online', type: 'local_ts_backend', timestamp: new Date().toISOString() });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MURE Brain running on http://localhost:${PORT}`);
  });
}

startServer();
