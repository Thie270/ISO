/* ============================================================
   ผู้มีส่วนเกี่ยวข้อง (ส่วนที่ 5.2) — ใครเซ็นได้บ้าง
   ============================================================ */

function readyToSign(units, docNo) {
  const doc = newRequest({ docNo: docNo, stakeholders: units });
  Store.send(doc.id, U('A'));
  Store.ownerSign(doc.id, U('B'));
  Store.approve(doc.id, U('C'));
  return doc.id;
}

test('stakeholder: มีหน่วยงานของตัวเองในรายชื่อ → เซ็นและส่งต่อได้', async () => {
  resetData();
  const id = readyToSign(['SQD', 'QC'], 'RVP-E2E-STK1');
  const doc = Store.getDoc(id);

  eq(Store.slotForUser(doc, 'D').id, 'SQD', 'ต้องได้ช่องของหน่วยงานตัวเอง');
  ok(Store.permissions(doc, U('D')).sign, 'ต้องเซ็นได้');

  const ctx = await openApp('create.html?id=' + id, 'D');
  eq(ctx.page(), 'create.html', 'ต้องเปิดฟอร์มเซ็นได้');
  ok(canSign(ctx, 'rel:SQD'), 'ต้องมีปุ่มเซ็นในช่องของตัวเอง');
  notOk(canSign(ctx, 'rel:QC'), 'ช่องของหน่วยงานอื่นต้องเซ็นไม่ได้');
  noPageError(ctx, 'ฟอร์มผู้เกี่ยวข้อง');
  ctx.close();
});

test('stakeholder: มีแต่หน่วยงานอื่น → ยังลงนามแทนหน่วยงานที่ถูกเลือกไว้ได้', async () => {
  resetData();
  const id = readyToSign(['QC', 'PROD'], 'RVP-E2E-STK2');
  ok(Store.permissions(Store.getDoc(id), U('D')).sign, 'ต้องเซ็นได้');

  Store.sign(id, U('D'));
  Store.sign(id, U('D'));
  eq(Store.getDoc(id).status, 'SENT_TO_QC', 'เซ็นครบทุกหน่วยงานแล้วต้องส่งต่อแผนกควบคุมคุณภาพ');
});

test('stakeholder: ไม่มีใครถูกเพิ่มในส่วนที่ 5.2 → ดูได้อย่างเดียว', async () => {
  resetData();
  const id = readyToSign([], 'RVP-E2E-STK3');
  const doc = Store.getDoc(id);

  eq(Store.slotForUser(doc, 'D'), null, 'ต้องไม่มีช่องลงนาม');
  notOk(Store.permissions(doc, U('D')).sign, 'ต้องเซ็นไม่ได้');

  Store.sign(id, U('D'));
  eq(Store.getDoc(id).status, 'PENDING_SIGN', 'สั่งเซ็นตรง ๆ ก็ต้องไม่ขยับสถานะ');

  const ctx = await openApp('create.html?id=' + id, 'D');
  eq(ctx.page(), 'document.html', 'ต้องถูกพาไปหน้ารายละเอียด');
  ctx.close();
});

test('stakeholder: ตารางงานแยกปุ่มเซ็นกับปุ่มดูรายละเอียดถูกต้อง', async () => {
  resetData();
  const withMe = readyToSign(['SQD', 'QC'], 'RVP-E2E-STK4');
  const noOne = readyToSign([], 'RVP-E2E-STK5');

  const ctx = await openApp('role-stakeholder.html', 'D');
  click(ctx, '.filter-tab[data-filter=""]');
  await sleep(200);

  async function buttonOf(docNo) {
    fill(ctx, 'search', docNo);
    await sleep(300);
    const row = ctx.$$('#rows tr').filter(r => r.textContent.indexOf(docNo) !== -1)[0];
    ok(row, 'ต้องเห็นเอกสาร ' + docNo + ' ในรายการ');
    const btn = row.querySelector('.row-btn');
    return btn ? btn.textContent.trim() : row.querySelector('a').textContent.trim();
  }

  eq(await buttonOf('RVP-E2E-STK4'), I18N.t('act.sign'), 'ฉบับที่มีชื่อเราต้องขึ้นปุ่มเซ็น');
  eq(await buttonOf('RVP-E2E-STK5'), I18N.t('act.detail'), 'ฉบับที่ไม่มีชื่อเราต้องขึ้นปุ่มรายละเอียด');
  noPageError(ctx, 'หน้างานผู้เกี่ยวข้อง');
  ctx.close();
  void withMe; void noOne;
});
