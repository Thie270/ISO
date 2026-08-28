/* ============================================================
   ฟอร์มสร้างเอกสาร — ช่องวันที่ · combobox หน่วยงาน · กล่องเซ็น
   ============================================================ */

test('form: ช่องวันที่พิมพ์เองได้ และเลือกจากปฏิทินได้', async () => {
  resetData();
  const ctx = await openApp('create.html', 'A');
  const el = ctx.doc.getElementById('f-date');

  function type(text) {
    el.value = '';
    el.dispatchEvent(new ctx.win.InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    for (const ch of text) {
      el.value += ch;
      el.setSelectionRange(el.value.length, el.value.length);
      el.dispatchEvent(new ctx.win.InputEvent('input', { bubbles: true, inputType: 'insertText', data: ch }));
    }
    return el.value;
  }

  eq(type('12122029'), '12/12/2029', 'พิมพ์ตัวเลขล้วนต้องเติม / ให้เอง');
  eq(type('1/2/2030'), '1/2/2030', 'พิมพ์ / เองต้องไม่ถูกจัดกลุ่มใหม่');
  eq(type('01/02/2030'), '01/02/2030', 'พิมพ์เต็มรูปแบบต้องได้ตามที่พิมพ์');

  /* กดไอคอนปฏิทินแล้วเลือกวัน */
  const holder = el.closest('.datefield');
  const native = holder.querySelector('.datefield-native');
  el.value = '05/06/2031';
  holder.querySelector('.datefield-btn').click();
  eq(native.value, '2031-06-05', 'ปฏิทินต้องเปิดที่วันที่ในช่อง');
  native.value = '2032-07-08';
  native.dispatchEvent(new ctx.win.Event('change', { bubbles: true }));
  eq(el.value, '08/07/2032', 'เลือกจากปฏิทินแล้วต้องเขียนกลับเป็น วว/ดด/ปปปป');

  noPageError(ctx, 'ฟอร์มสร้างเอกสาร');
  ctx.close();
});

test('form: combobox หน่วยงาน กดลูกศรเลือกทับค่าเดิมได้ และพิมพ์เองได้', async () => {
  resetData();
  const ctx = await openApp('create.html', 'A');
  click(ctx, '[data-step="4"]');

  const input = ctx.doc.getElementById('f-relateddept');
  const wrap = input.closest('.combo');
  ok(wrap, 'ช่องแผนกที่เกี่ยวข้องต้องเป็น combobox');

  wrap.querySelector('.combo-btn').click();
  await sleep(150);
  eq(wrap.querySelectorAll('.combo-item').length, Store.ORG_UNITS.length, 'ต้องเห็นหน่วยงานครบทุกรายการ');
  eq(wrap.querySelectorAll('.combo-group').length, 3, 'ต้องจัดกลุ่มเป็น แผนก / ส่วน / ฝ่าย');

  await pickFromCombo(ctx, 'f-relateddept', 'แผนกซ่อมบำรุง');
  eq(input.value, 'แผนกซ่อมบำรุง', 'เลือกจากรายการแล้วค่าต้องเปลี่ยน');

  /* มีค่าอยู่แล้วต้องยังกดลูกศรเลือกทับได้ ไม่ต้องลบก่อน */
  await pickFromCombo(ctx, 'f-relateddept', 'ฝ่ายผลิต');
  eq(input.value, 'ฝ่ายผลิต', 'ต้องเลือกทับค่าเดิมได้');

  fill(ctx, 'f-relateddept', 'แผนกวิจัยและพัฒนา');
  eq(input.value, 'แผนกวิจัยและพัฒนา', 'ต้องพิมพ์หน่วยงานนอกรายการเองได้');

  noPageError(ctx, 'ฟอร์มสร้างเอกสาร');
  ctx.close();
});

test('form: กล่องเซ็นขนาดเท่ากันทุกช่อง ไม่ว่าจะเซ็นแล้วหรือยัง', async () => {
  resetData();
  const ctx = await openApp('create.html', 'A');
  click(ctx, '[data-step="6"]');

  const height = key => Math.round(
    ctx.$('.sign-box[data-sign-key="' + key + '"]').getBoundingClientRect().height);

  const before = height('requester');
  eq(height('owner'), before, 'ก่อนเซ็น สองช่องต้องสูงเท่ากัน');

  await signBox(ctx, 'requester');
  eq(height('requester'), before, 'เซ็นแล้วความสูงต้องไม่เปลี่ยน');
  eq(height('owner'), before, 'ช่องข้าง ๆ ต้องสูงเท่าเดิม');

  const img = ctx.$('.sign-box[data-sign-key="requester"] img');
  ok(img.getBoundingClientRect().height <= before, 'ภาพลายเซ็นต้องอยู่ในกรอบ');

  noPageError(ctx, 'ฟอร์มสร้างเอกสาร');
  ctx.close();
});

test('form: เพิ่มผู้เกี่ยวข้องได้ทั้งเลือกจากรายการและพิมพ์เอง', async () => {
  resetData();
  const ctx = await openApp('create.html', 'A');
  click(ctx, '[data-step="7"]');

  notOk(ctx.doc.getElementById('related-add'), 'ไม่ต้องมีปุ่มเพิ่มแล้ว');

  await pickFromCombo(ctx, 'related-select', 'แผนกควบคุมคุณภาพ');
  eq(ctx.$$('#related-sign-boxes .sign-box').length, 1, 'เลือกจากรายการแล้วต้องได้กล่องเซ็น 1 กล่อง');

  const sel = ctx.doc.getElementById('related-select');
  fill(ctx, 'related-select', 'คณะทำงาน ISO 45001');
  sel.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await sleep(200);
  eq(ctx.$$('#related-sign-boxes .sign-box').length, 2, 'พิมพ์เองแล้วกด Enter ต้องเพิ่มได้');
  eq(sel.value, '', 'เพิ่มแล้วต้องล้างช่องให้');

  /* ชื่อหน่วยงานต้องไม่ขึ้นซ้ำ — มีที่ชิปกับหัวกล่องเซ็นอย่างละครั้ง */
  const chips = ctx.$$('#related-chips span').map(s => s.textContent.replace('×', '').trim());
  eq(chips.join(','), 'แผนกควบคุมคุณภาพ,คณะทำงาน ISO 45001', 'ชิปต้องครบตามที่เพิ่ม');

  noPageError(ctx, 'ฟอร์มสร้างเอกสาร');
  ctx.close();
});

test('form: กรอกครบแล้วจึงส่งตรวจสอบได้', async () => {
  resetData();
  const ctx = await openApp('create.html', 'A');

  ok(ctx.doc.getElementById('sent-btn').disabled, 'ยังกรอกไม่ครบ ต้องกดส่งไม่ได้');

  fill(ctx, 'f-empid', 'RVP-1041');
  fill(ctx, 'f-fname', 'สมชาย');
  fill(ctx, 'f-lname', 'ใจดี');
  fill(ctx, 'f-dept', 'ส่วนวางแผนการผลิต');
  fill(ctx, 'f-date', '01/03/2027');
  click(ctx, 'input[name="purpose"][value="new"]');
  click(ctx, 'input[name="doctype"][value="wi"]');
  fill(ctx, 'f-docname', 'เอกสารทดสอบ E2E');
  fill(ctx, 'f-docno', 'RVP-E2E-FORM');
  await pickFromCombo(ctx, 'f-iso', 'ISO 45001:2018');
  fill(ctx, 'f-relateddept', 'ส่วนวิศวกรรม');
  fill(ctx, 'desc-step4', 'รายละเอียดสำหรับทดสอบ');
  fill(ctx, 'f-effective', '15/04/2027');
  click(ctx, '[data-step="6"]');
  await signBox(ctx, 'requester');
  click(ctx, '[data-step="7"]');
  await pickFromCombo(ctx, 'related-select', 'แผนกประกันคุณภาพ');
  await sleep(200);

  notOk(ctx.doc.getElementById('sent-btn').disabled, 'กรอกครบแล้วต้องกดส่งได้');
  eq(ctx.text('#ready-chip'), I18N.t('cr.readyToSend'), 'ป้ายสถานะต้องบอกว่าพร้อมส่ง');

  click(ctx, '#sent-btn');
  await confirmDialog(ctx);
  syncStore();
  const saved = Store.allDocs().filter(d => d.docNo === 'RVP-E2E-FORM')[0];
  ok(saved, 'ต้องบันทึกเอกสารไว้');
  eq(saved.status, 'PENDING_OWNER', 'ส่งแล้วต้องถึงหน่วยงานเจ้าของเอกสาร');
  eq(saved.relatedDept, 'ส่วนวิศวกรรม', 'ต้องเก็บหน่วยงานที่พิมพ์เอง');
  eq(saved.isoStandard, 'ISO 45001:2018', 'ต้องเก็บมาตรฐาน ISO ที่เลือก');
  noPageError(ctx, 'ฟอร์มสร้างเอกสาร');
  ctx.close();
});

test('form: เลือกมาตรฐาน ISO จาก dropdown ได้', async () => {
  resetData();
  const ctx = await openApp('create.html', 'A');
  click(ctx, '[data-step="4"]');

  const input = ctx.doc.getElementById('f-iso');
  ok(input, 'ส่วนที่ 4 ต้องมีช่องมาตรฐาน ISO');
  const wrap = input.closest('.combo');
  ok(wrap, 'ต้องเป็น dropdown ที่กดลูกศรเลือกได้');

  /* ต้องอยู่ต่อจากช่องชื่อเอกสาร */
  const fields = ctx.$$('#step-4 .f-label').map(l => l.getAttribute('data-i18n'));
  eq(fields.slice(0, 3).join(','), 'cr.docName,cr.docNo,cr.isoStd', 'ลำดับช่องต้องอยู่หลังหมายเลขเอกสาร');

  wrap.querySelector('.combo-btn').click();
  await sleep(150);
  const items = Array.prototype.slice.call(wrap.querySelectorAll('.combo-item')).map(b => b.textContent.trim());
  eq(items.length, Store.ISO_STANDARDS.length, 'ต้องเห็นมาตรฐานครบทุกรุ่น');
  contains(items.join('|'), 'ISO 9001:2015', 'ต้องมี ISO 9001:2015 ให้เลือก');

  await pickFromCombo(ctx, 'f-iso', 'ISO 14001:2015');
  eq(input.value, 'ISO 14001:2015', 'เลือกแล้วค่าต้องเปลี่ยน');
  await pickFromCombo(ctx, 'f-iso', 'ISO/IEC 27001:2022');
  eq(input.value, 'ISO/IEC 27001:2022', 'ต้องเลือกทับค่าเดิมได้');

  noPageError(ctx, 'ฟอร์มสร้างเอกสาร');
  ctx.close();
});

test('form: มาตรฐาน ISO ที่บันทึกไว้ต้องขึ้นในหน้าเอกสาร', async () => {
  resetData();
  const doc = newRequest({ docNo: 'RVP-E2E-ISO' });
  Store.updateDraft(doc.id, { isoStandard: 'ISO 22000:2018' });

  const ctx = await openApp('document.html?id=' + doc.id, 'A');
  contains(ctx.text('#info-scroll'), 'ISO 22000:2018', 'แผงข้อมูลต้องแสดงมาตรฐาน');
  const paper = ctx.$$('.paper').map(p => p.textContent).join(' ').replace(/\s+/g, ' ');
  contains(paper, 'ISO 22000:2018', 'หน้ากระดาษต้องแสดงมาตรฐาน');
  noPageError(ctx, 'หน้าเอกสาร');
  ctx.close();
});
