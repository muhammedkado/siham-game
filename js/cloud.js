/* سهام — الحساب والسحابة: تسجيل الدخول (Firebase Auth) + حفظ التقدم ولوحة الصدارة (Firestore REST) */
(function (root) {
  'use strict';
  const CFG = {
    apiKey: 'AIzaSyApBo4l76dghOOgdmSQlDo0Kgo2BxuDRHc',
    authDomain: 'siham-36734.firebaseapp.com',
    projectId: 'siham-36734',
    appId: '1:1031148102736:web:f4668b3f1948f41aab1d55',
  };
  const DOCS = 'https://firestore.googleapis.com/v1/projects/' + CFG.projectId + '/databases/(default)/documents';
  const NATIVE = root.AndroidBridge || null;
  let auth = null, user = null, signingOut = false;
  const subs = [];
  try { firebase.initializeApp(CFG); auth = firebase.auth(); } catch (e) { auth = null; }

  // ——— Firestore عبر REST (أخف بكثير من مكتبة Firestore الكاملة) ———
  const enc = v => typeof v === 'number' ? { integerValue: String(Math.round(v)) } : v && typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } } : { stringValue: String(v) };
  const dec = f => { const o = {}; for (const k in f || {}) { const x = f[k]; o[k] = 'integerValue' in x ? +x.integerValue : 'doubleValue' in x ? +x.doubleValue : 'mapValue' in x ? dec(x.mapValue.fields) : x.stringValue; } return o; };
  async function req(method, path, body, tk) {
    const h = { 'Content-Type': 'application/json' };
    if (tk === undefined && user) tk = await user.getIdToken().catch(() => null);
    if (tk) h.Authorization = 'Bearer ' + tk;
    const r = await fetch(DOCS + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('firestore ' + r.status);
    return r.json();
  }
  const put = (path, obj, tk) => req('PATCH', path, { fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, enc(v)])) }, tk);
  const rows = r => (r || []).filter(x => x.document).map(x => Object.assign({ id: x.document.name.split('/').pop() }, dec(x.document.fields)));
  const coll = kind => kind === 'all' ? ['', 'board', 's'] : kind === 'week' ? ['/weeks/' + weekId(), 'p', 's'] : ['/days/' + dayId(), 'p', 't'];

  // معرّف الأسبوع = تاريخ يوم الاثنين (UTC)؛ اليوم = التاريخ المحلي مثل التحدي اليومي
  function weekId(d) { d = d || new Date(); const k = (d.getUTCDay() + 6) % 7; return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - k)).toISOString().slice(0, 10); }
  function dayId() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  function info() {
    if (!user) return null;
    const g = user.providerData.find(p => p && p.providerId === 'google.com');
    return { uid: user.uid, anon: user.isAnonymous, email: user.email || (g && g.email) || '', google: !!g, name: (g && g.displayName) || user.displayName || '' };
  }
  const emit = () => { const u = info(); subs.forEach(f => { try { f(u); } catch (e) { /* ignore */ } }); };
  const guest = () => { if (auth && !auth.currentUser && navigator.onLine !== false) auth.signInAnonymously().catch(() => { /* offline */ }); };

  /** ننتقل من حساب الضيف لحساب موجود: نحذف صفوف الضيف من لوحة الصدارة حتى لا يظهر اللاعب مرتين */
  async function switchTo(fn) {
    const old = auth.currentUser, wasGuest = !!(old && old.isAnonymous);
    const oldTk = wasGuest ? await old.getIdToken().catch(() => null) : null;
    const res = await fn();
    if (wasGuest && auth.currentUser && auth.currentUser.uid !== old.uid) {
      if (oldTk) await Promise.all(['/board/', '/weeks/' + weekId() + '/p/', '/days/' + dayId() + '/p/'].map(p => req('DELETE', p + old.uid, null, oldTk).catch(() => {})));
      // نحذف حساب الضيف القديم عبر REST (user.delete() في المكتبة يسجّل خروج الحساب الحالي أيضاً)
      if (oldTk) fetch('https://identitytoolkit.googleapis.com/v1/accounts:delete?key=' + CFG.apiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: oldTk }) }).catch(() => {});
    }
    user = auth.currentUser; emit();
    return res;
  }
  /** ربط حساب الضيف بطريقة دخول؛ إذا كانت الطريقة مربوطة بحساب آخر ندخل إليه */
  async function linkOrSwitch(cred) {
    const u = auth.currentUser;
    if (u && u.isAnonymous) {
      try { await u.linkWithCredential(cred); await u.reload(); user = auth.currentUser; emit(); return; }
      catch (e) {
        if (e.code !== 'auth/credential-already-in-use' && e.code !== 'auth/email-already-in-use') throw e;
        return switchTo(() => auth.signInWithCredential(e.credential || cred));
      }
    }
    return switchTo(() => auth.signInWithCredential(cred));
  }

  let gWait = null;
  root.__googleToken = (tk, err) => { const w = gWait; gWait = null; if (!w) return; if (tk) w.ok(tk); else w.no(Object.assign(new Error(err), { code: err === 'cancel' ? 'auth/popup-closed-by-user' : 'auth/google-native' })); };

  const Cloud = {
    ok: !!auth,
    weekId, dayId,
    get user() { return info(); },
    onUser(fn) { subs.push(fn); },
    start() {
      if (!auth) return;
      try { auth.languageCode = document.documentElement.lang || 'ar'; } catch (e) { /* ignore */ }
      auth.onAuthStateChanged(u => { user = u; if (u) emit(); else if (!signingOut) guest(); });
      root.addEventListener('online', guest);
    },
    canGoogle() { return !!auth && (NATIVE ? !!NATIVE.hasGoogle : /^https?:$/.test(location.protocol)); },
    async google() {
      if (NATIVE && NATIVE.googleSignIn) {
        const tk = await new Promise((ok, no) => { gWait = { ok, no }; NATIVE.googleSignIn(); });
        return linkOrSwitch(firebase.auth.GoogleAuthProvider.credential(tk));
      }
      const p = new firebase.auth.GoogleAuthProvider();
      p.setCustomParameters({ prompt: 'select_account' });
      const u = auth.currentUser;
      if (u && u.isAnonymous) {
        try { await u.linkWithPopup(p); await u.reload(); user = auth.currentUser; emit(); return; }
        catch (e) { if (e.code !== 'auth/credential-already-in-use' || !e.credential) throw e; return switchTo(() => auth.signInWithCredential(e.credential)); }
      }
      return switchTo(() => auth.signInWithPopup(p));
    },
    async signUp(email, pw) {
      const u = auth.currentUser;
      if (u && u.isAnonymous) { await u.linkWithCredential(firebase.auth.EmailAuthProvider.credential(email, pw)); await u.reload(); user = auth.currentUser; emit(); return; }
      return switchTo(() => auth.createUserWithEmailAndPassword(email, pw));
    },
    signIn(email, pw) { return switchTo(() => auth.signInWithEmailAndPassword(email, pw)); },
    reset(email) { return auth.sendPasswordResetEmail(email); },
    async signOut() { signingOut = true; try { await auth.signOut(); } finally { signingOut = false; } user = null; guest(); },

    // ——— حذف الحساب (شرط Google Play): كل البيانات في السحابة + حساب الدخول نفسه ———
    /** نوع إعادة التحقق المطلوبة قبل الحذف: google | password | null (ضيف) */
    reauthKind() {
      const u = auth && auth.currentUser;
      if (!u || u.isAnonymous) return null;
      return u.providerData.some(p => p && p.providerId === 'google.com') ? 'google' : 'password';
    },
    /** Firebase يشترط تسجيل دخول حديث لحذف الحساب */
    async reauth(pw) {
      const u = auth.currentUser, kind = Cloud.reauthKind();
      if (kind === 'password') return u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, pw));
      if (kind !== 'google') return;
      if (NATIVE && NATIVE.googleSignIn) {
        const tk = await new Promise((ok, no) => { gWait = { ok, no }; NATIVE.googleSignIn(); });
        return u.reauthenticateWithCredential(firebase.auth.GoogleAuthProvider.credential(tk));
      }
      const p = new firebase.auth.GoogleAuthProvider();
      p.setCustomParameters({ prompt: 'select_account' });
      return u.reauthenticateWithPopup(p);
    },
    /** يحذف التقدم وكل صفوف لوحات الصدارة ثم حساب الدخول.
     *  بعد النجاح لا يُنشأ ضيف جديد حتى تمسح اللعبة تقدمها المحلي وتستدعي signOut (وإلا يُرفع التقدم القديم من جديد) */
    async deleteAccount() {
      const u = auth && auth.currentUser;
      if (!u) return;
      const tk = await u.getIdToken(true), uid = u.uid;
      // صفوف الأسابيع والأيام: كل يوم منذ إطلاق لوحات الصدارة (حذف مستند غير موجود لا يضر)
      const names = ['users/' + uid, 'board/' + uid], iso = t => new Date(t).toISOString().slice(0, 10);
      for (let t = Date.UTC(2026, 10, 1), end = Date.now() + 2 * 864e5; t <= end; t += 864e5) {
        names.push('days/' + iso(t) + '/p/' + uid);
        if (new Date(t).getUTCDay() === 1) names.push('weeks/' + iso(t) + '/p/' + uid);
      }
      const base = 'projects/' + CFG.projectId + '/databases/(default)/documents/';
      for (let i = 0; i < names.length; i += 400) {
        const r = await fetch(DOCS + ':commit', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
          body: JSON.stringify({ writes: names.slice(i, i + 400).map(n => ({ delete: base + n })) }),
        });
        if (!r.ok) throw new Error('firestore ' + r.status);
      }
      signingOut = true;   // يبقى مفعّلاً حتى signOut
      try {
        try { await u.delete(); }
        catch (e) { if (!u.isAnonymous) throw e; await auth.signOut(); }   // حساب ضيف بلا بيانات شخصية: يكفي الخروج
      } catch (e) { signingOut = false; throw e; }
      user = null;
    },

    // ——— البيانات ———
    async load() { if (!user) return null; const d = await req('GET', '/users/' + user.uid); return d ? dec(d.fields).save || null : null; },
    save(json) { return user ? put('/users/' + user.uid, { save: json, v: Date.now() }) : Promise.resolve(); },
    board(row) { return user ? put('/board/' + user.uid, row) : Promise.resolve(); },
    week(row) { return user ? put('/weeks/' + weekId() + '/p/' + user.uid, row) : Promise.resolve(); },
    day(row) { return user ? put('/days/' + dayId() + '/p/' + user.uid, row) : Promise.resolve(); },
    /** أفضل 50 في لوحة: kind = all | week | day */
    async top(kind, n) {
      const [par, col, f] = coll(kind);
      return rows(await req('POST', par + ':runQuery', { structuredQuery: { from: [{ collectionId: col }], orderBy: [{ field: { fieldPath: f }, direction: kind === 'day' ? 'ASCENDING' : 'DESCENDING' }], limit: n || 50 } }));
    },
    /** عدد صفوف لوحة "الكل" التي تحقق شرطاً (لنسبة ندرة الميداليات) */
    async count(field, op, val) {
      const r = await req('POST', ':runAggregationQuery', { structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: 'board' }], where: { fieldFilter: { field: { fieldPath: field }, op, value: enc(val) } } }, aggregations: [{ alias: 'c', count: {} }] } });
      const a = r && r[0] && r[0].result && r[0].result.aggregateFields;
      return a && a.c ? +a.c.integerValue : 0;
    },
    /** ترتيبي = عدد من هم أفضل مني + 1 */
    async rank(kind, val) {
      const [par, col, f] = coll(kind);
      const r = await req('POST', par + ':runAggregationQuery', { structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: col }], where: { fieldFilter: { field: { fieldPath: f }, op: kind === 'day' ? 'LESS_THAN' : 'GREATER_THAN', value: enc(val) } } }, aggregations: [{ alias: 'c', count: {} }] } });
      const a = r && r[0] && r[0].result && r[0].result.aggregateFields;
      return (a && a.c ? +a.c.integerValue : 0) + 1;
    },
  };
  root.Cloud = Cloud;
})(window);
