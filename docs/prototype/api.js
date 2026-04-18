/* ==========================================================================
 * TELLAR — MOCK BACKEND (browser-side)
 * --------------------------------------------------------------------------
 * Simula la API que en producción sería NestJS + PlanetScale (MySQL).
 * Persistencia:
 *   - localStorage → sesión, usuarios, workspaces, tellers, shares, events
 *   - IndexedDB    → blobs pesados (recordings, KB files)
 *
 * En el /handoff hay un README que muestra cómo migrar esto a un backend
 * real reemplazando solo esta capa — los componentes del frontend no cambian.
 *
 * Cada método espejea un endpoint NestJS: GET/POST/PATCH/DELETE ...
 * ========================================================================== */

(function(global){
  'use strict';

  // ===================== STORAGE =====================
  const LS = {
    get(k, fallback){ try{ const v = localStorage.getItem('tellar:' + k); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; } },
    set(k, v){ localStorage.setItem('tellar:' + k, JSON.stringify(v)); },
    del(k){ localStorage.removeItem('tellar:' + k); }
  };

  // ===================== INDEXEDDB (for blobs) =====================
  const DB_NAME = 'tellar-blobs';
  const DB_VERSION = 1;
  let _db = null;
  function openDB(){
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('recordings'))
          db.createObjectStore('recordings', {keyPath:'id'});
        if (!db.objectStoreNames.contains('kb'))
          db.createObjectStore('kb', {keyPath:'id'});
      };
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror = e => reject(e);
    });
  }
  async function idbPut(store, record){
    const db = await openDB();
    return new Promise((ok, fail) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(record);
      tx.oncomplete = () => ok(record);
      tx.onerror = () => fail(tx.error);
    });
  }
  async function idbGet(store, id){
    const db = await openDB();
    return new Promise((ok, fail) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(id);
      req.onsuccess = () => ok(req.result);
      req.onerror = () => fail(req.error);
    });
  }
  async function idbDel(store, id){
    const db = await openDB();
    return new Promise((ok, fail) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = () => ok();
      tx.onerror = () => fail(tx.error);
    });
  }
  async function idbList(store){
    const db = await openDB();
    return new Promise((ok, fail) => {
      const tx = db.transaction(store, 'readonly');
      const out = [];
      tx.objectStore(store).openCursor().onsuccess = e => {
        const c = e.target.result;
        if (c){ out.push(c.value); c.continue(); } else ok(out);
      };
      tx.onerror = () => fail(tx.error);
    });
  }

  // ===================== HELPERS =====================
  const uid = (p='id') => p + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const now = () => Date.now();
  const delay = ms => new Promise(r => setTimeout(r, ms));

  // ===================== SEED (runs once) =====================
  function seed(){
    if (LS.get('seeded')) return;

    const userId = uid('u');
    const wsId = uid('ws');
    const tellerId = 'tlr_q2pitch';
    const shareId = 'shr_qa09fx2';

    LS.set('users', [{
      id: userId,
      email: 'martin@tellar.studio',
      name: 'Martín Echeverría',
      initials: 'M',
      provider: 'email',
      // NOTE: demo-only. Real backend hashes with argon2/bcrypt.
      password: 'demo1234',
      createdAt: now() - 86400000 * 30,
      plan: 'pro'
    }]);

    LS.set('workspaces', [{
      id: wsId,
      ownerId: userId,
      name: 'Tellar Studio',
      slug: 'tellar-studio',
      plan: 'pro',
      seats: 4,
      seatsUsed: 2,
      createdAt: now() - 86400000 * 30
    }]);

    LS.set('workspaceMembers', [
      {id: uid('m'), workspaceId: wsId, userId, role: 'owner', joinedAt: now() - 86400000 * 30},
      {id: uid('m'), workspaceId: wsId, email: 'ana@tellar.studio', name: 'Ana Torres', role: 'editor', status: 'active', joinedAt: now() - 86400000 * 5},
      {id: uid('m'), workspaceId: wsId, email: 'leo@tellar.studio', name: 'Leo Duarte', role: 'viewer', status: 'pending', joinedAt: now() - 86400000 * 1}
    ]);

    LS.set('tellers', [{
      id: tellerId,
      workspaceId: wsId,
      ownerId: userId,
      title: 'Q2 Series A pitch',
      revision: 14,
      createdAt: now() - 86400000 * 14,
      updatedAt: now() - 60000,
      theme: 'editorial-cream'
    }]);

    // Slide data — source of truth for editor + viewer + dashboard
    LS.set('slides:' + tellerId, [
      {id:'s1',  idx:1,  eyebrow:'slide 01 / cover',         title:'Cover — <em>Tellar</em>', sub:'Presentations that know when they lose you.', narrationDur:12},
      {id:'s2',  idx:2,  eyebrow:'slide 02 / the problem',   title:'The <em>problem.</em>', sub:'Every deck ships as a dead PDF. Nobody knows who read what.', narrationDur:34},
      {id:'s3',  idx:3,  eyebrow:'slide 03 / why now',       title:'Why <em>now</em>', sub:'AI finally makes a document that answers back feasible.', narrationDur:48},
      {id:'s4',  idx:4,  eyebrow:'slide 04 / the market',    title:'A <em>$34B</em> market<br/>growing 28% <em>year over year.</em>', sub:'Enterprise software is eating the last 15% of Fortune 1000 workflows.', narrationDur:82},
      {id:'s5',  idx:5,  eyebrow:'slide 05 / our wedge',     title:'Our <em>wedge.</em>', sub:'Start where DocSend ends: the moment after the deck is sent.', narrationDur:58},
      {id:'s6',  idx:6,  eyebrow:'slide 06 / product',       title:'The <em>product</em> — a short tour.', sub:'', narrationDur:101},
      {id:'s7',  idx:7,  eyebrow:'slide 07 / traction',      title:'Traction.', sub:'$1.4M ARR. 134% NRR. 61% PLG.', narrationDur:68},
      {id:'s8',  idx:8,  eyebrow:'slide 08 / model',         title:'Business <em>model.</em>', sub:'Seat-based with a usage tail on agent queries.', narrationDur:52},
      {id:'s9',  idx:9,  eyebrow:'slide 09 / the ask',       title:'The ask — <em>$18M.</em>', sub:'', narrationDur:18},
      {id:'s10', idx:10, eyebrow:'slide 10 / use of funds',  title:'Use of <em>funds.</em>', sub:'58% GTM · 32% R&D · 10% ops.', narrationDur:44},
      {id:'s11', idx:11, eyebrow:'slide 11 / unit economics',title:'Unit <em>economics.</em>', sub:'CAC payback 4.2mo · LTV/CAC 5.8×.', narrationDur:72},
      {id:'s12', idx:12, eyebrow:'slide 12 / go-to-market',  title:'Go-to-<em>market.</em>', sub:'PLG → hand-raise → enterprise AE.', narrationDur:52},
      {id:'s13', idx:13, eyebrow:'slide 13 / team',          title:'Team.', sub:'Built at Stripe, Notion, Loom.', narrationDur:93},
      {id:'s14', idx:14, eyebrow:'slide 14 / plan',          title:'The <em>18-month</em> plan.', sub:'$30M ARR by Q4 2026, without raising again.', narrationDur:40},
      {id:'s15', idx:15, eyebrow:'slide 15 / risks',         title:'Risks &amp; <em>mitigations.</em>', sub:'', narrationDur:25},
      {id:'s16', idx:16, eyebrow:'slide 16 / q&a',           title:'Q&amp;A — common <em>questions.</em>', sub:'', narrationDur:22},
      {id:'s17', idx:17, eyebrow:'slide 17 / thank you',     title:'Thank <em>you.</em>', sub:'', narrationDur:8}
    ]);

    LS.set('shares:' + tellerId, [{
      id: shareId,
      tellerId,
      slug: 'qa09fx2',
      accessMode: 'email-gated',         // public | email-gated | passphrase | invite-only
      allowedDomains: ['sequoiacap.com','a16z.com','indexventures.com','accel.com'],
      invitees: [
        {email:'sofia@sequoiacap.com',   name:'Sofia Wallenberg', status:'active',  opens: 17},
        {email:'h.tanaka@a16z.com',      name:'Hiro Tanaka',      status:'active',  opens: 4},
        {email:'marco@indexventures.com',name:'Marco Rossi',      status:'active',  opens: 2},
        {email:'elena.park@accel.com',   name:'Elena Park',       status:'pending', opens: 0}
      ],
      passphrase: '',
      perms: {
        agent: true,
        recording: true,
        download: false,
        reshare: false,
        nda: false,
        watermark: true,
        blockScreenRec: true
      },
      expiresAt: now() + 86400000 * 14,
      maxOpens: 5,
      requireOTC: true,
      createdAt: now() - 86400000 * 2
    }]);

    // Seed view events for dashboard
    const events = [];
    const viewerEmails = ['sofia@sequoiacap.com','h.tanaka@a16z.com','marco@indexventures.com','elena.park@accel.com'];
    // synthesize ~420 events across 42 unique viewers
    for (let v = 0; v < 42; v++){
      const email = v < 4 ? viewerEmails[v] : `viewer${v}@fundx.vc`;
      const sessionId = uid('sess');
      // dropout curve: most people see 1-9, then steep drop at slide 9
      const reach = Math.random() < 0.12 ? 17 : Math.random() < 0.3 ? 14 : Math.random() < 0.5 ? 9 : Math.random() < 0.8 ? 5 : 3;
      const baseT = now() - Math.floor(Math.random() * 86400000 * 5);
      for (let s = 1; s <= Math.min(reach, 17); s++){
        events.push({
          id: uid('ev'),
          type: 'slide_view',
          tellerId,
          shareId,
          sessionId,
          email,
          slideIdx: s,
          dwellMs: 8000 + Math.random() * 90000,
          at: baseT + s * 30000
        });
      }
    }
    // synthesize some agent queries
    const questions = ['unit economics?','CAC payback?','who is on the team?','what is the moat?','why $18M?','competitive landscape'];
    for (let i = 0; i < 128; i++){
      events.push({
        id: uid('ev'),
        type: 'agent_query',
        tellerId, shareId,
        email: viewerEmails[i%4],
        question: questions[i % questions.length],
        at: now() - Math.floor(Math.random() * 86400000 * 7)
      });
    }
    LS.set('events', events);

    LS.set('kb:' + tellerId, [
      {id: uid('kb'), tellerId, kind: 'pdf', name: 'Market research — Gartner 2025', pages: 42, indexed: true, bytes: 2_400_000, addedAt: now() - 86400000 * 3},
      {id: uid('kb'), tellerId, kind: 'xlsx', name: 'q2-financials.xlsx', sheets: 6, rows: 1204, indexed: true, bytes: 180_000, addedAt: now() - 86400000 * 2},
      {id: uid('kb'), tellerId, kind: 'doc', name: 'Investor FAQ — internal notes', pages: 18, indexed: true, bytes: 95_000, addedAt: now() - 86400000 * 5},
      {id: uid('kb'), tellerId, kind: 'url', name: 'company.com/case-studies', pages: 12, indexed: true, syncs: 'weekly', addedAt: now() - 86400000 * 4}
    ]);

    LS.set('recordings:' + tellerId, []); // metadata only; blobs live in IDB

    LS.set('usage', {
      workspaceId: wsId,
      month: new Date().toISOString().slice(0,7),
      agentQueries: 128,
      agentQueriesLimit: 1000,
      recordingMinutes: 47,
      recordingMinutesLimit: 300,
      storageMB: 312,
      storageMBLimit: 5000,
      seatsUsed: 2,
      seatsLimit: 5
    });

    LS.set('billing', {
      workspaceId: wsId,
      plan: 'pro',
      price: 49,
      interval: 'month',
      nextInvoice: now() + 86400000 * 18,
      card: {brand: 'visa', last4: '4242', exp: '09/28'},
      invoices: [
        {id: 'inv_' + uid(), date: now() - 86400000 * 30, amount: 49, status: 'paid'},
        {id: 'inv_' + uid(), date: now() - 86400000 * 60, amount: 49, status: 'paid'},
        {id: 'inv_' + uid(), date: now() - 86400000 * 90, amount: 49, status: 'paid'}
      ]
    });

    LS.set('session', {
      userId,
      workspaceId: wsId,
      email: 'martin@tellar.studio',
      name: 'Martín Echeverría',
      initials: 'M',
      loggedInAt: now()
    });

    LS.set('seeded', true);
  }

  // ===================== API =====================
  const api = {
    // -------- AUTH (POST /auth/*) --------
    async register({name, email, password}){
      await delay(300);
      const users = LS.get('users', []);
      if (users.find(u => u.email === email)) throw new Error('Email already registered');
      const user = {
        id: uid('u'), name, email, password,
        initials: (name||'?').split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase(),
        provider: 'email', createdAt: now(), plan: 'free'
      };
      users.push(user);
      LS.set('users', users);
      // auto-create personal workspace
      const ws = {id: uid('ws'), ownerId: user.id, name: name + "'s workspace", slug: email.split('@')[0], plan: 'free', seats: 1, seatsUsed: 1, createdAt: now()};
      LS.set('workspaces', [...LS.get('workspaces', []), ws]);
      LS.set('session', {userId: user.id, workspaceId: ws.id, email, name, initials: user.initials, loggedInAt: now()});
      return {user, workspace: ws};
    },
    async login({email, password}){
      await delay(300);
      const users = LS.get('users', []);
      const u = users.find(x => x.email === email);
      if (!u) throw new Error('No account with that email');
      if (u.password !== password) throw new Error('Wrong password');
      const ws = LS.get('workspaces', []).find(w => w.ownerId === u.id) || LS.get('workspaces', [])[0];
      LS.set('session', {userId: u.id, workspaceId: ws.id, email: u.email, name: u.name, initials: u.initials, loggedInAt: now()});
      return {user: u, workspace: ws};
    },
    async oauth(provider){ // 'google' | 'github'
      await delay(400);
      // Mock: create-or-login a predictable user per provider
      const email = provider + '@tellar.studio';
      const name = provider === 'google' ? 'Google User' : 'GitHub User';
      let users = LS.get('users', []);
      let u = users.find(x => x.email === email);
      if (!u){
        u = {id: uid('u'), name, email, provider, initials: name.split(' ').map(s=>s[0]).join(''), createdAt: now(), plan: 'free'};
        users.push(u); LS.set('users', users);
        const ws = {id: uid('ws'), ownerId: u.id, name: name + "'s workspace", slug: provider + '-ws', plan: 'free', seats: 1, seatsUsed: 1, createdAt: now()};
        LS.set('workspaces', [...LS.get('workspaces', []), ws]);
      }
      const ws = LS.get('workspaces', []).find(w => w.ownerId === u.id);
      LS.set('session', {userId: u.id, workspaceId: ws.id, email: u.email, name: u.name, initials: u.initials, loggedInAt: now()});
      return {user: u, workspace: ws};
    },
    session(){ return LS.get('session'); },
    logout(){ LS.del('session'); },

    // -------- WORKSPACES --------
    listWorkspaces(){
      const s = this.session(); if (!s) return [];
      const mine = LS.get('workspaceMembers', []).filter(m => m.userId === s.userId).map(m => m.workspaceId);
      mine.push(...LS.get('workspaces', []).filter(w => w.ownerId === s.userId).map(w => w.id));
      const ids = [...new Set(mine)];
      return LS.get('workspaces', []).filter(w => ids.includes(w.id));
    },
    switchWorkspace(workspaceId){
      const s = this.session(); if (!s) return;
      s.workspaceId = workspaceId; LS.set('session', s);
    },
    listMembers(workspaceId){
      return LS.get('workspaceMembers', []).filter(m => m.workspaceId === workspaceId);
    },
    inviteMember(workspaceId, email, role){
      const members = LS.get('workspaceMembers', []);
      members.push({id: uid('m'), workspaceId, email, name: email.split('@')[0], role, status:'pending', joinedAt: now()});
      LS.set('workspaceMembers', members);
    },
    removeMember(memberId){
      LS.set('workspaceMembers', LS.get('workspaceMembers', []).filter(m => m.id !== memberId));
    },
    updateMemberRole(memberId, role){
      const m = LS.get('workspaceMembers', []);
      m.forEach(x => { if (x.id === memberId) x.role = role; });
      LS.set('workspaceMembers', m);
    },

    // -------- TELLERS --------
    listTellers(workspaceId){ return LS.get('tellers', []).filter(t => t.workspaceId === workspaceId); },
    getTeller(id){ return LS.get('tellers', []).find(t => t.id === id); },
    createTeller({workspaceId, ownerId, title}){
      const t = {id: uid('tlr'), workspaceId, ownerId, title, revision: 1, createdAt: now(), updatedAt: now(), theme:'editorial-cream'};
      LS.set('tellers', [...LS.get('tellers', []), t]);
      LS.set('slides:' + t.id, []);
      return t;
    },
    updateTeller(id, patch){
      const ts = LS.get('tellers', []);
      ts.forEach(t => { if (t.id === id){ Object.assign(t, patch); t.updatedAt = now(); } });
      LS.set('tellers', ts);
    },
    deleteTeller(id){
      LS.set('tellers', LS.get('tellers', []).filter(t => t.id !== id));
      LS.del('slides:' + id);
      LS.del('shares:' + id);
      LS.del('recordings:' + id);
      LS.del('kb:' + id);
      // also wipe view events for this teller
      const ev = LS.get('events', []).filter(e => e.tellerId !== id);
      LS.set('events', ev);
    },

    // -------- SLIDES --------
    listSlides(tellerId){ return LS.get('slides:' + tellerId, []); },
    updateSlide(tellerId, slideId, patch){
      const s = LS.get('slides:' + tellerId, []);
      s.forEach(x => { if (x.id === slideId) Object.assign(x, patch); });
      LS.set('slides:' + tellerId, s);
      this.updateTeller(tellerId, {});
      return s.find(x => x.id === slideId);
    },
    addSlide(tellerId){
      const s = LS.get('slides:' + tellerId, []);
      const idx = s.length + 1;
      const ns = {id: uid('s'), idx, eyebrow: `slide ${String(idx).padStart(2,'0')}`, title: 'Untitled', sub: '', narrationDur: 0};
      s.push(ns); LS.set('slides:' + tellerId, s); return ns;
    },
    deleteSlide(tellerId, slideId){
      let s = LS.get('slides:' + tellerId, []).filter(x => x.id !== slideId);
      s = s.map((x, i) => ({...x, idx: i+1}));
      LS.set('slides:' + tellerId, s);
    },

    // -------- SHARE (POST /shares, PATCH /shares/:id) --------
    getShare(tellerId){ return (LS.get('shares:' + tellerId, [])[0]) || null; },
    updateShare(tellerId, patch){
      const shares = LS.get('shares:' + tellerId, []);
      if (!shares.length) return null;
      Object.assign(shares[0], patch);
      LS.set('shares:' + tellerId, shares);
      return shares[0];
    },
    revokeShare(tellerId){
      const shares = LS.get('shares:' + tellerId, []);
      if (!shares.length) return;
      shares[0].revoked = true; shares[0].expiresAt = now();
      LS.set('shares:' + tellerId, shares);
    },
    // Checks if a given viewer email is allowed to open the share
    authorizeViewer(tellerId, email){
      const share = this.getShare(tellerId);
      if (!share || share.revoked || share.expiresAt < now()) return {ok:false, reason:'expired'};
      if (share.accessMode === 'public') return {ok:true, share};
      if (share.accessMode === 'email-gated'){
        if (!email) return {ok:false, reason:'email-required'};
        const domain = '@' + email.split('@')[1];
        if (share.allowedDomains?.length && !share.allowedDomains.some(d => domain.endsWith(d.replace('@','')))) return {ok:false, reason:'domain-blocked'};
        return {ok:true, share};
      }
      if (share.accessMode === 'invite-only'){
        if (!email) return {ok:false, reason:'email-required'};
        if (!share.invitees?.some(i => i.email === email)) return {ok:false, reason:'not-invited'};
        return {ok:true, share};
      }
      if (share.accessMode === 'passphrase'){
        return {ok:false, reason:'passphrase-required', share};
      }
      return {ok:true, share};
    },

    // -------- EVENTS (for analytics) --------
    track(event){
      const events = LS.get('events', []);
      events.push({id: uid('ev'), at: now(), ...event});
      LS.set('events', events);
    },
    queryEvents({tellerId, type, since, until}){
      return LS.get('events', []).filter(e =>
        (!tellerId || e.tellerId === tellerId) &&
        (!type || e.type === type) &&
        (!since || e.at >= since) &&
        (!until || e.at <= until)
      );
    },

    // -------- DASHBOARD (aggregations) --------
    dashboardMetrics(tellerId){
      const slides = this.listSlides(tellerId);
      const events = this.queryEvents({tellerId, type:'slide_view'});
      const uniqViewers = new Set(events.map(e => e.email));
      const sessions = {};
      events.forEach(e => {
        sessions[e.sessionId] = Math.max(sessions[e.sessionId] || 0, e.slideIdx);
      });
      const completedSessions = Object.values(sessions).filter(r => r === slides.length).length;
      const totalSessions = Object.keys(sessions).length || 1;
      const completion = Math.round((completedSessions / totalSessions) * 100);

      // funnel: per-slide unique viewers
      const funnel = slides.map(s => {
        const seenBy = new Set(events.filter(e => e.slideIdx === s.idx).map(e => e.email));
        return {...s, views: seenBy.size};
      });
      const maxViews = funnel[0]?.views || 1;
      funnel.forEach((r, i) => {
        r.pct = Math.round((r.views / maxViews) * 100);
        r.drop = i === 0 ? 0 : Math.max(0, Math.round(((funnel[i-1].views - r.views) / Math.max(funnel[i-1].views,1)) * 100));
      });

      // find biggest drop
      let biggestDrop = {drop:0, idx:0, title:''};
      funnel.forEach(r => { if (r.drop > biggestDrop.drop) biggestDrop = {drop:r.drop, idx:r.idx, title:r.title}; });

      // agent queries
      const agentQueries = this.queryEvents({tellerId, type:'agent_query'}).length;
      const agentQueriesToday = this.queryEvents({tellerId, type:'agent_query', since: now() - 86400000}).length;

      // avg session duration
      const sessionDurations = {};
      events.forEach(e => { sessionDurations[e.sessionId] = (sessionDurations[e.sessionId] || 0) + (e.dwellMs || 0); });
      const avgMs = Object.values(sessionDurations).reduce((a,b)=>a+b,0) / (Object.keys(sessionDurations).length || 1);

      // viewers ranked
      const perEmail = {};
      events.forEach(e => {
        if (!perEmail[e.email]) perEmail[e.email] = {email: e.email, slidesSeen: new Set(), dwellMs: 0, lastSeen: 0};
        perEmail[e.email].slidesSeen.add(e.slideIdx);
        perEmail[e.email].dwellMs += e.dwellMs || 0;
        perEmail[e.email].lastSeen = Math.max(perEmail[e.email].lastSeen, e.at);
      });
      const viewers = Object.values(perEmail).map(v => ({
        email: v.email,
        name: v.email.split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g, c=>c.toUpperCase()),
        slidesSeen: v.slidesSeen.size,
        totalSlides: slides.length,
        dwellMs: v.dwellMs,
        lastSeen: v.lastSeen
      })).sort((a,b) => b.slidesSeen - a.slidesSeen);

      return {
        totalSlides: slides.length,
        uniqueViewers: uniqViewers.size,
        completion,
        biggestDrop,
        agentQueries,
        agentQueriesToday,
        avgSessionMs: avgMs,
        funnel,
        viewers
      };
    },

    // -------- KNOWLEDGE BASE --------
    listKB(tellerId){ return LS.get('kb:' + tellerId, []); },
    async addKBFile(tellerId, file){
      const rec = {
        id: uid('kb'), tellerId, kind: kindFromMime(file.type, file.name),
        name: file.name, bytes: file.size, addedAt: now(), indexed: false
      };
      await idbPut('kb', {id: rec.id, blob: file});
      // fake indexing
      setTimeout(() => {
        const kb = LS.get('kb:' + tellerId, []);
        kb.forEach(k => { if (k.id === rec.id) k.indexed = true; });
        LS.set('kb:' + tellerId, kb);
      }, 1400);
      const kb = LS.get('kb:' + tellerId, []); kb.push(rec); LS.set('kb:' + tellerId, kb);
      return rec;
    },
    addKBUrl(tellerId, url){
      const rec = {id: uid('kb'), tellerId, kind:'url', name: url.replace(/^https?:\/\//,''), pages: 1, indexed: false, addedAt: now()};
      const kb = LS.get('kb:' + tellerId, []); kb.push(rec); LS.set('kb:' + tellerId, kb);
      setTimeout(() => {
        const k2 = LS.get('kb:' + tellerId, []);
        k2.forEach(k => { if (k.id === rec.id) k.indexed = true; });
        LS.set('kb:' + tellerId, k2);
      }, 1600);
      return rec;
    },
    async removeKB(tellerId, id){
      LS.set('kb:' + tellerId, LS.get('kb:' + tellerId, []).filter(k => k.id !== id));
      try{ await idbDel('kb', id); }catch(e){}
    },

    // -------- RECORDINGS --------
    listRecordings(tellerId){ return LS.get('recordings:' + tellerId, []); },
    async saveRecording(tellerId, {slideId, slideIdx, blob, durationMs, mode}){
      const rec = {id: uid('rec'), tellerId, slideId, slideIdx, mode, durationMs, bytes: blob.size, mime: blob.type, createdAt: now()};
      await idbPut('recordings', {id: rec.id, blob});
      const all = LS.get('recordings:' + tellerId, []);
      // replace any prior recording for the same slide
      const filtered = all.filter(r => r.slideId !== slideId);
      filtered.push(rec);
      LS.set('recordings:' + tellerId, filtered);
      return rec;
    },
    async getRecordingBlob(id){
      const r = await idbGet('recordings', id);
      return r?.blob || null;
    },
    async deleteRecording(tellerId, id){
      LS.set('recordings:' + tellerId, LS.get('recordings:' + tellerId, []).filter(r => r.id !== id));
      try{ await idbDel('recordings', id); }catch(e){}
    },

    // -------- USAGE & BILLING --------
    getUsage(){ return LS.get('usage'); },
    getBilling(){ return LS.get('billing'); },
    updatePlan(plan){
      const b = LS.get('billing');
      const prices = {free: 0, pro: 49, team: 149, enterprise: 0};
      b.plan = plan; b.price = prices[plan] ?? b.price;
      LS.set('billing', b);
      return b;
    },

    // -------- CLAUDE AGENT --------
    // Builds the prompt from slides + KB + transcripts and calls window.claude
    async askAgent({tellerId, question, history=[]}){
      const slides = this.listSlides(tellerId);
      const kb = this.listKB(tellerId);
      const rec = this.listRecordings(tellerId);
      const slidesCtx = slides.map(s =>
        `[slide ${s.idx}] ${stripHtml(s.title)}${s.sub ? ' — ' + stripHtml(s.sub) : ''}`
      ).join('\n');
      const kbCtx = kb.map(k => `[${k.kind.toUpperCase()}] ${k.name}${k.pages ? ` (${k.pages} p.)` : ''}`).join('\n');
      const recCtx = rec.length ? rec.map(r => `[audio] slide ${r.slideIdx} · ${Math.round(r.durationMs/1000)}s · transcribed`).join('\n') : '(no recordings yet)';

      const systemPrompt =
`You are the Tellar agent for a deck ("teller"). You answer viewer questions using only the deck, the creator's narration, and the attached knowledge base. Rules:
- Cite sources inline using this EXACT syntax:
  [cite:slide:N]     for a slide reference
  [cite:audio:N]     for narration of slide N
  [cite:kb:NAME]     for a knowledge-base source
- Keep answers short (2-4 sentences), conversational, no bullet lists unless essential.
- When you don't know, say so and suggest what the creator could add.
- End with one "Sources: ..." line listing the citations plainly.

DECK — ${slides.length} slides:
${slidesCtx}

KNOWLEDGE BASE:
${kbCtx || '(empty)'}

RECORDINGS:
${recCtx}`;

      const messages = [
        ...history.map(h => ({role: h.role, content: h.content})),
        {role: 'user', content: question}
      ];

      try{
        const text = await global.claude.complete({system: systemPrompt, messages});
        this.track({type:'agent_query', tellerId, question, answer: text});
        return text;
      }catch(e){
        return `I couldn't reach the model. (${e.message})`;
      }
    },

    // Copilot: propose rewrite / structure / narration fix
    async copilotSuggest({tellerId, slideId, kind}){
      const slide = this.listSlides(tellerId).find(s => s.id === slideId);
      if (!slide) return '';
      const prompts = {
        rewrite: `You are rewriting a pitch deck slide to be punchier while staying editorial in tone. Slide current title: "${stripHtml(slide.title)}". Subtitle: "${stripHtml(slide.sub)}". Return ONE alternative title (<= 14 words) and ONE subtitle (<= 24 words), separated by a single pipe "|". Use italics on the strongest word by wrapping it in <em>...</em>. No preamble.`,
        tighten: `Make this slide subtitle more specific and concrete. Current: "${stripHtml(slide.sub)}". Return only the new subtitle.`,
        narration: `Write a 20-second narration script for a pitch slide titled "${stripHtml(slide.title)}" and subtitle "${stripHtml(slide.sub)}". Conversational, first person, no filler words.`,
        structure: `You are proposing a NEW slide to insert after "${stripHtml(slide.title)}" in a pitch deck. Viewers have been asking repeated questions that suggest a gap in the narrative around this section. Draft a single new slide that fills that gap. Return exactly ONE title (<= 10 words) and ONE subtitle (<= 24 words), separated by a single pipe "|". Wrap the strongest word of the title in <em>...</em>. No preamble, no explanation.`
      };
      try{
        return await global.claude.complete(prompts[kind] || prompts.rewrite);
      }catch(e){ return 'Copilot is offline. ' + e.message; }
    },

    // -------- UTILS --------
    _raw(){ return {LS}; },
    _reset(){ Object.keys(localStorage).filter(k => k.startsWith('tellar:')).forEach(k => localStorage.removeItem(k)); }
  };

  function stripHtml(s){ return (s||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim(); }
  function kindFromMime(mime, name){
    const ext = (name||'').split('.').pop().toLowerCase();
    if (ext === 'pdf' || /pdf/.test(mime)) return 'pdf';
    if (['xlsx','xls','csv'].includes(ext)) return 'xlsx';
    if (['doc','docx','txt','md'].includes(ext)) return 'doc';
    return 'doc';
  }

  // ===================== INIT =====================
  seed();

  // ===================== EXPORT =====================
  global.TellarAPI = api;
  global.TellarAPI.requireSession = function(redirectTo='auth.html'){
    if (!api.session()){ window.location.href = redirectTo; return false; }
    return true;
  };
  global.TellarAPI.citeToHtml = function(text){
    // Transform [cite:slide:N] → colored badges
    return text
      .replace(/\[cite:slide:(\d+)\]/g, '<span class="cite" data-type="slide" data-ref="$1">slide · $1</span>')
      .replace(/\[cite:audio:(\d+)\]/g, '<span class="cite audio" data-type="audio" data-ref="$1">audio · slide $1</span>')
      .replace(/\[cite:kb:([^\]]+)\]/g, '<span class="cite kb" data-type="kb" data-ref="$1">kb · $1</span>')
      .replace(/\n/g, '<br/>');
  };
})(window);
