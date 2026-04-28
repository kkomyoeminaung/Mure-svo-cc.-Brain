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
        const confidence = result.calibratedConfidence || result.causalStrength;
        
        const finalReply = speaker.generateResponse(message, result, reasoner, confidence);

        // 3. Collaborative Output
        const reply = note ? `${note}\n\n${finalReply}` : finalReply;

        // 4. Multi-turn memory
        reasoner.recordTurn(message, reply, result);

        res.json({
          reply: reply,
          frame: result,
          source: learnRes.success ? 'collaborative_learning' : 'knowledge_base',
          stats: reasoner.getStats(),
          chain: [] // Dummy chain for UI compatibility
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
      
      // Remove scripts and styles
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
    const data = reasoner.exportBrain();
    const zip = new AdmZip();
    
    // Main brain state
    zip.addFile('brain.json', Buffer.from(JSON.stringify(data, null, 2), 'utf8'));
    
    // Direct rules file for easy dropping into SVO CC Brain folder
    const rulesOnly = {
      causalMemory: data.causalMemory,
      svoMemory: data.svoMemory,
      lastExport: new Date().toISOString()
    };
    zip.addFile('rules.json', Buffer.from(JSON.stringify(rulesOnly, null, 0), 'utf8'));
    
    // Export Knowledge Graph separately
    const graphOnly = {
      nodes: Array.from(data.knowledgeGraph.map((e: any) => e[0])),
      edges: data.knowledgeGraph
    };
    zip.addFile('knowledge_graph.json', Buffer.from(JSON.stringify(graphOnly, null, 0), 'utf8'));

    // Export Memories
    zip.addFile('memories.json', Buffer.from(JSON.stringify(data.conversationHistory, null, 2), 'utf8'));

    // Export Config
    const configExport = {
      version: "7.0",
      exportDate: new Date().toISOString(),
      unitCount: data.causalMemory.length
    };
    zip.addFile('config.json', Buffer.from(JSON.stringify(configExport, null, 2), 'utf8'));
    
    // Add instruction for Myo Min Aung
    const readme = `
MURE ULTIMATE V7 BRAIN EXPORT (HYPER-SCALE 15.0M EDITION)
--------------------------------------------------
Instructions for Myo Min Aung:

1. Unzip this file.
2. Copy ALL files into your Google Drive: "MyDrive/svo cc brain/"
3. Files included:
   - rules.json (Core logic)
   - knowledge_graph.json (Relations)
   - memories.json (Conversations)
   - config.json (System state)

4. When you run the app in Colab, it will automatically detect these files and load the 15M+ units.

Technical Specs:
- 15,000,000+ Priming Logic Units Supported
- Adaptive Causal Indexing Active
- Moral Simplicity Filter Enabled

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
      let data: any;

      if (filename.endsWith('.zip')) {
        const zip = new AdmZip(req.file.buffer);
        const brainEntry = zip.getEntry('brain.json');
        if (!brainEntry) throw new Error('Invalid archive: brain.json not found');
        data = JSON.parse(brainEntry.getData().toString('utf8'));
      } else if (filename.endsWith('.json')) {
        data = JSON.parse(req.file.buffer.toString('utf8'));
        // Support both "brain.json" (exported full state) and direct "rules.json" (just memory)
        if (data.causalMemory === undefined && Array.isArray(data)) {
          // If it's just an array, it might be an older format or raw rules
          data = { causalMemory: data };
        }
      } else {
        throw new Error('Unsupported file format. Please upload .zip or .json');
      }

      reasoner.importBrain(data);
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
      const memoryDir = path.join(process.cwd(), 'data', 'brain');
      if (!fs.existsSync(memoryDir)) {
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Content-Disposition', 'attachment; filename="mure_finetune_dataset.jsonl"');
        res.end();
        return;
      }
      const files = fs.readdirSync(memoryDir).filter((f: string) => f.startsWith('causal_memory_') && f.endsWith('.json'));
      
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Content-Disposition', 'attachment; filename="mure_finetune_dataset.jsonl"');
      
      for (const file of files) {
        const chunkPath = path.join(memoryDir, file);
        if (fs.existsSync(chunkPath)) {
          const chunk = JSON.parse(fs.readFileSync(chunkPath, 'utf-8'));
          for (const rule of chunk) {
            if (!rule.cause || !rule.effect) continue;
            
            let instruction, output;
            const type = Math.floor(Math.random() * 4);
            
            const cause = String(rule.cause).trim();
            const effect = String(rule.effect).trim();
            const strength = rule.strength ? ` (Confidence: ${rule.strength})` : '';

            if (type === 0) {
              instruction = `What is the logical consequence of the following situation: "${cause}"?`;
              output = `The logical consequence of "${cause}" is "${effect}"${strength}.`;
            } else if (type === 1) {
              instruction = `Analyze the causal relationship: What happens as a result of "${cause}"?`;
              output = `Based on logical deduction, "${cause}" leads to "${effect}"${strength}.`;
            } else if (type === 2) {
              instruction = `Given the cause: "${cause}", determine the expected effect.`;
              output = `The expected effect is: "${effect}". This causal link is established by MURE reasoning.`;
            } else {
              instruction = `Predict the outcome if this condition is met: "${cause}"`;
              output = `If this condition is met, it will inevitably result in "${effect}"${strength}.`;
            }
            
            res.write(JSON.stringify({ instruction, input: "", output }) + '\n');
          }
        }
      }
      res.end();
    } catch (error) {
      console.error('Dataset generation error:', error);
      if (!res.headersSent) res.status(500).json({ error: 'Failed to generate dataset' });
    }
  });

  app.get('/api/dataset/colab', (req, res) => {
    try {
      const colabPath = path.join(process.cwd(), 'MURE_OneClick_FineTune.ipynb');
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
