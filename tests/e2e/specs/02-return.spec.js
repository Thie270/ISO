/* ============================================================
   เอกสารที่ถูกส่งกลับไปแก้ไข
   ============================================================ */

function atQC() {
  const doc = newRequest({ docNo: 'RVP-E2E-RET' });
  Store.send(doc.id, U('A'));
  Store.ownerSign(doc.id, U('B')); stampSig(doc.id, 'owner', 'B');
  Store.approve(doc.id, U('C')); stampSig(doc.id, 'approver', 'C');
  Store.sign(doc.id, U('D'));
  Store.sign(doc.id, U('D'));
  return doc.id;
}

test('return: ส่งกลับแล้วลายเซ็นทุกช่องต้องถูกล้าง', async () => {
  resetData();
  const id = atQC();
  eq(Store.getDoc(id).status, 'SENT_TO_QC', 'ต้องเดินมาถึงแผนกควบคุมคุณภาพก่อน');

  Store.returnForEdit(id, U('E'), 'ข้อมูลไม่ครบ กรุณาแก้ไข');
  const doc = Store.getDoc(id);
  eq(doc.status, 'RETURNED', 'ต้องกลับเป็นสถานะส่งกลับ');
  eq(Object.keys(doc.signatures).length, 0, 'ลายเซ็นต้องถูกล้างทุกช่อง');
  eq(doc.stakeholders.filter(s => s.signed).length, 0, 'ผู้เกี่ยวข้องต้องกลับมาเป็นยังไม่เซ็น');
  eq(doc.lastRemark, 'ข้อมูลไม่ครบ กรุณาแก้ไข', 'ต้องเก็บหมายเหตุไว้');
});

test('return: ทุกบทบาทกลับมาลงนามใหม่ได้จนจบ flow', async () => {
  resetData();
  const id = atQC();
  Store.returnForEdit(id, U('E'), 'แก้ไขก่อน');

  Store.send(id, U('A')); stampSig(id, 'requester', 'A');
  Store.ownerSign(id, U('B')); stampSig(id, 'owner', 'B');
  Store.approve(id, U('C')); stampSig(id, 'approver', 'C');
  Store.sign(id, U('D'));
  Store.sign(id, U('D'));
  eq(Store.getDoc(id).status, 'SENT_TO_QC', 'รอบสองต้องเดินถึงแผนกควบคุมคุณภาพได้');

  ok(Store.permissions(Store.getDoc(id), U('E')).qcSign, 'เจ้าหน้าที่ต้องลงนามรอบสองได้');
  Store.qcStaffSign(id, U('E')); stampSig(id, 'qcStaff', 'E');
  ok(Store.permissions(Store.getDoc(id), U('F')).register, 'ผู้จัดการแผนกต้องขึ้นทะเบียนรอบสองได้');
  Store.register(id, U('F')); stampSig(id, 'qcManager', 'F');
  eq(Store.getDoc(id).status, 'REGISTERED', 'รอบสองต้องจบ flow ได้');
});

test('return: ผู้ร้องขอเห็นหมายเหตุทันทีที่เปิดฟอร์ม', async () => {
  resetData();
  const id = atQC();
  Store.returnForEdit(id, U('E'), 'กรุณาแนบไฟล์ประกอบ');

  const ctx = await openApp('create.html?id=' + id, 'A');
  eq(ctx.page(), 'create.html', 'ผู้ร้องขอต้องเปิดฟอร์มแก้ไขได้');
  const banner = ctx.$('#remark-banner');
  ok(banner, 'ต้องมีแถบแจ้งหมายเหตุ');
  contains(banner.textContent, 'กรุณาแนบไฟล์ประกอบ', 'แถบต้องแสดงหมายเหตุ');
  contains(banner.textContent, U('E').name, 'แถบต้องบอกว่าใครส่งกลับ');
  notOk(ctx.$('.sign-box[data-sign-key="requester"] img'), 'ลายเซ็นเดิมต้องถูกล้าง');
  ok(canSign(ctx, 'requester'), 'ต้องเซ็นใหม่ได้');
  noPageError(ctx, 'ฟอร์มผู้ร้องขอ');
  ctx.close();
});

test('return: เจ้าของเอกสารและผู้อนุมัติแก้ไขแล้วส่งต่อได้ · ผู้เกี่ยวข้องทำไม่ได้', async () => {
  resetData();
  const id = atQC();
  Store.returnForEdit(id, U('E'), 'แก้ไขเนื้อหา');
  const doc = Store.getDoc(id);

  ok(Store.permissions(doc, U('A')).edit, 'ผู้ร้องขอต้องแก้ไขได้');
  ok(Store.permissions(doc, U('B')).edit, 'เจ้าของเอกสารต้องแก้ไขได้');
  ok(Store.permissions(doc, U('C')).edit, 'ผู้อนุมัติต้องแก้ไขได้');
  notOk(Store.permissions(doc, U('D')).edit, 'ผู้เกี่ยวข้องต้องแก้ไขไม่ได้');
  notOk(Store.permissions(doc, U('D')).sign, 'ผู้เกี่ยวข้องต้องส่งต่อไม่ได้');

  /* เจ้าของเอกสารแก้ไขเนื้อหาแล้วส่งต่อผู้อนุมัติ */
  const ctx = await openApp('create.html?id=' + id, 'B');
  eq(ctx.page(), 'create.html', 'เจ้าของเอกสารต้องเปิดฟอร์มได้');
  notOk(ctx.doc.getElementById('f-docname').disabled, 'ช่องชื่อเอกสารต้องแก้ไขได้');
  fill(ctx, 'f-docname', 'ชื่อเอกสารที่แก้ไขแล้ว');
  await signBox(ctx, 'owner');
  click(ctx, '#ow-sign');
  await confirmDialog(ctx);
  syncStore();
  const after = Store.getDoc(id);
  eq(after.status, 'PENDING_APPROVAL', 'ส่งต่อแล้วต้องถึงผู้อนุมัติ');
  eq(after.title, 'ชื่อเอกสารที่แก้ไขแล้ว', 'เนื้อหาที่แก้ไขต้องถูกบันทึก');
  noPageError(ctx, 'ฟอร์มเจ้าของเอกสาร');
  ctx.close();

  /* ผู้เกี่ยวข้องเปิดเอกสารที่ถูกส่งกลับ → ต้องไปหน้ารายละเอียดเท่านั้น */
  Store.returnForEdit(id, U('C'), 'ส่งกลับอีกครั้ง');
  const view = await openApp('create.html?id=' + id, 'D');
  eq(view.page(), 'document.html', 'ผู้เกี่ยวข้องต้องถูกพาไปหน้ารายละเอียด');
  view.close();
});
