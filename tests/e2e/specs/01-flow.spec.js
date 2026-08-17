/* ============================================================
   เดินเอกสารครบทั้ง flow — A → B → C → D → E → F
   ============================================================ */

test('flow: เดินเอกสารครบทุกบทบาทจนขึ้นทะเบียน', async () => {
  resetData();
  const doc = newRequest({ docNo: 'RVP-E2E-FLOW' });

  Store.send(doc.id, U('A'));
  eq(Store.getDoc(doc.id).status, 'PENDING_OWNER', 'ส่งแล้วต้องรอหน่วยงานเจ้าของเอกสาร');

  Store.ownerSign(doc.id, U('B')); stampSig(doc.id, 'owner', 'B');
  eq(Store.getDoc(doc.id).status, 'PENDING_APPROVAL', 'เจ้าของเอกสารลงนามแล้วต้องถึงผู้อนุมัติ');

  Store.approve(doc.id, U('C')); stampSig(doc.id, 'approver', 'C');
  eq(Store.getDoc(doc.id).status, 'PENDING_SIGN', 'อนุมัติแล้วต้องถึงผู้เกี่ยวข้อง');

  Store.sign(doc.id, U('D'));
  Store.sign(doc.id, U('D'));
  eq(Store.getDoc(doc.id).status, 'SENT_TO_QC', 'ผู้เกี่ยวข้องเซ็นครบต้องถึงแผนกควบคุมคุณภาพ');

  Store.qcStaffSign(doc.id, U('E')); stampSig(doc.id, 'qcStaff', 'E');
  eq(Store.getDoc(doc.id).status, 'PENDING_QC_MANAGER', 'เจ้าหน้าที่ลงนามแล้วต้องรอผู้จัดการแผนก');

  Store.register(doc.id, U('F')); stampSig(doc.id, 'qcManager', 'F');
  const done = Store.getDoc(doc.id);
  eq(done.status, 'REGISTERED', 'ผู้จัดการแผนกขึ้นทะเบียนแล้วต้องจบ flow');
  eq(Object.keys(done.signatures).sort().join(','),
     'approver,owner,qcManager,qcStaff,requester', 'ลายเซ็นต้องครบทุกช่อง');
});

test('flow: แต่ละบทบาทเปิดเอกสารแล้วเซ็นช่องของตัวเองได้', async () => {
  resetData();
  const doc = newRequest({ docNo: 'RVP-E2E-UI' });
  Store.send(doc.id, U('A'));

  /* ── B ลงนามส่วนที่ 5 แล้วส่งต่อ ── */
  let ctx = await openApp('create.html?id=' + doc.id, 'B');
  eq(ctx.page(), 'create.html', 'เจ้าของเอกสารต้องเปิดฟอร์มได้');
  notOk(canSign(ctx, 'requester'), 'ช่องผู้ร้องขอต้องถูกล็อก');
  await signBox(ctx, 'owner');
  ok(ctx.$('.sign-box[data-sign-key="owner"] img'), 'ต้องมีลายเซ็นในช่องเจ้าของเอกสาร');
  ok(ctx.doc.getElementById('s5-name-owner').value, 'ชื่อผู้ลงนามต้องถูกเติมให้อัตโนมัติ');
  ok(ctx.doc.getElementById('s5-date-owner').value, 'วันที่ต้องถูกเติมให้อัตโนมัติ');
  click(ctx, '#ow-sign');
  await confirmDialog(ctx);
  eq(Store.getDoc(doc.id).status, 'PENDING_APPROVAL', 'กดส่งต่อแล้วต้องถึงผู้อนุมัติ');
  noPageError(ctx, 'หน้าเจ้าของเอกสาร');
  ctx.close();

  /* ── C อนุมัติ ── */
  ctx = await openApp('create.html?id=' + doc.id, 'C');
  await signBox(ctx, 'approver');
  click(ctx, '#rv-approve');
  await confirmDialog(ctx);
  eq(Store.getDoc(doc.id).status, 'PENDING_SIGN', 'อนุมัติแล้วต้องถึงผู้เกี่ยวข้อง');
  noPageError(ctx, 'หน้าผู้อนุมัติ');
  ctx.close();

  /* ── D ลงนามช่องของตัวเอง ── */
  ctx = await openApp('create.html?id=' + doc.id, 'D');
  await signBox(ctx, 'rel:SQD');
  syncStore();
  const mySlot = () => Store.getDoc(doc.id).stakeholders.filter(s => s.id === 'SQD')[0];
  notOk(mySlot().signed, 'ยังไม่กดส่ง ต้องยังไม่ถูกบันทึกว่าเซ็นแล้ว');
  click(ctx, '#sg-sign');
  await confirmDialog(ctx);
  ok(mySlot().signed, 'ผู้เกี่ยวข้องต้องถูกบันทึกว่าเซ็นแล้ว');
  ok(mySlot().sigImg, 'ต้องเก็บภาพลายเซ็นไว้ด้วย');
  eq(mySlot().signName, U('D').name, 'ต้องเก็บชื่อผู้ลงนามไว้ด้วย');
  noPageError(ctx, 'หน้าผู้เกี่ยวข้อง');
  ctx.close();

  /* เซ็นช่องที่เหลือให้ครบ เพื่อส่งต่อแผนกควบคุมคุณภาพ */
  Store.sign(doc.id, U('D'));
  eq(Store.getDoc(doc.id).status, 'SENT_TO_QC', 'เซ็นครบแล้วต้องถึงแผนกควบคุมคุณภาพ');

  /* ── E ลงนามส่วนที่ 6 ── */
  ctx = await openApp('create.html?id=' + doc.id, 'E');
  notOk(canSign(ctx, 'qcManager'), 'ช่องผู้จัดการแผนกต้องถูกล็อก');
  await signBox(ctx, 'qcStaff');
  click(ctx, '#qc-register');
  await confirmDialog(ctx);
  eq(Store.getDoc(doc.id).status, 'PENDING_QC_MANAGER', 'เจ้าหน้าที่ลงนามแล้วต้องรอผู้จัดการแผนก');
  noPageError(ctx, 'หน้าเจ้าหน้าที่ควบคุมคุณภาพ');
  ctx.close();

  /* ── F ลงนามแล้วขึ้นทะเบียน ── */
  ctx = await openApp('create.html?id=' + doc.id, 'F');
  ok(ctx.$('.sign-box[data-sign-key="qcStaff"] img'), 'ต้องเห็นลายเซ็นเจ้าหน้าที่ที่ลงนามมาแล้ว');
  await signBox(ctx, 'qcManager');
  click(ctx, '#qc-register');
  await confirmDialog(ctx);
  eq(Store.getDoc(doc.id).status, 'REGISTERED', 'ผู้จัดการแผนกขึ้นทะเบียนแล้วต้องจบ flow');
  noPageError(ctx, 'หน้าผู้จัดการแผนกควบคุมคุณภาพ');
  ctx.close();
});
