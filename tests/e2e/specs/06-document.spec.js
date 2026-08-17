/* ============================================================
   หน้ารายละเอียดเอกสาร + หน้ากระดาษ (PDF)
   ============================================================ */

test('document: หน้ากระดาษมีครบ 2 หน้า พร้อมลายเซ็นทุกช่อง', async () => {
  resetData();
  const doc = newRequest({ docNo: 'RVP-E2E-DOC', stakeholders: ['SQD'] });
  const id = doc.id;
  Store.send(id, U('A'));
  Store.ownerSign(id, U('B')); stampSig(id, 'owner', 'B');
  Store.approve(id, U('C')); stampSig(id, 'approver', 'C');
  Store.sign(id, U('D'));
  const live = Store.getDoc(id);
  live.stakeholders[0].sigImg = 'data:image/png;base64,iVBORw0KGgo=';
  live.stakeholders[0].signName = U('D').name;
  live.stakeholders[0].signAt = '04/01/2026';
  live.stakeholders[0].signPosition = U('D').position;
  Store.save();
  Store.qcStaffSign(id, U('E')); stampSig(id, 'qcStaff', 'E');
  Store.register(id, U('F')); stampSig(id, 'qcManager', 'F');

  const ctx = await openApp('document.html?id=' + id, 'A');
  eq(ctx.$$('.paper').length, 2, 'ต้องมีกระดาษ 2 หน้า');

  const paper = ctx.$$('.paper').map(p => p.textContent).join(' ').replace(/\s+/g, ' ');
  ['A', 'B', 'C', 'D', 'E', 'F'].forEach(uid => {
    contains(paper, U(uid).name, 'หน้ากระดาษต้องมีชื่อผู้ลงนาม ' + uid);
  });
  contains(paper, U('F').position, 'ต้องแสดงตำแหน่งผู้ลงนามด้วย');

  /* logo 1 + ลายเซ็น 6 ช่อง */
  eq(ctx.$$('.paper img').length, 7, 'ต้องมีภาพลายเซ็นครบทุกช่อง');
  noPageError(ctx, 'หน้าเอกสาร');
  ctx.close();
});

test('document: แผงข้อมูลแสดงทุกช่องที่ผู้ใช้กรอก', async () => {
  resetData();
  const doc = newRequest({
    docNo: 'RVP-E2E-INFO',
    description: 'รายละเอียดที่ผู้ใช้กรอกเอง',
    relatedDept: 'แผนกซ่อมบำรุง'
  });

  const ctx = await openApp('document.html?id=' + doc.id, 'A');
  const info = ctx.text('#info-scroll');
  ['RVP-E2E-INFO', 'แผนกซ่อมบำรุง', '12/12/2029', '01/01/2026', 'รายละเอียดที่ผู้ใช้กรอกเอง']
    .forEach(v => contains(info, v, 'แผงข้อมูลต้องแสดง ' + v));
  noPageError(ctx, 'หน้าเอกสาร');
  ctx.close();
});

test('document: ไทม์ไลน์บันทึกครบทุกขั้นของ flow', async () => {
  resetData();
  const doc = newRequest({ docNo: 'RVP-E2E-HIST', stakeholders: ['SQD'] });
  const id = doc.id;
  Store.send(id, U('A'));
  Store.ownerSign(id, U('B'));
  Store.approve(id, U('C'));
  Store.sign(id, U('D'));
  Store.qcStaffSign(id, U('E'));
  Store.register(id, U('F'));

  const actions = Store.getDoc(id).history.map(h => h.action).join('>');
  ['create', 'send', 'ownerSign', 'approve', 'sign', 'toQC', 'qcStaffSign', 'register']
    .forEach(a => contains(actions, a, 'ประวัติต้องมีขั้นตอน ' + a));

  const ctx = await openApp('document.html?id=' + id, 'A');
  const steps = ctx.$$('#info-scroll li p').map(p => p.textContent.trim());
  ok(steps.length >= 8, 'ไทม์ไลน์ต้องแสดงครบทุกขั้น');
  noPageError(ctx, 'หน้าเอกสาร');
  ctx.close();
});
