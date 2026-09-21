// Daily 8:00 summary: runs on GitHub Actions, sends each person a push with their tasks for today.
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const TZ = 'Asia/Jerusalem';
const NAMES = { shiri: 'שירי', shachar: 'שחר' };
const manual = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';
const [owner, repo] = (process.env.GITHUB_REPOSITORY || '/').split('/');
const APP_URL = `https://${owner}.github.io/${repo}/`;

const now = new Date();
const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now);
const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(now));

const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const toStr = d => d.toISOString().slice(0, 10);
function addInterval(s, every, unit) {
  const d = parse(s); every = Math.max(1, +every || 1);
  if (unit === 'day') d.setUTCDate(d.getUTCDate() + every);
  else if (unit === 'week') d.setUTCDate(d.getUTCDate() + 7 * every);
  else { const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + every);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(day, last)); }
  return toStr(d);
}
function effDue(t) {
  let d = t.due || today;
  if (t.snooze && t.snooze > d) d = t.snooze;
  if (t.size !== 'big') { let g = 0; while (d < today && g++ < 1000) d = addInterval(d, t.every, t.unit); }
  return d;
}

(async () => {
  const metaRef = db.doc('meta/push');
  if (!manual) {
    if (hour < 8 || hour > 11) { console.log(`Israel hour ${hour}, not sending now`); return; }
    const meta = (await metaRef.get()).data() || {};
    if (meta.lastSent === today) { console.log('Already sent today'); return; }
  }
  const tasks = (await db.collection('tasks').get()).docs.map(d => d.data());
  const devices = (await db.collection('devices').get()).docs.map(d => d.data());
  const messages = [];
  for (const who of Object.keys(NAMES)) {
    const due = tasks.filter(t => t.who === who && t.notify && effDue(t) <= today)
      .sort((a, b) => effDue(a).localeCompare(effDue(b)));
    if (!due.length && !manual) continue;
    const title = due.length ? `בוקר טוב ${NAMES[who]}, ${due.length === 1 ? 'משימה אחת' : due.length + ' משימות'} להיום` : `בדיקה: אין לך היום משימות עם התראה`;
    const names = due.slice(0, 5).map(t => t.title).join(', ') + (due.length > 5 ? ` ועוד ${due.length - 5}` : '');
    const body = due.length ? names : 'ההתראות עובדות 🎉';
    for (const dev of devices.filter(d => d.who === who)) {
      messages.push({ token: dev.token, webpush: { notification: { title, body, icon: APP_URL + 'icon-192.png', lang: 'he', dir: 'rtl' }, fcmOptions: { link: APP_URL } } });
    }
  }
  if (messages.length) {
    const res = await admin.messaging().sendEach(messages);
    console.log(`Sent ${res.successCount}, failed ${res.failureCount}`);
    await Promise.all(res.responses.map((r, i) => {
      const code = r.error && r.error.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        return db.doc('devices/' + messages[i].token).delete();
      }
      if (r.error) console.log('Error:', code);
    }));
  } else console.log('Nothing to send');
  if (!manual) await metaRef.set({ lastSent: today }, { merge: true });
})().catch(e => { console.error(e); process.exit(1); });
