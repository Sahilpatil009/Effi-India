const { test, after } = require('node:test');
const assert = require('node:assert/strict');

// Synthetic configuration only. No provider request or real credential is used.
Object.assign(process.env, {
  LIVEKIT_URL: 'wss://example.invalid', LIVEKIT_API_KEY: 'test-key',
  LIVEKIT_API_SECRET: 'test-secret-that-is-at-least-32-characters',
  SUPABASE_URL: 'https://example.invalid', SUPABASE_PUBLISHABLE_KEY: 'test-key',
});
const handler = require('../.test-dist/token.js').default;
const originalFetch = global.fetch;
after(() => { global.fetch = originalFetch; });
const userId = 'a00a0000-0000-4000-8000-000000000001';

async function request(body = {}, authorization = 'Bearer test-session', method = 'POST') {
  const result = { status: 200, headers: {}, body: null };
  const res = {
    setHeader(key, value) { result.headers[key] = value; },
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
    end() { return this; },
  };
  await handler({ method, body, headers: { authorization } }, res);
  return result;
}

test('rejects missing auth, invalid category/language and caller-selected rooms', async () => {
  global.fetch = async () => { throw new Error('Must not contact auth'); };
  assert.equal((await request({}, '')).status, 401);
  for (const body of [{ category: 'OTHER' }, { language: '' }, { language: 'en/room' }, { roomName: 'another-room' }]) {
    assert.equal((await request(body)).status, 400);
  }
});

test('preflight succeeds and unsupported methods are rejected without auth', async () => {
  assert.equal((await request({}, '', 'OPTIONS')).status, 200);
  assert.equal((await request({}, '', 'GET')).status, 405);
});

test('expired sessions fail; auth outages and malformed responses are controlled', async () => {
  global.fetch = async () => new Response('{}', { status: 401 });
  assert.equal((await request()).status, 401);
  global.fetch = async () => { throw new Error('sensitive internal error'); };
  const unavailable = await request();
  assert.equal(unavailable.status, 503);
  assert.ok(!JSON.stringify(unavailable.body).includes('sensitive'));
  global.fetch = async () => new Response('{}', { status: 200 });
  assert.equal((await request()).status, 503);
});

test('each call gets an isolated room and identity with verified user metadata', async () => {
  global.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-session');
    assert.ok(options.signal);
    return Response.json({ id: userId, email: 'citizen@example.invalid' });
  };
  const first = await request({ category: 'POWER_OUTAGE', language: 'HI' });
  const second = await request({ category: 'POWER_OUTAGE', language: 'HI' });
  assert.equal(first.status, 200);
  assert.equal(first.headers['Cache-Control'], 'no-store');
  assert.notEqual(first.body.roomName, second.body.roomName);
  const decode = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
  const a = decode(first.body.token), b = decode(second.body.token);
  assert.notEqual(a.sub, b.sub);
  assert.equal(a.video.room, first.body.roomName);
  assert.equal(a.video.roomJoin, true);
  const metadata = JSON.parse(a.metadata);
  assert.equal(metadata.userId, userId);
  assert.equal(metadata.category, 'POWER_OUTAGE');
  assert.equal(metadata.language, 'hi');
  assert.ok(first.body.roomName.endsWith(metadata.sessionId));
  const remaining = a.exp - Math.floor(Date.now() / 1000);
  assert.ok(remaining >= 595 && remaining <= 600);
});
