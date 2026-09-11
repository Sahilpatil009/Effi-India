import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateTicketNumber, insertComplaint, parseStoragePath } from '../src/supabase.js';
import type { ComplaintInsertInput } from '../src/types.js';

const input: ComplaintInsertInput = {
  registrationKey: 'effi-power_outage-en-test-session', userId: 'citizen-a',
  category: 'POWER_OUTAGE', problemType: 'power_outage', description: 'No electricity',
  summary: 'Power outage', callerName: null, language: 'en', photoUrl: null, transcript: [],
  location: { coords: { latitude: 18.5, longitude: 73.8, accuracy: 20,
    altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: 1000 },
};

// Models the RPC's atomic insert and unique ticket constraint, not a live DB.
function database(mode: 'normal' | 'lost-response' | 'fail' = 'normal') {
  const rows = new Map<string, { id: string; ticket_number: string; user_id: string }>();
  const client = {
    async rpc(_name: string, { complaint_payload: payload }: { complaint_payload: Record<string, string> }) {
      const key = payload.ticket_number;
      if (mode === 'fail') return { data: null, error: { message: 'Database unavailable' } };
      if (rows.has(key)) return { data: null, error: { code: '23505', message: 'Duplicate ticket' } };
      rows.set(key, { id: `id-${rows.size}`, ticket_number: key, user_id: payload.user_id });
      if (mode === 'lost-response') return { data: null, error: { message: 'Response lost' } };
      return { data: [{ complaint_id: rows.get(key)!.id, ticket_number: key }], error: null };
    },
    from(table: string) {
      assert.equal(table, 'complaints');
      const filters: Record<string, string> = {};
      return {
        select() { return this; },
        eq(key: string, value: string) { filters[key] = value; return this; },
        async maybeSingle() {
          assert.ok(filters.user_id, 'Recovery must be scoped to the owner');
          const row = rows.get(filters.ticket_number);
          return { data: row?.user_id === filters.user_id ? row : null, error: null };
        },
      };
    },
  };
  return { rows, client: client as unknown as SupabaseClient };
}

test('registration identity is stable and isolated by user and call', () => {
  const ticket = generateTicketNumber('a', 'call-1');
  assert.equal(ticket, generateTicketNumber('a', 'call-1'));
  assert.notEqual(ticket, generateTicketNumber('b', 'call-1'));
  assert.notEqual(ticket, generateTicketNumber('a', 'call-2'));
  assert.throws(() => generateTicketNumber('a', ''));
});

test('concurrent registrations and later retries return one persisted ticket', async () => {
  const db = database();
  const receipts = await Promise.all(Array.from({ length: 5 }, () => insertComplaint(input, db.client)));
  for (const receipt of receipts) assert.deepEqual(receipt, receipts[0]);
  assert.deepEqual(await insertComplaint(input, db.client), receipts[0]);
  assert.equal(db.rows.size, 1);
});

test('recovers a committed ticket after losing its RPC response', async () => {
  const db = database('lost-response');
  const receipt = await insertComplaint(input, db.client);
  assert.equal(receipt.ticketNumber, generateTicketNumber(input.userId, input.registrationKey));
  assert.equal(db.rows.size, 1);
});

test('failed persistence cannot produce a successful receipt', async () => {
  const db = database('fail');
  await assert.rejects(insertComplaint(input, db.client), /Database unavailable/);
  assert.equal(db.rows.size, 0);
});

test('new calls and different citizens create separate tickets', async () => {
  const db = database();
  await insertComplaint(input, db.client);
  await insertComplaint({ ...input, registrationKey: 'another-call' }, db.client);
  await insertComplaint({ ...input, userId: 'citizen-b' }, db.client);
  assert.equal(db.rows.size, 3);
});

test('evidence URLs must match the configured project, bucket, category and call', () => {
  const origin = 'https://project.example.invalid';
  const base = `${origin}/storage/v1/object/public/complaint-evidence/`;
  assert.equal(parseStoragePath(`${base}pothole/call-1/photo.jpg`, 'POTHOLE', 'call-1', origin), 'pothole/call-1/photo.jpg');
  for (const url of [
    `https://other.example.invalid/storage/v1/object/public/complaint-evidence/pothole/call-1/photo.jpg`,
    `${base}pothole/call-2/photo.jpg`, `${base}sanitation/call-1/photo.jpg`,
    `${base}pothole/call-1/sub/photo.jpg`, `${base}pothole/call-1/photo.jpg?redirect=1`,
  ]) assert.throws(() => parseStoragePath(url, 'POTHOLE', 'call-1', origin), /Photo must belong/);
});
