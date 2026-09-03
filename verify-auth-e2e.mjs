import { config } from 'dotenv';
config({ path: '.env.local', override: true });
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const BASE = process.env.VERIFY_BASE_URL || 'http://localhost:3001';
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

const email = `authcheck+${Date.now()}@example.com`;
const password = 'TestPass123';
const name = 'Auth Check';

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

let uid = null;
let failures = 0;
const ok = (m) => console.log('  PASS  ' + m);
const bad = (m) => { failures++; console.log('  FAIL  ' + m); };

// Mint a real ID token the way the browser SDK does.
async function identityToolkit(path, body) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${path}?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, returnSecureToken: true }),
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} -> ${json.error?.message || res.status}`);
  return json;
}

try {
  console.log(`\nBase URL: ${BASE}`);
  console.log(`Test account: ${email}\n`);

  console.log('1. Firebase Web SDK account creation (createUserWithEmailAndPassword)');
  const created = await identityToolkit('signUp', { email, password });
  uid = created.localId;
  ok(`Auth user created, uid=${uid}`);

  console.log('\n2. POST /api/auth/sign-up');
  const suRes = await fetch(`${BASE}/api/auth/sign-up`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, idToken: created.idToken }),
  });
  const suBody = await suRes.json().catch(() => null);
  console.log(`  status=${suRes.status} body=${JSON.stringify(suBody)}`);
  if (suRes.ok && suBody?.success) ok('sign-up route succeeded'); else bad('sign-up route failed');

  const setCookie = suRes.headers.get('set-cookie') || '';
  if (/session=/.test(setCookie)) ok('session cookie issued');
  else bad('no session cookie in response');
  const sessionCookie = setCookie.split(';')[0];

  console.log('\n3. Firestore profile document');
  const doc = await getFirestore().collection('users').doc(uid).get();
  if (doc.exists) ok(`users/${uid} written: ${JSON.stringify(doc.data())}`);
  else bad(`users/${uid} missing`);

  console.log('\n4. POST /api/auth/sign-in (fresh token)');
  const signedIn = await identityToolkit('signInWithPassword', { email, password });
  const siRes = await fetch(`${BASE}/api/auth/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, idToken: signedIn.idToken }),
  });
  const siBody = await siRes.json().catch(() => null);
  console.log(`  status=${siRes.status} body=${JSON.stringify(siBody)}`);
  if (siRes.ok && siBody?.success) ok('sign-in route succeeded'); else bad('sign-in route failed');

  console.log('\n5. Authenticated page load with session cookie');
  const home = await fetch(`${BASE}/`, {
    headers: { cookie: sessionCookie },
    redirect: 'manual',
  });
  console.log(`  GET / -> ${home.status}`);
  if (home.status === 200) ok('session cookie authenticates the app shell');
  else bad(`expected 200, got ${home.status} (location=${home.headers.get('location')})`);

  console.log('\n5b. Authenticated render of the heavier routes');
  for (const path of ['/interview', '/dashboard', '/pricing']) {
    const res = await fetch(`${BASE}${path}`, {
      headers: { cookie: sessionCookie },
      redirect: 'manual',
    });
    if (res.status === 200) ok(`${path} -> 200`);
    else bad(`${path} -> ${res.status} (location=${res.headers.get('location')})`);
  }

  console.log('\n6. Unauthenticated request is redirected to sign-in');
  const anon = await fetch(`${BASE}/`, { redirect: 'manual' });
  console.log(`  GET / (no cookie) -> ${anon.status} location=${anon.headers.get('location')}`);
  if (anon.status >= 300 && anon.status < 400) ok('anonymous visitor redirected');
  else bad('anonymous visitor was not redirected');

  console.log('\n7. Wrong password is rejected');
  try {
    await identityToolkit('signInWithPassword', { email, password: 'WrongPass999' });
    bad('wrong password was accepted');
  } catch {
    ok('wrong password rejected');
  }
} catch (e) {
  bad(`threw: ${e.message}`);
} finally {
  if (uid) {
    await getAuth().deleteUser(uid).catch(() => {});
    await getFirestore().collection('users').doc(uid).delete().catch(() => {});
    console.log('\nCleaned up test account.');
  }
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
