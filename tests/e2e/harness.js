/* ============================================================
   harness.js — เครื่องมือสำหรับเขียน E2E test
   ------------------------------------------------------------
   เปิดหน้าจริงของระบบใน iframe แล้วสั่งงานเหมือนผู้ใช้กดเอง
   (คลิกปุ่ม พิมพ์ข้อมูล วาดลายเซ็น) แล้วตรวจผลจาก DOM + Store
   ============================================================ */
(function (global) {
  'use strict';

  const tests = [];

  /* ── ลงทะเบียน test ── */
  global.test = function (name, fn) { tests.push({ name: name, fn: fn }); };
  global.getTests = function () { return tests; };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  global.sleep = sleep;

  /* ── รอจนกว่าเงื่อนไขจะเป็นจริง ── */
  global.waitFor = async function (fn, label, timeout) {
    const limit = timeout || 5000;
    let waited = 0;
    for (;;) {
      let v = null;
      try { v = fn(); } catch (e) { v = null; }
      if (v) return v;
      if (waited >= limit) throw new Error('waitFor(' + (label || '') + ') หมดเวลา');
      await sleep(50);
      waited += 50;
    }
  };

  /* ══════════════════════════════════════════
     ข้อมูลตั้งต้น
     ══════════════════════════════════════════ */
  global.resetData = function () {
    localStorage.clear();
    sessionStorage.clear();
    Store.reset();
  };

  global.loginAs = function (userId) { localStorage.setItem('rvp_session', userId); };

  /* หน้าใน iframe เป็นคนละบริบทกัน — ต้องดึงข้อมูลรุ่นล่าสุดมาก่อนตรวจผล */
  global.syncStore = function () { Store.syncIfStale(); };

  /* กล่องเซ็นนี้ "กดเซ็นได้จริง" หรือไม่ (ปุ่มต้องมีและต้องไม่ถูกซ่อน) */
  global.canSign = function (ctx, key) {
    const btn = ctx.$('.sign-box[data-sign-key="' + key + '"] [data-sign-btn]');
    return !!btn && btn.style.display !== 'none';
  };

  global.U = function (id) { return Store.USERS.filter(u => u.id === id)[0]; };

  /* สร้างคำขอใหม่พร้อมลายเซ็นผู้ร้องขอ (ใช้เป็นจุดตั้งต้นของ flow) */
  global.newRequest = function (opts) {
    const o = opts || {};
    const a = U('A');
    return Store.createDraft({
      title: o.title || 'เอกสารทดสอบระบบ',
      titleEn: o.title || 'E2E test document',
      docNo: o.docNo || 'RVP-E2E-001',
      type: 'wi', purpose: 'new', purposeDetail: '',
      revision: 1,
      description: o.description || 'รายละเอียดสำหรับทดสอบ',
      relatedDept: o.relatedDept || 'ส่วนวิศวกรรม',
      effectiveDate: '12/12/2029',
      requestDate: '01/01/2026',
      dept: a.dept, empId: a.empId, requesterName: a.name,
      signatures: { requester: sigOf('A') },
      stakeholders: o.stakeholders || ['SQD', 'QC']
    }, a);
  };

  /* ลายเซ็นแบบย่อของแต่ละบทบาท (ใช้เวลาเดิน flow ด้วย Store API) */
  function sigOf(userId) {
    const u = U(userId);
    return {
      by: userId, day: 0, img: 'data:image/png;base64,iVBORw0KGgo=',
      name: u.name, position: u.position, at: '01/01/2026'
    };
  }
  global.sigOf = sigOf;

  /* แนบลายเซ็นให้ช่องที่ Store API เพิ่งประทับไว้ */
  global.stampSig = function (docId, key, userId) {
    const d = Store.getDoc(docId);
    d.signatures[key] = Object.assign({}, d.signatures[key], sigOf(userId));
    Store.save();
  };

  /* ══════════════════════════════════════════
     เปิดหน้าจริงของระบบ
     ══════════════════════════════════════════ */
  global.openApp = async function (path, userId) {
    if (userId) loginAs(userId);
    const frame = document.createElement('iframe');
    frame.src = '../../' + path;
    document.getElementById('stage').appendChild(frame);
    await new Promise(res => { frame.onload = res; });

    const ctx = { frame: frame, errors: [] };
    ctx.win = frame.contentWindow;
    ctx.win.addEventListener('error', e => ctx.errors.push(e.message));

    /* หน้าอาจเปลี่ยนเส้นทางเอง (เช่นบทบาทที่ไม่มีสิทธิ์) จึงรอให้สคริปต์ทำงานจบก่อน */
    await sleep(700);

    Object.defineProperty(ctx, 'doc', { get: () => frame.contentDocument });
    ctx.page = () => ctx.win.location.pathname.split('/').pop();
    ctx.$ = sel => ctx.doc.querySelector(sel);
    ctx.$$ = sel => Array.prototype.slice.call(ctx.doc.querySelectorAll(sel));
    ctx.text = sel => { const el = ctx.$(sel); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
    ctx.close = () => frame.remove();
    return ctx;
  };

  /* ── กรอกข้อมูลลงช่อง ── */
  global.fill = function (ctx, id, value) {
    const el = ctx.doc.getElementById(id);
    if (!el) throw new Error('ไม่พบช่อง #' + id);
    el.value = value;
    el.dispatchEvent(new ctx.win.Event('input', { bubbles: true }));
    el.dispatchEvent(new ctx.win.Event('change', { bubbles: true }));
    return el;
  };

  global.click = function (ctx, selOrEl) {
    const el = typeof selOrEl === 'string' ? ctx.$(selOrEl) : selOrEl;
    if (!el) throw new Error('ไม่พบปุ่ม ' + selOrEl);
    el.click();
    return el;
  };

  /* ── เลือกค่าจาก combobox หน่วยงาน ── */
  global.pickFromCombo = async function (ctx, inputId, label) {
    const input = ctx.doc.getElementById(inputId);
    const wrap = input.closest('.combo');
    wrap.querySelector('.combo-btn').click();
    const item = await waitFor(
      () => Array.prototype.slice.call(wrap.querySelectorAll('.combo-item'))
        .filter(b => b.textContent.trim() === label)[0],
      'combo:' + label);
    item.dispatchEvent(new ctx.win.MouseEvent('mousedown', { bubbles: true }));
    await sleep(120);
  };

  /* ── วาดลายเซ็นในกล่องที่กำหนด แล้วกดตกลง ── */
  global.signBox = async function (ctx, key) {
    const box = ctx.$('.sign-box[data-sign-key="' + key + '"]');
    if (!box) throw new Error('ไม่พบกล่องเซ็น ' + key);
    const btn = box.querySelector('[data-sign-btn]');
    if (!btn || btn.style.display === 'none') throw new Error('กล่องเซ็น ' + key + ' กดเซ็นไม่ได้');
    btn.click();

    const canvas = ctx.doc.getElementById('sign-canvas');
    const r = canvas.getBoundingClientRect();
    const ev = (type, x, y) => canvas.dispatchEvent(
      new ctx.win.PointerEvent(type, { clientX: r.left + x, clientY: r.top + y, bubbles: true }));
    ev('pointerdown', 20, 30);
    ev('pointermove', 140, 110);
    ev('pointermove', 260, 50);
    ev('pointerup', 260, 50);

    ctx.doc.getElementById('sign-modal-confirm').click();
    await sleep(200);
    return box;
  };

  /* ── กดยืนยันในกล่องยืนยัน (พร้อมหมายเหตุถ้าจำเป็น) ── */
  global.confirmDialog = async function (ctx, note) {
    const ok = await waitFor(() => ctx.doc.getElementById('cd-ok'), 'confirm dialog');
    const noteEl = ctx.doc.getElementById('cd-note');
    if (noteEl) {
      noteEl.value = note || 'ทดสอบระบบ';
      noteEl.dispatchEvent(new ctx.win.Event('input', { bubbles: true }));
    }
    ok.click();
    await sleep(400);
    syncStore();
  };

  /* ══════════════════════════════════════════
     ตรวจผล
     ══════════════════════════════════════════ */
  global.eq = function (actual, expected, label) {
    if (String(actual) !== String(expected)) {
      throw new Error((label || 'ค่าไม่ตรง') + ' → ได้ "' + actual + '" ควรเป็น "' + expected + '"');
    }
  };

  global.ok = function (value, label) {
    if (!value) throw new Error((label || 'เงื่อนไขไม่เป็นจริง'));
  };

  global.notOk = function (value, label) {
    if (value) throw new Error((label || 'ควรเป็นเท็จ แต่เป็นจริง'));
  };

  global.contains = function (haystack, needle, label) {
    if (String(haystack).indexOf(needle) === -1) {
      throw new Error((label || 'ไม่พบข้อความ') + ' → หา "' + needle + '" ไม่เจอ');
    }
  };

  global.noPageError = function (ctx, label) {
    if (ctx.errors.length) throw new Error((label || 'หน้ามี error') + ': ' + ctx.errors.join(' | '));
  };
})(window);
