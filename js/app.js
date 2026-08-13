/* ============================================================
   app.js — โครงร่วมของทุกหน้า
   auth guard · sidebar · แถบผู้ใช้ · สลับภาษา · แจ้งเตือน · โหมดสาธิต
   ============================================================ */
(function (global) {
  'use strict';

  const t = () => global.I18N;
  const S = () => global.Store;

  const SIDEBAR_KEY = 'rvp_sidebar_collapsed';

  /* ---------------- icons ---------------- */
  const IC = {
    globe: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
    logout: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>',
    bell: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
    clock: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    refresh: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>',
    dots: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>',
    eye: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    xCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
    sync: '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 5 21 10 16 10"></polyline><polyline points="3 19 3 14 8 14"></polyline><path d="M19.4 9a7.5 7.5 0 0 0-12.6-2.8L3 10"></path><path d="M4.6 15a7.5 7.5 0 0 0 12.6 2.8L21 14"></path></svg>'
  };

  const NOTI_ICON = {
    'n.sent':      { bg: 'bg-blue-50',    fg: 'text-blue-600',    d: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z' },
    'n.approved':  { bg: 'bg-emerald-50', fg: 'text-emerald-600', d: 'M20 6L9 17l-5-5' },
    'n.returned':  { bg: 'bg-orange-50',  fg: 'text-orange-600',  d: 'M23 4v6h-6M20.49 15a9 9 0 1 1-2.12-9.36L23 10' },
    'n.rejected':  { bg: 'bg-rose-50',    fg: 'text-rose-600',    d: 'M18 6L6 18M6 6l12 12' },
    'n.signed':    { bg: 'bg-violet-50',  fg: 'text-violet-600',  d: 'M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z' },
    'n.allSigned': { bg: 'bg-emerald-50', fg: 'text-emerald-600', d: 'M20 6L9 17l-5-5' },
    'n.registered':{ bg: 'bg-teal-50',    fg: 'text-teal-700',    d: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
    'n.expired':   { bg: 'bg-red-50',     fg: 'text-red-600',     d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01' },
    'n.draft':     { bg: 'bg-slate-100',  fg: 'text-slate-500',   d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }
  };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ============================================================
     AUTH GUARD
     ============================================================ */
  function requireLogin() {
    const u = S().currentUser();
    if (!u) {
      const here = location.pathname.split('/').pop() || 'index.html';
      sessionStorage.setItem('rvp_after_login', here + location.search);
      location.replace('login.html');
      return null;
    }
    return u;
  }

  /* ============================================================
     SIDEBAR
     ============================================================ */
  function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const wrapper = document.getElementById('main-wrapper');
    if (!sidebar || !wrapper) return;

    function setCollapsed(on) {
      sidebar.classList.toggle('collapsed', on);
      wrapper.style.marginLeft = on ? '72px' : '260px';
      localStorage.setItem(SIDEBAR_KEY, on ? '1' : '0');
    }
    if (localStorage.getItem(SIDEBAR_KEY) === '1') setCollapsed(true);

    const c = document.getElementById('collapse-btn');
    const e = document.getElementById('expand-btn');
    if (c) c.addEventListener('click', () => setCollapsed(true));
    if (e) e.addEventListener('click', () => setCollapsed(false));
  }

  /* ============================================================
     เติมข้อมูลผู้ใช้ลง sidebar / topbar + เมนูตามสิทธิ์
     ============================================================ */
  function fillUser(user) {
    const lang = t().getLang();
    const name = lang === 'en' ? user.nameEn : user.name;
    const roleTxt = t().t('role.' + user.role);
    const roleSub = t().t('role.' + user.role + '.sub');

    document.querySelectorAll('[data-user-initials]').forEach(el => {
      el.textContent = user.initials;
      el.style.background = user.color;
    });
    document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = name; });
    document.querySelectorAll('[data-user-role]').forEach(el => { el.textContent = roleTxt; });
    document.querySelectorAll('[data-user-rolesub]').forEach(el => { el.textContent = roleSub; });
    document.querySelectorAll('[data-role-badge]').forEach(el => {
      el.textContent = t().t('role.label') + ': ' + roleTxt;
    });

    /* เมนูที่เห็นได้เฉพาะบาง role */
    document.querySelectorAll('[data-role-only]').forEach(el => {
      const allow = el.getAttribute('data-role-only').split(',').map(s => s.trim());
      el.style.display = allow.indexOf(user.role) === -1 ? 'none' : '';
    });
    /* ลิงก์ "งานของฉัน" ชี้ไปหน้า workspace ของ role นั้น */
    document.querySelectorAll('[data-my-work]').forEach(el => { el.setAttribute('href', user.home); });
  }

  /* ============================================================
     ปุ่มสลับภาษา
     ============================================================ */
  function initLang() {
    let btn = document.getElementById('lang-btn');
    if (!btn) {
      /* ถ้าหน้าไหนยังไม่มีปุ่ม ให้แทรกไว้หน้าปุ่มผู้ใช้ */
      const anchor = document.getElementById('notif-btn');
      if (anchor && anchor.parentElement) {
        btn = document.createElement('button');
        btn.id = 'lang-btn';
        btn.className = 'w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-400 shadow-sm hover:bg-slate-50 hover:text-blue-600 transition-colors';
        anchor.parentElement.insertBefore(btn, anchor.nextSibling);
      }
    }
    if (!btn) return;
    function paint() {
      btn.innerHTML = IC.globe + '<span class="ml-1.5 text-[12px] font-bold tracking-wide">' +
        (t().getLang() === 'th' ? 'TH' : 'EN') + '</span>';
      btn.classList.add('gap-0', 'px-3');
      btn.style.width = 'auto';
      btn.setAttribute('title', t().t('common.language'));
    }
    paint();
    btn.addEventListener('click', () => { t().toggle(); });
    document.addEventListener('langchange', paint);
  }

  /* ============================================================
     แจ้งเตือน (ข้อ 9)
     ============================================================ */
  function relDay(day) {
    const diff = S().today() - day;
    if (diff <= 0) return t().t('common.justNow');
    return diff + ' ' + t().t('common.dayAgo');
  }

  /* วันจำลอง: 0 → D+0, 3 → D+3, -2 → D-2 */
  function dayLabel(n) {
    const v = Number(n) || 0;
    return 'D' + (v < 0 ? '' : '+') + v;
  }

  function initNotifications(user) {
    const btn = document.getElementById('notif-btn');
    if (!btn) return;
    btn.classList.add('relative');

    const panel = document.createElement('div');
    panel.id = 'notif-panel';
    panel.className = 'fixed z-[1200] w-[380px] max-w-[92vw] rounded-2xl bg-white border border-slate-100 shadow-[0_18px_48px_rgba(15,23,42,0.18)] overflow-hidden hidden';
    panel.innerHTML =
      '<div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">' +
        '<p class="text-[14px] font-bold text-slate-900" data-i18n="common.notifications"></p>' +
        '<button id="notif-readall" class="text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors" data-i18n="common.markAllRead"></button>' +
      '</div>' +
      '<div id="notif-list" class="max-h-[380px] overflow-y-auto"></div>';
    document.body.appendChild(panel);

    function place() {
      const r = btn.getBoundingClientRect();
      panel.style.top = (r.bottom + 10) + 'px';
      const w = panel.offsetWidth || 380;
      panel.style.left = Math.max(12, Math.min(r.right - w, window.innerWidth - w - 12)) + 'px';
    }

    function render() {
      const list = S().notificationsFor(user.role);
      const box = panel.querySelector('#notif-list');
      const lang = t().getLang();

      if (!list.length) {
        box.innerHTML = '<p class="px-5 py-10 text-center text-[13px] text-slate-400">' +
          esc(t().t('common.noNotification')) + '</p>';
      } else {
        box.innerHTML = list.slice(0, 20).map(n => {
          const ic = NOTI_ICON[n.key] || NOTI_ICON['n.draft'];
          const title = lang === 'en' && n.titleEn ? n.titleEn : n.title;
          /* ถ้าเอกสารนั้นเป็นคิวงานของผู้ใช้ (หรือเป็นคำขอของตัวเอง) ให้เปิดหน้างาน ไม่ใช่หน้ากระดาษ */
          const nDoc = S().getDoc(n.docId);
          const nPerm = nDoc ? S().permissions(nDoc, user) : null;
          const toWork = !!(nPerm && (nPerm.approve || nPerm.sign || nPerm.register ||
                            (user.role === 'requester' && nDoc.requesterId === user.id)));
          return '<a href="' + (toWork ? 'create.html' : 'document.html') + '?id=' + encodeURIComponent(n.docId) + '" data-nid="' + esc(n.id) + '" ' +
            'class="flex items-start gap-3 px-5 py-3.5 border-b border-slate-50 no-underline hover:bg-slate-50 transition-colors' +
            (n.read ? '' : ' bg-blue-50/40') + '">' +
              '<span class="w-8 h-8 rounded-xl ' + ic.bg + ' ' + ic.fg + ' flex items-center justify-center flex-shrink-0 mt-0.5">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + ic.d + '"></path></svg>' +
              '</span>' +
              '<span class="flex-1 min-w-0">' +
                '<span class="block text-[13px] font-semibold text-slate-800 leading-snug">' + esc(t().t(n.key)) + '</span>' +
                '<span class="block text-[12px] text-slate-500 truncate mt-0.5">' + esc(n.docNo) + ' · ' + esc(title) + '</span>' +
                '<span class="block text-[11px] text-slate-400 mt-1">' + esc(relDay(n.day)) + '</span>' +
              '</span>' +
              (n.read ? '' : '<span class="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2"></span>') +
            '</a>';
        }).join('');
      }
      t().apply(panel);
      paintBadge();
    }

    function paintBadge() {
      const n = S().unreadCount(user.role);
      let dot = btn.querySelector('[data-notif-dot]');
      if (!dot) {
        dot = document.createElement('span');
        dot.setAttribute('data-notif-dot', '');
        btn.appendChild(dot);
      }
      if (n > 0) {
        dot.className = 'absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white';
        dot.textContent = n > 9 ? '9+' : String(n);
        dot.style.display = '';
      } else {
        dot.style.display = 'none';
      }
      /* ซ่อนจุดแดงเดิมที่ hardcode ไว้ใน HTML */
      btn.querySelectorAll('span.bg-red-500:not([data-notif-dot])').forEach(s => { s.style.display = 'none'; });
    }

    function open() { render(); panel.classList.remove('hidden'); place(); }
    function close() { panel.classList.add('hidden'); }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.classList.contains('hidden') ? open() : close();
    });
    panel.addEventListener('click', e => {
      const a = e.target.closest('[data-nid]');
      if (a) S().markRead(a.getAttribute('data-nid'));
      e.stopPropagation();
    });
    panel.querySelector('#notif-readall').addEventListener('click', () => {
      S().markAllRead(user.role); render();
    });
    document.addEventListener('click', close);
    window.addEventListener('resize', () => { if (!panel.classList.contains('hidden')) place(); });
    document.addEventListener('storechange', paintBadge);
    document.addEventListener('langchange', () => { if (!panel.classList.contains('hidden')) render(); });

    paintBadge();
  }

  /* ============================================================
     เมนูผู้ใช้ (ออกจากระบบ / สลับบัญชีสำหรับสาธิต)
     ============================================================ */
  function initUserMenu(user) {
    const btn = document.getElementById('user-btn');
    if (!btn) return;

    const menu = document.createElement('div');
    menu.className = 'fixed z-[1200] w-[260px] rounded-2xl bg-white border border-slate-100 shadow-[0_18px_48px_rgba(15,23,42,0.18)] overflow-hidden hidden';
    document.body.appendChild(menu);

    function render() {
      const lang = t().getLang();
      menu.innerHTML =
        '<div class="px-5 py-4 border-b border-slate-100">' +
          '<p class="text-[13px] font-bold text-slate-900">' + esc(lang === 'en' ? user.nameEn : user.name) + '</p>' +
          '<p class="text-[11.5px] text-slate-400 mt-0.5">' + esc(t().t('role.' + user.role + '.sub')) + '</p>' +
          '<p class="text-[11.5px] text-slate-400 mt-0.5">' + esc(user.empId) + ' · ' + esc(lang === 'en' ? user.deptEn : user.dept) + '</p>' +
        '</div>' +
        '<div class="p-2">' +
          '<p class="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-300 uppercase tracking-widest">' + esc(t().t('login.demo')) + '</p>' +
          S().USERS.map(u =>
            '<button data-switch="' + u.id + '" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors text-left' +
            (u.id === user.id ? ' bg-blue-50/70' : '') + '">' +
              '<span class="w-7 h-7 rounded-lg text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0" style="background:' + u.color + '">' + esc(u.initials) + '</span>' +
              '<span class="flex-1 min-w-0">' +
                '<span class="block text-[12.5px] font-semibold text-slate-700 truncate">' + esc(lang === 'en' ? u.nameEn : u.name) + '</span>' +
                '<span class="block text-[11px] text-slate-400">' + esc(t().t('role.' + u.role)) + '</span>' +
              '</span>' +
            '</button>').join('') +
          '<div class="my-2 h-px bg-slate-100"></div>' +
          '<button id="do-logout" class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-red-50 text-red-500 transition-colors text-left text-[13px] font-semibold">' +
            IC.logout + '<span>' + esc(t().t('nav.logout')) + '</span>' +
          '</button>' +
        '</div>';

      menu.querySelectorAll('[data-switch]').forEach(b => {
        b.addEventListener('click', () => {
          const u = S().loginAs(b.getAttribute('data-switch'));
          /* สลับบัญชีสาธิต → เริ่มที่หน้าแรกเหมือนตอนเข้าระบบ */
          if (u) location.href = 'index.html';
        });
      });
      menu.querySelector('#do-logout').addEventListener('click', () => {
        S().logout(); location.href = 'login.html';
      });
    }

    function place() {
      const r = btn.getBoundingClientRect();
      menu.style.top = (r.bottom + 10) + 'px';
      const w = menu.offsetWidth || 260;
      menu.style.left = Math.max(12, Math.min(r.right - w, window.innerWidth - w - 12)) + 'px';
    }

    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (menu.classList.contains('hidden')) { render(); menu.classList.remove('hidden'); place(); }
      else menu.classList.add('hidden');
    });
    menu.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', () => menu.classList.add('hidden'));
    document.addEventListener('langchange', () => { if (!menu.classList.contains('hidden')) render(); });
  }

  /* ============================================================
     แถบโหมดสาธิต — จำลองเวลา / รีเซ็ตข้อมูล
     ============================================================ */
  function initDemoBar() {
    const bar = document.createElement('div');
    bar.id = 'demo-bar';
    bar.className = 'fixed bottom-4 left-4 z-[1100] flex items-center gap-2 rounded-2xl px-3 py-2';
    bar.style.cssText += 'background:rgba(15,23,42,.94);backdrop-filter:blur(6px);box-shadow:0 10px 30px rgba(15,23,42,.35)';
    document.body.appendChild(bar);

    function render() {
      bar.innerHTML =
        '<span class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-300 pr-2 border-r border-white/15">' +
          '<span class="w-1.5 h-1.5 rounded-full bg-amber-300"></span>' + esc(t().t('demo.mode')) +
        '</span>' +
        '<span class="flex items-center gap-1.5 text-[12px] text-white/80 px-1">' + IC.clock +
          esc(t().t('demo.day')) + ' <b class="text-white">' + dayLabel(S().today()) + '</b></span>' +
        '<button id="demo-adv" class="flex items-center gap-1.5 rounded-xl bg-white/12 hover:bg-white/22 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors">' +
          IC.refresh + esc(t().t('demo.advance')) + '</button>' +
        '<button id="demo-reset" class="rounded-xl px-3 py-1.5 text-[12px] font-semibold text-white/60 hover:text-white transition-colors">' +
          esc(t().t('demo.reset')) + '</button>' +
        '<button id="demo-hide" class="w-6 h-6 rounded-lg text-white/40 hover:text-white transition-colors" title="hide">&times;</button>';

      bar.querySelector('#demo-adv').addEventListener('click', () => {
        S().advanceDay(1);
        location.reload();
      });
      bar.querySelector('#demo-reset').addEventListener('click', () => {
        if (confirm(t().t('demo.confirmReset'))) { S().reset(); location.reload(); }
      });
      bar.querySelector('#demo-hide').addEventListener('click', () => bar.remove());
    }
    render();
    document.addEventListener('langchange', render);
  }

  /* ============================================================
     ตัวช่วยแสดงผลที่ใช้ร่วมกันในตาราง
     ============================================================ */
  function statusPill(status) {
    const s = S().statusStyle(status);
    return '<span class="status-pill ' + s.pill + '"><span class="dot ' + s.dot + '"></span>' +
           esc(t().t('status.' + status)) + '</span>';
  }

  function progressBar(doc) {
    const done = S().signedCount(doc), total = S().totalSigners(doc);
    const pct = total ? Math.round(done / total * 100) : 0;
    const color = pct >= 100 ? 'bg-emerald-500' : 'bg-blue-500';
    return '<div class="flex items-center gap-2">' +
      '<div class="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full ' + color + '" style="width:' + pct + '%"></div></div>' +
      '<span class="text-[12.5px] font-semibold text-slate-600">' + done + '/' + total + '</span></div>';
  }

  function ageText(doc) {
    const st = S().STATUS;
    if (doc.status === st.DRAFT) return '<span class="text-slate-300">' + esc(t().t('common.none')) + '</span>';
    const age = S().ageOf(doc);
    const rem = S().remainingOf(doc);
    const active = [st.PENDING_APPROVAL, st.PENDING_SIGN].indexOf(doc.status) !== -1;
    if (!active) return '<span class="text-slate-500">' + age + ' ' + esc(t().t('common.days')) + '</span>';
    const cls = rem <= 2 ? 'text-red-500 font-semibold' : (rem <= 4 ? 'text-amber-600 font-semibold' : 'text-slate-500');
    return '<span class="' + cls + '">' + age + ' / ' + doc.dueDays + ' ' + esc(t().t('common.days')) + '</span>';
  }

  /* page: หน้าปลายทาง — ค่าเริ่มต้นคือหน้ากระดาษ PDF (document.html)
     ส่งเป็น 'create.html' เมื่ออยากให้เปิด "งานที่ทำ" (ฟอร์ม) แทน
     tone: สีของปุ่มหลัก — 'blue' (ค่าเริ่มต้น) หรือ 'orange' สำหรับงานที่ถูกส่งกลับ */
  const BTN_TONE = {
    blue:   'bg-blue-600 hover:bg-blue-700 shadow-[0_4px_10px_rgba(37,99,235,0.25)]',
    orange: 'bg-orange-500 hover:bg-orange-600 shadow-[0_4px_10px_rgba(249,115,22,0.28)]',
    violet: 'bg-violet-600 hover:bg-violet-700 shadow-[0_4px_10px_rgba(109,40,217,0.25)]',
    teal:   'bg-teal-600 hover:bg-teal-700 shadow-[0_4px_10px_rgba(13,148,136,0.25)]'
  };

  function docLink(doc, label, primary, page, tone) {
    const cls = primary
      ? 'row-btn inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-[13px] font-semibold text-white no-underline transition-colors ' +
        (BTN_TONE[tone] || BTN_TONE.blue)
      : 'row-btn inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-600 no-underline hover:bg-slate-50 transition-colors';
    return '<a href="' + (page || 'document.html') + '?id=' + encodeURIComponent(doc.id) + '" class="' + cls + '">' + esc(label) + '</a>';
  }

  /* งานเดินมาถึงคิวของผู้ใช้คนนี้หรือยัง — ถ้าใช่ คืนปุ่มที่พาไป "หน้างาน" (create.html)
     ให้ทำงานและเซ็นในตำแหน่งของตัวเอง ไม่ใช่หน้ากระดาษ PDF · ถ้าไม่ใช่คืน null */
  function myTurnLink(doc, user) {
    const p = S().permissions(doc, user);
    let key = null, tone = 'blue';
    if (p.ownerSign)     { key = 'act.sign';     tone = 'blue';   }
    else if (p.approve)  { key = 'act.review';   tone = 'blue';   }
    else if (p.sign)     { key = 'act.sign';     tone = 'violet'; }
    else if (p.qcSign)   { key = 'act.sign';     tone = 'teal';   }
    else if (p.register) { key = 'act.register'; tone = 'teal';   }
    if (!key) return null;
    return docLink(doc, t().t(key), true, 'create.html', tone);
  }

  /* ช่องว่างแทนปุ่ม — ใช้กับแถวที่ผู้ใช้ทำอะไรต่อไม่ได้
     ขนาดเท่าปุ่มจริงเพื่อให้คอลัมน์ยังเรียงตรงกัน */
  function idleBox(icon, title) {
    return '<span class="row-btn inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-slate-300 cursor-not-allowed"' +
      (title ? ' title="' + esc(title) + '"' : '') + '>' + icon + '</span>';
  }

  /* คำขอสิ้นสุดแล้ว (เช่น หมดอายุ) */
  function noAction(title) { return idleBox(IC.xCircle, title); }

  /* คำขออยู่ที่คนอื่น — รอผลอยู่ ยังทำอะไรไม่ได้ */
  function waitAction(title) { return idleBox(IC.sync, title); }

  function emptyRow(cols, msg) {
    return '<tr><td colspan="' + cols + '" class="px-5 py-14 text-center text-[13px] text-slate-400">' +
      esc(msg || t().t('common.empty')) + '</td></tr>';
  }

  /* ============================================================
     ตัวกรองแท็บ (ใช้กับ .filter-tab เดิม)
     ============================================================ */
  function initFilterTabs(onChange) {
    const tabs = Array.prototype.slice.call(document.querySelectorAll('.filter-tab'));
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const was = btn.classList.contains('active');
        tabs.forEach(b => b.classList.remove('active'));
        if (!was) btn.classList.add('active');
        const active = document.querySelector('.filter-tab.active');
        onChange(active ? active.getAttribute('data-filter') || '' : '');
      });
    });
  }

  /* ============================================================
     modal ยืนยันแบบใช้ซ้ำได้ (มี/ไม่มีช่องหมายเหตุ)
     ============================================================ */
  function confirmDialog(opts) {
    return new Promise(resolve => {
      const o = Object.assign({ title: '', sub: '', tone: 'blue', needNote: false, noteRequired: false, okText: null }, opts || {});
      const tones = {
        blue:    { bg: '#eff6ff', fg: '#3b82f6', btn: '#2563eb' },
        green:   { bg: '#f0fdf4', fg: '#22c55e', btn: '#16a34a' },
        red:     { bg: '#fef2f2', fg: '#ef4444', btn: '#dc2626' },
        amber:   { bg: '#fffbeb', fg: '#f59e0b', btn: '#d97706' },
        violet:  { bg: '#f5f3ff', fg: '#8b5cf6', btn: '#6d28d9' }
      };
      const c = tones[o.tone] || tones.blue;

      const back = document.createElement('div');
      back.className = 'fixed inset-0 z-[3000] flex items-center justify-center';
      back.style.background = 'rgba(15,23,42,0.45)';
      back.innerHTML =
        '<div class="bg-white rounded-2xl shadow-2xl flex flex-col items-center p-8 gap-4" style="width:360px;max-width:92vw;">' +
          '<div class="w-12 h-12 rounded-full flex items-center justify-center" style="background:' + c.bg + '">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="' + c.fg + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
          '</div>' +
          '<div class="text-center">' +
            '<h3 class="text-[16px] font-bold text-slate-900">' + esc(o.title) + '</h3>' +
            (o.sub ? '<p class="text-[12.5px] text-slate-400 mt-1 leading-relaxed">' + esc(o.sub) + '</p>' : '') +
          '</div>' +
          (o.needNote ?
            '<div class="flex flex-col gap-1.5 w-full">' +
              '<label class="text-[13px] font-semibold text-slate-700">' + esc(t().t('common.remark')) +
              (o.noteRequired ? ' <span class="text-red-500">*</span>' : '') + '</label>' +
              '<textarea id="cd-note" rows="4" placeholder="' + esc(t().t('common.remarkPh')) + '" class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all placeholder:text-slate-300 resize-none"></textarea>' +
              '<p id="cd-err" class="hidden text-[12px] text-red-500"></p>' +
            '</div>' : '') +
          '<div class="grid grid-cols-2 gap-3 w-full">' +
            '<button id="cd-cancel" class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">' + esc(t().t('common.cancel')) + '</button>' +
            '<button id="cd-ok" class="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors" style="background:' + c.btn + '">' + esc(o.okText || t().t('common.confirm')) + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(back);

      const note = back.querySelector('#cd-note');
      if (note) setTimeout(() => note.focus(), 60);

      function done(v) { back.remove(); document.removeEventListener('keydown', onKey); resolve(v); }
      function onKey(e) { if (e.key === 'Escape') done(null); }
      document.addEventListener('keydown', onKey);

      back.querySelector('#cd-cancel').addEventListener('click', () => done(null));
      back.addEventListener('click', e => { if (e.target === back) done(null); });
      back.querySelector('#cd-ok').addEventListener('click', () => {
        const v = note ? note.value.trim() : '';
        if (o.noteRequired && !v) {
          const err = back.querySelector('#cd-err');
          err.textContent = t().t('dv.reasonRequired');
          err.classList.remove('hidden');
          note.classList.add('border-red-400');
          return;
        }
        done({ note: v });
      });
    });
  }

  function toast(msg, tone) {
    const c = tone === 'red' ? '#dc2626' : (tone === 'amber' ? '#d97706' : '#0f766e');
    const el = document.createElement('div');
    el.className = 'fixed left-1/2 -translate-x-1/2 z-[4000] rounded-xl px-5 py-3 text-[13px] font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.3)]';
    el.style.cssText += 'top:20px;background:' + c + ';opacity:0;transition:opacity .2s,transform .2s;transform:translate(-50%,-8px)';
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translate(-50%,0)'; });
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }, 2600);
  }

  /* ============================================================
     INIT
     ============================================================ */
  function initChrome(opts) {
    const o = opts || {};
    const user = requireLogin();
    if (!user) return null;

    S().runExpiryCheck();
    initSidebar();
    fillUser(user);
    initLang();
    initNotifications(user);
    initUserMenu(user);
    if (o.demoBar !== false) initDemoBar();

    document.addEventListener('langchange', () => fillUser(user));
    t().apply();
    return user;
  }


  /* ============================================================
     อัปเดตหน้าจอตามความเป็นจริงของ flow (real time)
     — บทบาทอื่นทำงานในแท็บ/หน้าต่างอื่น แล้วหน้านี้ต้องเห็นทันที
     — กลับมาที่แท็บนี้เมื่อไหร่ก็ดึงข้อมูลล่าสุดมาวาดใหม่
     — ตรวจเอกสารหมดเวลาลงนามเป็นระยะ สถานะจะได้ขยับเองตามกำหนด
     ============================================================ */
  function liveRefresh(fn, opts) {
    const o = opts || {};
    const every = o.every || 2000;
    let queued = false;

    /* รวมหลายสัญญาณที่มาพร้อมกันให้วาดครั้งเดียว
       (ใช้ setTimeout ไม่ใช่ requestAnimationFrame เพราะแท็บที่ไม่ได้แสดงผล
        จะไม่เรียก rAF เลย ทำให้ข้อมูลค้างจนกว่าจะกลับมาดู) */
    function paint() {
      if (queued) return;
      queued = true;
      setTimeout(function () { queued = false; fn(); }, 0);
    }

    function tick(force) {
      const changed = S().syncIfStale();
      const expired = S().runExpiryCheck();      /* หมดเวลา → ระบบส่งกลับเอง */
      if (changed || expired || force) paint();
    }

    document.addEventListener('storechange', paint);
    window.addEventListener('focus', function () { tick(true); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(true); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) tick(true); });
    const timer = setInterval(function () { if (!document.hidden) tick(false); }, every);

    return { refresh: paint, check: tick, stop: function () { clearInterval(timer); } };
  }

  /* ============================================================
     ตารางงาน — เรียงลำดับ + แบ่งหน้า (ค่าเริ่มต้น 10 แถว/หน้า)
     ============================================================ */
  const STATUS_ORDER = ['DRAFT','RETURNED','EXPIRED_RETURNED','PENDING_OWNER','PENDING_APPROVAL','PENDING_SIGN','SENT_TO_QC','PENDING_QC_MANAGER','REGISTERED','REJECTED'];

  function newTableState(key, dir, per) {
    return { page: 1, per: per || 10, key: key || 'age', dir: dir || 'desc' };
  }

  function sortValue(d, key, lang) {
    switch (key) {
      case 'id':        return d.id || '';
      case 'docNo':     return d.docNo || '';
      case 'requester': return (lang === 'en' ? d.requesterNameEn : d.requesterName) || '';
      case 'title':     return Store.docTitle(d, lang) || '';
      case 'type':      return Store.docTypeLabel(d.type, lang) || '';
      case 'status':    return STATUS_ORDER.indexOf(d.status);
      case 'age':       return Store.ageOf(d);
      case 'due':       return Store.remainingOf(d);
      case 'progress':  return Store.totalSigners(d) ? Store.signedCount(d) / Store.totalSigners(d) : -1;
      default:          return 0;
    }
  }

  function sortDocs(list, state, lang) {
    const sign = state.dir === 'asc' ? 1 : -1;
    return list.slice().sort((a, b) => {
      const va = sortValue(a, state.key, lang), vb = sortValue(b, state.key, lang);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sign;
      return String(va).localeCompare(String(vb), 'th') * sign;
    });
  }

  /* คืนแถวเฉพาะหน้าปัจจุบัน + ข้อมูลสำหรับแถบแบ่งหน้า */
  function pageOf(list, state, lang) {
    const sorted = sortDocs(list, state, lang);
    const pages = Math.max(1, Math.ceil(sorted.length / state.per));
    if (state.page > pages) state.page = pages;
    if (state.page < 1) state.page = 1;
    const from = (state.page - 1) * state.per;
    return { rows: sorted.slice(from, from + state.per), total: sorted.length, pages: pages, from: from };
  }

  /* แถบแบ่งหน้าใต้ตาราง */
  function paintPager(el, state, info, onChange) {
    if (!el) return;
    const tr = k => I18N.t(k);
    if (!info.total) { el.innerHTML = ''; el.className = ''; return; }

    el.className = 'flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5 text-[13px] text-slate-500';
    el.innerHTML =
      '<div class="flex items-center gap-2">' +
        '<span>' + esc(tr('common.show')) + '</span>' +
        '<div class="relative">' +
          '<select data-per class="appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-1.5 text-[13px] text-slate-700 outline-none focus:border-blue-500 cursor-pointer">' +
            [10, 25, 50].map(n => '<option value="' + n + '"' + (state.per === n ? ' selected' : '') + '>' + n + '</option>').join('') +
          '</select>' +
          '<span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
          '</span>' +
        '</div>' +
        '<span>' + esc(tr('common.items')) + '</span>' +
      '</div>' +
      '<p class="text-slate-400">' + esc(tr('common.page')) + ' ' + state.page + ' ' + esc(tr('common.of')) + ' ' + info.pages +
        ' · ' + esc(tr('common.total')) + ' ' + info.total + ' ' + esc(tr('common.items')) + '</p>' +
      '<div class="flex items-center gap-2">' +
        '<button data-page="prev"' + (state.page <= 1 ? ' disabled' : '') +
          ' class="rounded-xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors">← ' + esc(tr('common.prev')) + '</button>' +
        '<button data-page="next"' + (state.page >= info.pages ? ' disabled' : '') +
          ' class="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors">' + esc(tr('common.next')) + ' →</button>' +
      '</div>';

    el.querySelector('[data-per]').addEventListener('change', function () {
      state.per = Number(this.value); state.page = 1; onChange();
    });
    el.querySelectorAll('[data-page]').forEach(b => {
      b.addEventListener('click', () => {
        state.page += (b.getAttribute('data-page') === 'next' ? 1 : -1);
        onChange();
      });
    });
  }

  /* หัวตารางที่กดเรียงลำดับได้ — ใส่ data-sort="key" ที่ <th> */
  function bindSortHeaders(root, state, onChange) {
    (root || document).querySelectorAll('th[data-sort]').forEach(th => {
      const key = th.getAttribute('data-sort');
      th.classList.add('cursor-pointer', 'select-none');
      th.title = I18N.t('common.sort');

      if (!th.dataset.bound) {
        th.dataset.bound = '1';
        th.addEventListener('click', () => {
          if (state.key === key) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
          else { state.key = key; state.dir = 'asc'; }
          state.page = 1;
          onChange();
        });
      }

      th.querySelectorAll('[data-caret]').forEach(c => c.remove());
      const caret = document.createElement('span');
      caret.setAttribute('data-caret', '1');
      caret.className = 'ml-1 inline-block align-middle ' + (state.key === key ? 'text-blue-600' : 'text-slate-300');
      caret.style.fontSize = '9px';
      caret.textContent = state.key === key ? (state.dir === 'asc' ? '▲' : '▼') : '▲▼';
      th.appendChild(caret);
    });
  }

  global.App = {
    esc, initChrome, requireLogin, initSidebar, initLang, initFilterTabs,
    statusPill, progressBar, ageText, docLink, myTurnLink, noAction, waitAction, emptyRow,
    confirmDialog, toast, relDay, dayLabel, IC,
    newTableState, sortDocs, pageOf, paintPager, bindSortHeaders,
    liveRefresh
  };
})(window);
