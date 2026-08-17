/* ============================================================
   หน้างานของแต่ละบทบาท — การ์ดสรุป · ตาราง · อัปเดต real time
   ============================================================ */

const WORKSPACES = [
  { user: 'A', page: 'role-requester.html', role: 'requester', cards: [
      ['c-draft', ['DRAFT']],
      ['c-pending', ['PENDING_OWNER', 'PENDING_APPROVAL']],
      ['c-returned', ['RETURNED', 'REJECTED', 'EXPIRED_RETURNED']],
      ['c-signing', ['PENDING_SIGN']] ] },
  { user: 'B', page: 'role-owner.html', role: 'owner', cards: [
      ['c-queue', ['PENDING_OWNER']],
      ['c-approved', ['PENDING_APPROVAL', 'PENDING_SIGN', 'SENT_TO_QC', 'PENDING_QC_MANAGER', 'REGISTERED']],
      ['c-returned', ['RETURNED', 'REJECTED']] ] },
  { user: 'C', page: 'role-approver.html', role: 'approver', cards: [
      ['c-queue', ['PENDING_APPROVAL']],
      ['c-approved', ['PENDING_SIGN', 'SENT_TO_QC', 'PENDING_QC_MANAGER', 'REGISTERED']],
      ['c-returned', ['RETURNED', 'REJECTED']] ] },
  { user: 'E', page: 'role-qc.html', role: 'qc', cards: [
      ['c-queue', ['SENT_TO_QC']],
      ['c-registered', ['REGISTERED']],
      ['c-incoming', ['PENDING_QC_MANAGER']] ] },
  { user: 'F', page: 'role-qc-manager.html', role: 'qcManager', cards: [
      ['c-queue', ['PENDING_QC_MANAGER']],
      ['c-registered', ['REGISTERED']],
      ['c-incoming', ['SENT_TO_QC']] ] }
];

test('workspace: ทุกหน้าเปิดได้ ไม่มี error', async () => {
  resetData();
  const pages = [
    ['A', 'index.html'], ['A', 'role-requester.html'], ['B', 'role-owner.html'],
    ['C', 'role-approver.html'], ['D', 'role-stakeholder.html'], ['E', 'role-qc.html'],
    ['F', 'role-qc-manager.html'], ['A', 'track.html'], ['A', 'create.html'],
    ['A', 'document.html?id=DAR012']
  ];
  for (const [user, page] of pages) {
    const ctx = await openApp(page, user);
    eq(ctx.page(), page.split('?')[0], 'ต้องอยู่ที่หน้า ' + page);
    noPageError(ctx, page);
    ctx.close();
  }
});

test('workspace: ตัวเลขบนการ์ดตรงกับจำนวนแถวในแท็บ', async () => {
  resetData();
  for (const w of WORKSPACES) {
    const ctx = await openApp(w.page, w.user);
    const list = Store.docsForRole(w.role, w.user);
    for (const [id, statuses] of w.cards) {
      const shown = Number(ctx.doc.getElementById(id).textContent);
      const rows = list.filter(d => statuses.indexOf(d.status) !== -1).length;
      eq(shown, rows, w.role + ' การ์ด #' + id);
    }
    noPageError(ctx, w.page);
    ctx.close();
  }
});

test('workspace: หน้างานอัปเดตเองเมื่อมีงานใหม่เข้ามา (real time)', async () => {
  resetData();
  const ctx = await openApp('role-owner.html', 'B');
  const before = Number(ctx.doc.getElementById('c-queue').textContent);

  loginAs('B');                              /* งานถูกส่งจากอีกหน้าต่างหนึ่ง */
  const doc = newRequest({ docNo: 'RVP-E2E-RT' });
  Store.send(doc.id, U('A'));

  await waitFor(() => Number(ctx.doc.getElementById('c-queue').textContent) === before + 1,
                'คิวของเจ้าของเอกสารต้องเพิ่มเอง', 8000);
  await waitFor(() => ctx.text('#rows').indexOf('RVP-E2E-RT') !== -1,
                'แถวใหม่ต้องขึ้นเอง', 8000);
  noPageError(ctx, 'หน้างานเจ้าของเอกสาร');
  ctx.close();
});

test('workspace: คอลัมน์หมายเหตุแสดงเหตุผลที่ถูกส่งกลับ', async () => {
  resetData();
  const doc = newRequest({ docNo: 'RVP-E2E-RMK' });
  Store.send(doc.id, U('A'));
  Store.returnForEdit(doc.id, U('B'), 'ขาดเอกสารแนบสำคัญ');

  const ctx = await openApp('role-requester.html', 'A');
  const heads = ctx.$$('thead th').map(th => th.textContent.trim());
  contains(heads.join('|'), I18N.t('common.remark'), 'ต้องมีคอลัมน์หมายเหตุ');

  fill(ctx, 'search', 'RVP-E2E-RMK');
  await sleep(300);
  const row = await waitFor(
    () => ctx.$$('#rows tr').filter(r => r.textContent.indexOf('RVP-E2E-RMK') !== -1)[0],
    'แถวเอกสารที่ถูกส่งกลับ');
  eq(row.children.length, heads.length, 'จำนวนช่องต้องเท่ากับหัวตาราง');
  contains(row.textContent, 'ขาดเอกสารแนบสำคัญ', 'ต้องเห็นหมายเหตุในตาราง');
  noPageError(ctx, 'หน้างานผู้จัดทำ');
  ctx.close();
});
