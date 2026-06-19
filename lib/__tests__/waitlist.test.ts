/**
 * Waitlist unit tests.
 * Run: tsx lib/__tests__/waitlist.test.ts
 */
import { upsertWaitlist } from '../waitlist';
import { loadMockDB, saveMockDB } from '../supabase/mockDb';
import { POST } from '../../app/api/waitlist/route';
import { NextRequest } from 'next/server';

let failed = false;
function it(name: string, fn: () => void | Promise<void>) {
  try {
    const p = fn();
    if (p instanceof Promise) {
      return p.then(() => {
        console.log(`  ✓ ${name}`);
      }).catch((e) => {
        failed = true;
        console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`);
      });
    } else {
      console.log(`  ✓ ${name}`);
    }
  } catch (e) {
    failed = true;
    console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`);
  }
}
function assert(c: unknown, m: string) { if (!c) throw new Error(m); }

async function runTests() {
  console.log('--- Waitlist Helper & Route Handler Tests ---');
  
  // 1. Reset waitlist state in mock db
  const db = loadMockDB();
  db.waitlist = [];
  saveMockDB(db);

  // Test 1: Helper inserts new email successfully
  await it('Helper inserts a new waitlist entry', async () => {
    const entry = await upsertWaitlist({
      email: 'test@example.com',
      intent: 'launch',
      wishlist_slugs: null,
      consent_service: true,
      consent_marketing: false,
    });
    
    assert(entry.email === 'test@example.com', 'email matches');
    assert(entry.intent === 'launch', 'intent matches');
    assert(entry.consent_service === true, 'consent_service true');
    assert(entry.consent_marketing === false, 'consent_marketing false');
    assert(entry.id !== undefined, 'id created');
    
    const currentDb = loadMockDB();
    assert((currentDb.waitlist || []).length === 1, 'mock db has exactly 1 entry');
  });

  // Test 2: Helper updates existing email (upsert)
  await it('Helper updates existing entry on email conflict (upsert)', async () => {
    const originalDb = loadMockDB();
    const originalCount = (originalDb.waitlist || []).length;
    
    const entry = await upsertWaitlist({
      email: 'TEST@example.com', // Case insensitivity check
      intent: 'price_alert',
      wishlist_slugs: ['slug1', 'slug2'],
      consent_service: true,
      consent_marketing: true,
    });

    assert(entry.intent === 'price_alert', 'returned entry has correct intent');

    const currentDb = loadMockDB();
    assert((currentDb.waitlist || []).length === originalCount, 'upsert did not create new row');
    
    const updated = (currentDb.waitlist || []).find(w => w.email === 'test@example.com');
    assert(updated !== undefined, 'entry exists');
    assert(updated?.intent === 'price_alert', 'intent updated');
    assert(updated?.consent_marketing === true, 'marketing consent updated');
    assert(updated?.wishlist_slugs?.includes('slug1'), 'wishlist slugs updated');
  });

  // Test 3: Route Handler validation failures
  await it('Route Handler rejects missing email', async () => {
    const req = new NextRequest('http://localhost/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({
        email: '',
        intent: 'launch',
        consent_service: true,
      }),
    });
    const res = await POST(req);
    assert(res.status === 400, 'status is 400');
    const data = await res.json();
    assert(data.error.includes('이메일 주소'), 'error message matches');
  });

  await it('Route Handler rejects invalid email format', async () => {
    const req = new NextRequest('http://localhost/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({
        email: 'invalid-email',
        intent: 'launch',
        consent_service: true,
      }),
    });
    const res = await POST(req);
    assert(res.status === 400, 'status is 400');
    const data = await res.json();
    assert(data.error.includes('이메일 형식'), 'error message matches');
  });

  await it('Route Handler rejects missing required service consent', async () => {
    const req = new NextRequest('http://localhost/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({
        email: 'valid@example.com',
        intent: 'launch',
        consent_service: false,
      }),
    });
    const res = await POST(req);
    assert(res.status === 400, 'status is 400');
    const data = await res.json();
    assert(data.error.includes('수신 동의'), 'error message matches');
  });

  await it('Route Handler rejects invalid intent', async () => {
    const req = new NextRequest('http://localhost/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({
        email: 'valid@example.com',
        intent: 'invalid_intent',
        consent_service: true,
      }),
    });
    const res = await POST(req);
    assert(res.status === 400, 'status is 400');
    const data = await res.json();
    assert(data.error.includes('신청 목적'), 'error message matches');
  });

  // Test 4: Route Handler success path
  await it('Route Handler registers launch intent successfully', async () => {
    const req = new NextRequest('http://localhost/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({
        email: 'route@example.com',
        intent: 'launch',
        consent_service: true,
        consent_marketing: true,
      }),
    });
    const res = await POST(req);
    assert(res.status === 200, 'status is 200');
    const data = await res.json();
    assert(data.success === true, 'success is true');
    assert(data.message.includes('출시되면'), 'message is correct');
  });

  // Schedule check for overall result
  setTimeout(() => {
    console.log(failed ? '\nResult: FAILED' : '\nResult: ALL PASSED');
    if (failed) process.exit(1);
  }, 100);
}

runTests();
