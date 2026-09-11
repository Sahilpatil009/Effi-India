// Local-only adapter for the same handler deployed on Vercel. Node 22+.
const { createServer } = require('node:http');
const { loadEnvFile } = require('node:process');
const { existsSync } = require('node:fs');
const { resolve } = require('node:path');
// Reuse existing local configuration without copying credentials into new files.
for (const file of ['.env.local', '../agent/.env.local', '../dashboard/.env.local']) {
  if (existsSync(resolve(file))) loadEnvFile(resolve(file));
}
process.env.SUPABASE_PUBLISHABLE_KEY ??= process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
process.env.SUPABASE_URL ??= process.env.NEXT_PUBLIC_SUPABASE_URL;
const handler = require('../.dev-dist/token.js').default;
const port = Number(process.env.TOKEN_DEV_PORT || 3002);
createServer(async (req, res) => {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (value) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); return res; };
  if (!['/token', '/api/token'].includes(req.url?.split('?')[0])) return res.status(404).json({ error: 'Not found' });
  try {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk.toString();
      if (raw.length > 16384) return res.status(413).json({ error: 'Request too large' });
    }
    try { req.body = raw ? JSON.parse(raw) : {}; }
    catch { return res.status(400).json({ error: 'Invalid JSON' }); }
    await handler(req, res);
  } catch { if (!res.headersSent) res.status(500).json({ error: 'Token service unavailable' }); }
}).listen(port, '127.0.0.1', () => console.log(`Local token server: http://127.0.0.1:${port}/token`));
