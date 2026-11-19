import { appCheckKey, firebaseConfig } from './firebaseConfig.js';
import { ACCOUNT_KEY, NEWEST_KEYS, gameKeys, isGameKey, scopeOf } from './saveKeys.js';
import { haltStores } from './persist.js';
import { auditSeal, dropTampered, writeGameItem } from './seal.js';

const SDK = 'https://www.gstatic.com/firebasejs/11.0.2/';
const SYNC_EVERY = 30000;
const DOCS = { self: 'saves', world: 'worlds' };
const REV_FIELD = { self: 'rev', world: 'worldRev' };
const SCOPES = Object.keys(DOCS);

export const cloudEnabled = Boolean(firebaseConfig.apiKey);

let sdk = null;
let sync = null;

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function account() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function saveAccount(value) {
  try {
    if (value) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(value));
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch {}
}

const AUTH_HOSTS = /^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\//;

function allowAuthReferrer() {
  if (self.fetch.authReferrer) return;
  const nativeFetch = self.fetch.bind(self);
  const patched = (input, init) => {
    const url = typeof input === 'string' ? input : input.url ?? String(input);
    if (init?.referrerPolicy === 'no-referrer' && AUTH_HOSTS.test(url)) init = { ...init, referrerPolicy: 'strict-origin-when-cross-origin' };
    return nativeFetch(input, init);
  };
  patched.authReferrer = true;
  self.fetch = patched;
}

function loadSdk() {
  if (sdk) return sdk;
  allowAuthReferrer();
  sdk = (async () => {
    const [app, auth, store, check] = await Promise.all(['app', 'auth', 'firestore', 'app-check'].map((name) => import(`${SDK}firebase-${name}.js`)));
    const instance = app.initializeApp(firebaseConfig);
    if (appCheckKey) check.initializeAppCheck(instance, { provider: new check.ReCaptchaEnterpriseProvider(appCheckKey), isTokenAutoRefreshEnabled: true });
    const session = auth.getAuth(instance);
    await session.authStateReady();
    return { auth, store, session, db: store.getFirestore(instance) };
  })();
  sdk.catch(() => (sdk = null));
  return sdk;
}

function snapshot(scope) {
  const data = {};
  for (const key of gameKeys(scope).sort()) data[key] = localStorage.getItem(key);
  return JSON.stringify(data);
}

function stampOf(text) {
  try {
    const stamp = JSON.parse(text ?? 'null')?.savedAt;
    return Number.isFinite(stamp) ? stamp : 0;
  } catch {
    return 0;
  }
}

function restore(text, scope) {
  const data = JSON.parse(text);
  const kept = NEWEST_KEYS.filter((key) => scopeOf(key) === scope)
    .map((key) => [key, localStorage.getItem(key)])
    .filter(([key, value]) => value !== null && stampOf(value) > stampOf(data[key]));
  for (const key of gameKeys(scope)) localStorage.removeItem(key);
  for (const [key, value] of Object.entries(data)) if (isGameKey(key) && scopeOf(key) === scope && typeof value === 'string') localStorage.setItem(key, value);
  for (const [key, value] of kept) writeGameItem(key, value);
}

const wroteRev = (known, scope, rev) => Boolean(known) && (rev === known[REV_FIELD[scope]] || rev === known.pending?.[scope]);

async function claim(store, db, refs, known, id) {
  const local = Object.fromEntries(SCOPES.map((scope) => [scope, snapshot(scope)]));
  const result = await store.runTransaction(db, async (tx) => {
    const cloud = {};
    for (const scope of SCOPES) {
      const found = await tx.get(refs[scope]);
      cloud[scope] = found.exists() ? found.data() : null;
    }
    const ours = SCOPES.every((scope) => !cloud[scope] || wroteRev(known, scope, cloud[scope].rev));
    const claimed = {};
    for (const scope of SCOPES) {
      if (!ours && cloud[scope]) {
        tx.update(refs[scope], { session: id });
        claimed[scope] = { rev: cloud[scope].rev, data: cloud[scope].data };
        continue;
      }
      const next = newId();
      tx.set(refs[scope], { data: local[scope], rev: next, session: id, savedAt: store.serverTimestamp() });
      claimed[scope] = { rev: next, data: local[scope] };
    }
    return claimed;
  });
  const stale = SCOPES.filter((scope) => result[scope].data !== local[scope]);
  for (const scope of stale) restore(result[scope].data, scope);
  if (stale.length) {
    const broken = auditSeal();
    if (broken.length) dropTampered(broken);
  }
  return result;
}

export async function signedIn() {
  const { session } = await loadSdk();
  return Boolean(session.currentUser);
}

export async function connect() {
  const { store, session, db } = await loadSdk();
  const user = session.currentUser;
  const saved = account();
  const refs = { self: store.doc(db, DOCS.self, user.uid), world: store.doc(db, DOCS.world, user.uid) };
  const id = newId();
  const tampered = auditSeal();
  if (tampered.length) dropTampered(tampered);
  const continuing = !tampered.length && saved?.uid === user.uid;
  const claimed = await claim(store, db, refs, continuing ? saved : null, id);
  saveAccount({ uid: user.uid, name: user.displayName ?? '', email: user.email ?? '', rev: claimed.self.rev, worldRev: claimed.world.rev });
  startSync(store, refs, id, { self: claimed.self.data, world: claimed.world.data });
  upload();
}

function onHidden() {
  if (document.visibilityState === 'hidden') setTimeout(upload);
}

function startSync(store, refs, id, uploaded) {
  sync = { refs, id, uploaded, busy: null };
  sync.timer = setInterval(upload, SYNC_EVERY);
  sync.unsubscribe = store.onSnapshot(
    refs.self,
    (found) => {
      if (found.get('session') !== id) takenOver();
    },
    () => {},
  );
  document.addEventListener('visibilitychange', onHidden);
}

function stopSync() {
  if (!sync) return;
  clearInterval(sync.timer);
  sync.unsubscribe();
  document.removeEventListener('visibilitychange', onHidden);
  sync = null;
}

function upload() {
  if (!sync) return Promise.resolve();
  const state = sync;
  state.busy ??= push(state).finally(() => (state.busy = null));
  return state.busy;
}

async function push(state) {
  if (auditSeal().length) return;
  const data = { self: snapshot('self'), world: snapshot('world') };
  const changed = SCOPES.filter((scope) => data[scope] !== state.uploaded[scope]);
  if (!changed.length) return;
  const { store, db } = await loadSdk();
  const before = account();
  if (!before || sync !== state) return;
  const pending = before.pending ?? {};
  const revs = Object.fromEntries(changed.map((scope) => [scope, pending[scope] ?? newId()]));
  saveAccount({ ...before, pending: { ...pending, ...revs } });
  let owned = false;
  try {
    owned = await store.runTransaction(db, async (tx) => {
      const found = await tx.get(state.refs.self);
      if (found.get('session') !== state.id) return false;
      for (const scope of changed) tx.update(state.refs[scope], { data: data[scope], rev: revs[scope], savedAt: store.serverTimestamp() });
      return true;
    });
  } catch {
    return;
  }
  if (!owned) return takenOver();
  for (const scope of changed) state.uploaded[scope] = data[scope];
  const saved = account();
  if (!saved || sync !== state) return;
  for (const scope of changed) {
    saved[REV_FIELD[scope]] = revs[scope];
    if (saved.pending?.[scope] === revs[scope]) delete saved.pending[scope];
  }
  if (saved.pending && !Object.keys(saved.pending).length) delete saved.pending;
  saveAccount(saved);
}

function takenOver() {
  if (!sync) return;
  stopSync();
  haltStores();
  saveAccount(null);
  const signedOut = loadSdk()
    .then(({ auth, session }) => auth.signOut(session))
    .catch(() => {});
  const dialog = document.getElementById('elsewhereDialog');
  if (!dialog) return;
  dialog.addEventListener('cancel', (event) => event.preventDefault());
  document.getElementById('elsewhereBtn')?.addEventListener('click', () => signedOut.then(() => location.reload()), { once: true });
  for (const open of document.querySelectorAll('dialog[open]')) open.close();
  dialog.showModal();
}

export async function signIn() {
  const { auth, session } = await loadSdk();
  if (session.currentUser) return;
  await auth.signInWithPopup(session, new auth.GoogleAuthProvider());
}

export async function signOut() {
  await upload().catch(() => {});
  stopSync();
  try {
    const { auth, session } = await loadSdk();
    await auth.signOut(session);
  } finally {
    saveAccount(null);
  }
}
