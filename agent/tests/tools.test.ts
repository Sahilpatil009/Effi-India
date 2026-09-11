import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { JobContext } from '@livekit/agents';
import { createComplaintTools } from '../src/tools.js';
import type { SessionState } from '../src/types.js';

function setup(overrides: Partial<SessionState> = {}, response: unknown = { status: 'denied' }) {
  const state: SessionState = {
    category: 'POTHOLE', language: 'en', userId: 'citizen-a', callerName: null,
    problemType: null, description: null, summary: null, location: null, photoUrl: null,
    transcript: [], citizenIdentity: 'citizen-a', ...overrides,
  };
  const ctx = { room: { name: 'test-room', localParticipant: {
    performRpc: async () => JSON.stringify(response),
  } } } as unknown as JobContext;
  return { state, tools: createComplaintTools({ ctx, state }) };
}
const details = { category: 'POTHOLE' as const, problemType: 'pothole',
  description: 'Damaged road', summary: 'Damaged road', language: 'en' };
const options = {} as Parameters<ReturnType<typeof createComplaintTools>['registerComplaint']['execute']>[1];
const location = { coords: { latitude: 18, longitude: 73, accuracy: 20,
  altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: 1000 };

test('registration refuses category changes, missing location, missing auth and missing evidence', async () => {
  await assert.rejects(setup().tools.registerComplaint.execute({ ...details, category: 'SANITATION' }, options), /Selected category/);
  await assert.rejects(setup().tools.registerComplaint.execute(details, options), /location/);
  await assert.rejects(setup({ location, userId: null }).tools.registerComplaint.execute(details, options), /Authenticated/);
  await assert.rejects(setup({ location }).tools.registerComplaint.execute(details, options), /Photo evidence/);
});

test('power outage cannot request a photo', async () => {
  const { tools } = setup({ category: 'POWER_OUTAGE' });
  assert.equal((await tools.requestPhoto.execute({ prompt: 'Photo' }, options)).status, 'error');
});

test('photo request requires device location first', async () => {
  const { tools } = setup();
  const result = await tools.requestPhoto.execute({ prompt: 'Photo' }, options);
  assert.equal(result.status, 'error');
  assert.match(result.message!, /location/);
});

test('denied location retry clears previously captured coordinates', async () => {
  const { tools, state } = setup({ location }, { status: 'denied' });
  await tools.requestLocation.execute({ prompt: 'Retry location' }, options);
  assert.equal(state.location, null);
});

test('invalid coordinates and denied location never populate session evidence', async () => {
  for (const response of [{ status: 'denied' }, { status: 'ok', location: {
    ...location, coords: { ...location.coords, latitude: 999 },
  } }]) {
    const { tools, state } = setup({}, response);
    const result = await tools.requestLocation.execute({ prompt: 'Share location' }, options);
    assert.notEqual(result.status, 'ok');
    assert.equal(state.location, null);
  }
});

test('valid device location populates the session', async () => {
  const { tools, state } = setup({}, { status: 'ok', location });
  assert.equal((await tools.requestLocation.execute({ prompt: 'Share location' }, options)).status, 'ok');
  assert.deepEqual(state.location, location);
});
