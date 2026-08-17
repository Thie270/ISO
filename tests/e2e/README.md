# E2E test

ทดสอบระบบจากหน้าจอจริง — เปิดหน้าเว็บของระบบใน iframe แล้วสั่งงานเหมือนผู้ใช้กดเอง
(คลิกปุ่ม พิมพ์ข้อมูล วาดลายเซ็น กดยืนยัน) จากนั้นตรวจผลทั้งจากหน้าจอและจากข้อมูลใน `Store`

ไม่ต้องติดตั้งอะไรเพิ่ม ใช้แค่ **python3** (เปิดเว็บเซิร์ฟเวอร์) กับ **Google Chrome** (โหมด headless)

## วิธีรัน

```bash
./tests/e2e/run.sh
```

ตัวเลือกเพิ่มเติม

```bash
PORT=8200 ./tests/e2e/run.sh                    # เปลี่ยนพอร์ต
CHROME="/path/to/chrome" ./tests/e2e/run.sh     # ระบุที่อยู่ Chrome เอง
TIMEOUT_MS=300000 ./tests/e2e/run.sh            # ขยายเวลาสูงสุด
```

ผ่านทั้งหมด → exit code `0` · มีข้อไหนไม่ผ่าน → exit code `1` พร้อมบอกว่าพังตรงไหน

อยากดูด้วยตาก็เปิดหน้านี้ในเบราว์เซอร์ได้เลย (ต้องรันผ่านเว็บเซิร์ฟเวอร์ ไม่ใช่เปิดไฟล์ตรง ๆ)

```bash
python3 -m http.server 8123
open http://localhost:8123/tests/e2e/runner.html
```

## ไฟล์ในโฟลเดอร์นี้

| ไฟล์ | หน้าที่ |
|---|---|
| `run.sh` | เปิดเซิร์ฟเวอร์ → สั่ง Chrome รัน → สรุปผล |
| `runner.html` | หน้ารันเทสต์ (โหลด harness + spec ทั้งหมด) |
| `harness.js` | เครื่องมือช่วยเขียนเทสต์ |
| `report.py` | แปลงผลจาก DOM เป็นสรุปในเทอร์มินัล |
| `specs/*.spec.js` | ตัวเทสต์ |

## สิ่งที่ทดสอบ

| ไฟล์ | ครอบคลุม |
|---|---|
| `01-flow` | เดินเอกสารครบ flow A → B → C → D → E → F และแต่ละบทบาทเซ็นช่องของตัวเองผ่านหน้าจอจริง |
| `02-return` | ส่งกลับแล้วลายเซ็นถูกล้าง · ทุกฝ่ายกลับมาเซ็นใหม่ได้ · เจ้าของเอกสาร/ผู้อนุมัติแก้ไขแล้วส่งต่อได้ · ผู้เกี่ยวข้องทำไม่ได้ · แถบหมายเหตุ |
| `03-stakeholder` | สิทธิ์ลงนามของผู้เกี่ยวข้องตามรายชื่อในส่วนที่ 5.2 |
| `04-workspace` | ทุกหน้าเปิดได้ · ตัวเลขการ์ดตรงกับแท็บ · อัปเดต real time · คอลัมน์หมายเหตุ |
| `05-form` | ช่องวันที่ · combobox หน่วยงาน · ขนาดกล่องเซ็น · เพิ่มผู้เกี่ยวข้อง · เงื่อนไขก่อนส่งตรวจสอบ |
| `06-document` | หน้ากระดาษ 2 หน้าพร้อมลายเซ็นครบ · แผงข้อมูล · ไทม์ไลน์ |

## เขียนเทสต์เพิ่ม

สร้างไฟล์ใน `specs/` แล้วเพิ่ม `<script src="specs/ชื่อไฟล์.spec.js"></script>` ใน `runner.html`

```js
test('ชื่อสิ่งที่ทดสอบ', async () => {
  resetData();                                   // ล้างข้อมูลแล้ว seed ใหม่
  const doc = newRequest({ docNo: 'RVP-X' });    // สร้างคำขอตั้งต้น
  Store.send(doc.id, U('A'));                    // เดิน flow ด้วย Store API

  const ctx = await openApp('create.html?id=' + doc.id, 'B');   // เปิดหน้าจริงในบทบาท B
  await signBox(ctx, 'owner');                   // วาดลายเซ็นในกล่องที่กำหนด
  click(ctx, '#ow-sign');
  await confirmDialog(ctx);                      // กดยืนยันในกล่องยืนยัน

  eq(Store.getDoc(doc.id).status, 'PENDING_APPROVAL', 'ต้องส่งต่อผู้อนุมัติ');
  noPageError(ctx, 'หน้าเจ้าของเอกสาร');
  ctx.close();
});
```

เครื่องมือที่ใช้ได้: `resetData` `loginAs` `newRequest` `stampSig` `U` · `openApp` `fill` `click`
`pickFromCombo` `signBox` `confirmDialog` `canSign` `waitFor` `sleep` `syncStore` ·
`eq` `ok` `notOk` `contains` `noPageError`

> ข้อควรระวัง: หน้าใน iframe เป็นคนละบริบทกับหน้ารันเทสต์ ถ้าจะอ่านข้อมูลจาก `Store`
> หลังจากกดปุ่มในหน้าจอ ให้เรียก `syncStore()` ก่อน (ฟังก์ชัน `confirmDialog` เรียกให้แล้ว)
