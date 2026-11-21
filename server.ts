import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { createDatabase, seedDatabase } from './backend/database/db';
import { createApiRouter } from './backend/routes/api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(dbPath = process.env.AGENTSHIELD_DB_PATH || 'agentshield.db') {
  const db = createDatabase(dbPath);
  seedDatabase(db);

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Restrict CORS to configured origins or same-origin in dev
  const allowedOrigin = process.env.CORS_ORIGIN || process.env.APP_URL || '';
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (!allowedOrigin || origin === allowedOrigin || origin.startsWith('http://localhost:'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-agent-api-key');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'AgentShield Runtime Security Gateway',
      llm_mode: process.env.GEMINI_API_KEY ? 'gemini' : 'deterministic_mock',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api', createApiRouter(db));

  return { app, db };
}

async function startServer() {
  const PORT = Number(process.env.PORT || 3000);
  const { app } = createApp();

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AgentShield server running at http://localhost:${PORT}`);
  });
}

// Only start HTTP listener when executed directly (not when imported by unit tests)
const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMainModule) {
  startServer().catch((err) => {
    console.error('Failed to start AgentShield server:', err);
    process.exit(1);
  });
}
