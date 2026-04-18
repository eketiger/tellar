/* ==========================================================================
 * TELLAR — SHARED UI HELPERS
 * --------------------------------------------------------------------------
 * Mounts the standard topbar interactions (teller breadcrumb switcher,
 * avatar menu) on any page that loads it. Keeps each page from re-implementing
 * the same handlers.
 *
 * Usage:
 *   1. Include `<script src="tellar-ui.js"></script>` after `api.js`.
 *   2. Call `TellarUI.mountCrumbsSwitcher({ container, current, onSwitch })`
 *      to inject the dropdown into a `.crumbs` block.
 *   3. Call `TellarUI.mountAvatarMenu({ host })` to upgrade a `.avatar` element
 *      with a dropdown menu (account/workspace/sign out).
 * ========================================================================== */

(function(global){
  'use strict';

  const STYLE_ID = '__tellar_ui_style';
  const SHARED_STYLE = `
    .crumbs .teller-switcher{display:inline-block;vertical-align:baseline;position:relative;font-family:var(--mono);font-size:11px;letter-spacing:.05em}
    .crumbs .ts-btn{background:none;border:none;padding:0;font-family:var(--serif);font-size:inherit;color:var(--ink);font-style:normal;min-width:0;cursor:pointer;display:inline-flex;align-items:baseline;gap:6px;letter-spacing:0;text-transform:none}
    .crumbs .ts-btn:hover{color:var(--accent)}
    .crumbs .ts-btn .ts-title{font-family:var(--serif);font-size:inherit;font-style:normal;color:inherit;text-align:left;font-weight:500}
    .crumbs .ts-btn .ts-chev{font-size:10px;color:var(--ink-3);transition:transform .2s}
    .crumbs .ts-btn:hover .ts-chev{color:var(--accent)}
    .ts-menu{position:absolute;top:calc(100% + 8px);left:0;min-width:300px;background:var(--panel);border:1px solid var(--line-2);box-shadow:0 12px 40px rgba(0,0,0,.5);z-index:150;display:none}
    .ts-menu.open{display:block}
    .ts-menu-head{padding:10px 14px;font-family:var(--mono);font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-3);border-bottom:1px solid var(--line)}
    .ts-item{padding:12px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;border-bottom:1px solid var(--line);transition:background .15s}
    .ts-item:hover{background:var(--panel-2)}
    .ts-item:last-child{border-bottom:none}
    .ts-item.active{background:rgba(244,185,66,.06)}
    .ts-item .ts-dot{width:6px;height:6px;border-radius:50%;background:var(--ink-3);flex-shrink:0}
    .ts-item.active .ts-dot{background:var(--accent)}
    .ts-item-body{flex:1;min-width:0}
    .ts-item-title{font-family:var(--serif);font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ts-item-meta{font-family:var(--mono);font-size:9px;color:var(--ink-3);letter-spacing:.05em;margin-top:2px;text-transform:uppercase}
    .ts-new{padding:12px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;background:var(--panel-2);border-top:1px solid var(--line);color:var(--accent);font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase}
    .ts-new:hover{background:rgba(244,185,66,.08)}

    .avatar{cursor:pointer;position:relative}
    .av-menu{position:absolute;top:calc(100% + 8px);right:0;min-width:240px;background:var(--panel);border:1px solid var(--line-2);box-shadow:0 12px 40px rgba(0,0,0,.5);z-index:150;display:none;font-family:var(--mono);font-size:11px;letter-spacing:.05em;text-align:left}
    .av-menu.open{display:block}
    .av-head{padding:14px;border-bottom:1px solid var(--line)}
    .av-name{font-family:var(--serif);font-size:14px;font-weight:500;color:var(--ink);font-style:normal}
    .av-email{font-size:10px;color:var(--ink-3);letter-spacing:.05em;margin-top:2px}
    .av-item{display:block;padding:11px 14px;color:var(--ink-2);text-decoration:none;border-bottom:1px solid var(--line);transition:background .15s;width:100%;background:none;border-left:none;border-right:none;border-top:none;font-family:inherit;font-size:inherit;letter-spacing:inherit;cursor:pointer;text-align:left}
    .av-item:hover{background:var(--panel-2);color:var(--accent)}
    .av-item:last-child{border-bottom:none}
    .av-item.danger{color:var(--bad)}
    .av-item.danger:hover{background:rgba(220,82,82,.08);color:var(--bad)}

    .modal-overlay{position:fixed;inset:0;background:rgba(12,13,15,.85);backdrop-filter:blur(6px);z-index:300;display:flex;align-items:center;justify-content:center;padding:40px}
    .modal{max-width:480px;width:100%;background:var(--panel);border:1px solid var(--line-2);box-shadow:0 20px 60px rgba(0,0,0,.6);font-family:var(--mono);color:var(--ink)}
    .modal-head{padding:18px 22px;border-bottom:1px solid var(--line);font-family:var(--serif);font-size:18px;font-weight:500;font-style:normal}
    .modal-head em{color:var(--accent);font-style:italic}
    .modal-body{padding:22px;font-size:12px;color:var(--ink-2);line-height:1.6}
    .modal-body label{display:block;font-family:var(--mono);font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--ink-3);margin-bottom:8px}
    .modal-body input[type="text"]{width:100%;background:var(--bg-2);border:1px solid var(--line);color:var(--ink);font-family:var(--serif);font-size:16px;padding:12px 14px;outline:none;transition:border .2s}
    .modal-body input[type="text"]:focus{border-color:var(--accent)}
    .modal-foot{padding:14px 22px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:10px;background:var(--panel-2)}
  `;

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = SHARED_STYLE;
    document.head.appendChild(s);
  }

  // Track open menus so click-outside closes them all
  const _openMenus = new Set();
  document.addEventListener('click', () => {
    _openMenus.forEach(el => el.classList.remove('open'));
    _openMenus.clear();
  });

  function toggleMenu(el){
    if (el.classList.contains('open')){
      el.classList.remove('open');
      _openMenus.delete(el);
    } else {
      // close other open menus first
      _openMenus.forEach(o => o.classList.remove('open'));
      _openMenus.clear();
      el.classList.add('open');
      _openMenus.add(el);
    }
  }

  /**
   * Inject the teller switcher into a crumbs container.
   * @param {Object} opts
   * @param {HTMLElement|string} opts.container — the .crumbs element (or its selector)
   * @param {string} opts.current — current teller id
   * @param {string} [opts.before] — breadcrumb text before the switcher (default: 'workspace › tellers ›')
   * @param {string} [opts.after] — optional active segment after the switcher (e.g. 'share', 'editing')
   * @param {Function} [opts.onSwitch] — fn(tellerId) called when user picks a different teller. Default: navigates to current page with ?teller=<id>
   * @param {Function} [opts.onCreate] — fn() to open the new-teller flow. Default: simple modal
   */
  function mountCrumbsSwitcher(opts){
    injectStyle();
    const container = typeof opts.container === 'string' ? document.querySelector(opts.container) : opts.container;
    if (!container) return;
    const session = global.TellarAPI?.session();
    if (!session) return;
    const tellers = global.TellarAPI.listTellers(session.workspaceId);
    const current = global.TellarAPI.getTeller(opts.current);
    if (!current) return;

    const beforeHTML = opts.before != null ? opts.before : '<a href="dashboard.html">workspace</a><span class="sep">›</span><a href="dashboard.html">tellers</a><span class="sep">›</span>';
    const afterHTML = opts.after ? `<span class="sep">›</span><span class="active">${opts.after}</span>` : '';

    container.innerHTML = `
      ${beforeHTML}
      <span class="teller-switcher">
        <button class="ts-btn" id="__tsBtn" title="Switch tellar">
          <span class="ts-title">${escapeHtml(current.title)}</span>
          <span class="ts-chev">▾</span>
        </button>
        <div class="ts-menu" id="__tsMenu">
          <div class="ts-menu-head">Your tellars</div>
          <div id="__tsList"></div>
          <div class="ts-new" id="__tsNew">+ New tellar</div>
        </div>
      </span>
      ${afterHTML}
    `;

    const list = container.querySelector('#__tsList');
    list.innerHTML = tellers.map(t => {
      const slides = global.TellarAPI.listSlides(t.id);
      const share = global.TellarAPI.getShare(t.id);
      return `<div class="ts-item ${t.id === opts.current ? 'active' : ''}" data-id="${t.id}">
        <div class="ts-dot"></div>
        <div class="ts-item-body">
          <div class="ts-item-title">${escapeHtml(t.title)}</div>
          <div class="ts-item-meta">rev ${t.revision} · ${slides.length} slides · ${share ? 'shared' : 'not shared'}</div>
        </div>
      </div>`;
    }).join('');

    list.addEventListener('click', e => {
      const item = e.target.closest('.ts-item'); if (!item) return;
      const id = item.dataset.id;
      if (id === opts.current){ /* no-op */ return; }
      if (opts.onSwitch) opts.onSwitch(id);
      else {
        localStorage.setItem('currentTellerId', id);
        const u = new URL(location.href);
        u.searchParams.set('teller', id);
        location.href = u.toString();
      }
    });

    const btn = container.querySelector('#__tsBtn');
    const menu = container.querySelector('#__tsMenu');
    btn.addEventListener('click', e => { e.stopPropagation(); toggleMenu(menu); });

    container.querySelector('#__tsNew').addEventListener('click', e => {
      e.stopPropagation();
      menu.classList.remove('open'); _openMenus.delete(menu);
      if (opts.onCreate) opts.onCreate();
      else openNewTellerModal();
    });
  }

  /**
   * Upgrade a `.avatar` element with the standard dropdown menu.
   * @param {Object} opts
   * @param {HTMLElement|string} opts.host — the .avatar element (or selector)
   */
  function mountAvatarMenu(opts){
    injectStyle();
    const host = typeof opts.host === 'string' ? document.querySelector(opts.host) : opts.host;
    if (!host) return;
    const session = global.TellarAPI?.session();
    if (!session) return;

    // If host already has a span (initials), preserve it
    const initials = session.initials || (session.name?.[0] || 'T').toUpperCase();
    if (!host.querySelector('span')){
      host.innerHTML = `<span>${initials}</span>`;
    } else {
      host.querySelector('span').textContent = initials;
    }

    const menu = document.createElement('div');
    menu.className = 'av-menu';
    menu.innerHTML = `
      <div class="av-head">
        <div class="av-name">${escapeHtml(session.name || '—')}</div>
        <div class="av-email">${escapeHtml(session.email || '—')}</div>
      </div>
      <a class="av-item" href="dashboard.html">→ Dashboard</a>
      <a class="av-item" href="settings.html">→ Account settings</a>
      <a class="av-item" href="settings.html#workspace">→ Workspace</a>
      <a class="av-item" href="settings.html#billing">→ Billing &amp; usage</a>
      <button class="av-item danger" id="__avSignOut">→ Sign out</button>
    `;
    host.appendChild(menu);
    host.style.cursor = 'pointer';
    host.addEventListener('click', e => { e.stopPropagation(); toggleMenu(menu); });
    menu.addEventListener('click', e => e.stopPropagation()); // don't close on link clicks until they navigate
    menu.querySelector('#__avSignOut').addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm('Sign out?')) return;
      global.TellarAPI.logout();
      location.href = 'auth.html';
    });
  }

  function openNewTellerModal(){
    if (document.getElementById('__newTellerModal')) return;
    const session = global.TellarAPI?.session();
    if (!session) return;

    const m = document.createElement('div');
    m.id = '__newTellerModal'; m.className = 'modal-overlay';
    m.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-head">New <em>tellar</em></div>
        <div class="modal-body">
          <label>Working title</label>
          <input type="text" id="__newTellerTitle" placeholder="e.g. Q3 board update" autofocus/>
          <p style="font-family:var(--mono);font-size:10px;color:var(--ink-3);letter-spacing:.05em;margin-top:12px;line-height:1.6">
            A new tellar starts empty. You can import slides, record narration, and share it — all from the editor.
          </p>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="__nwCancel">Cancel</button>
          <button class="btn btn-primary" id="__nwCreate">Create &amp; open editor</button>
        </div>
      </div>`;
    m.addEventListener('click', () => m.remove());
    document.body.appendChild(m);
    setTimeout(() => document.getElementById('__newTellerTitle').focus(), 50);

    const create = () => {
      const title = document.getElementById('__newTellerTitle').value.trim() || 'Untitled tellar';
      const t = global.TellarAPI.createTeller({workspaceId: session.workspaceId, ownerId: session.userId, title});
      global.TellarAPI.addSlide(t.id);
      localStorage.setItem('currentTellerId', t.id);
      location.href = 'editor.html?teller=' + t.id;
    };
    document.getElementById('__nwCancel').addEventListener('click', () => m.remove());
    document.getElementById('__nwCreate').addEventListener('click', create);
    document.getElementById('__newTellerTitle').addEventListener('keydown', e => { if (e.key === 'Enter') create(); });
  }

  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  global.TellarUI = { mountCrumbsSwitcher, mountAvatarMenu, openNewTellerModal };
})(window);
