/* ============================================================
   store.js — Mock database + Workflow state machine
   ------------------------------------------------------------
   MOCKUP ONLY : ไม่มีการเชื่อมต่อฐานข้อมูลหรือ API ใด ๆ
   ข้อมูลทั้งหมดเก็บใน localStorage ของเบราว์เซอร์เท่านั้น
   ============================================================ */
(function (global) {
  'use strict';

  const DB_KEY = 'rvp_mock_db';
  const SESSION_KEY = 'rvp_session';
  const DB_VERSION = 9;

  /* เพดานพื้นที่ไฟล์แนบที่ยอมให้เก็บลง localStorage (base64) */
  const FILE_QUOTA = 3.5 * 1024 * 1024;

  /* ══════════════════════════════════════════
     ผู้ใช้งานตัวอย่าง 6 บัญชี (6 บทบาท ตามลำดับการเดินงาน)
     A ผู้ร้องขอ → B หน่วยงานเจ้าของเอกสาร → C ผู้อนุมัติ → D ผู้มีส่วนเกี่ยวข้อง
     → E เจ้าหน้าที่ควบคุมคุณภาพ → F ผู้จัดการแผนกควบคุมคุณภาพ
     ══════════════════════════════════════════ */
  const USERS = [
    {
      id: 'A',
      username: 'userA',
      password: '1234',
      initials: 'A',
      name: 'นาย A · สมชาย ใจดี',
      nameEn: 'Mr. A · Somchai Jaidee',
      role: 'requester',
      empId: 'RVP-1041',
      dept: 'ฝ่ายผลิต',
      deptEn: 'Production Division',
      position: 'ผู้จัดการส่วน',
      positionEn: 'Section Manager',
      color: '#0b4f8c',
      home: 'role-requester.html'
    },
    {
      id: 'B',
      username: 'userB',
      password: '1234',
      initials: 'B',
      name: 'นาย B · ธนกฤต ศรีสุข',
      nameEn: 'Mr. B · Thanakrit Srisuk',
      role: 'owner',
      empId: 'RVP-0532',
      dept: 'ฝ่ายผลิต',
      deptEn: 'Production Division',
      position: 'ผู้จัดการฝ่ายผลิต',
      positionEn: 'Production Division Manager',
      color: '#1d4ed8',
      home: 'role-owner.html'
    },
    {
      id: 'C',
      username: 'userC',
      password: '1234',
      initials: 'C',
      name: 'นาย C · ประเสริฐ วงศ์ทอง',
      nameEn: 'Mr. C · Prasert Wongthong',
      role: 'approver',
      empId: 'RVP-0207',
      dept: 'ฝ่ายปฏิบัติการ',
      deptEn: 'Operations Division',
      position: 'ผู้จัดการฝ่าย',
      positionEn: 'Division Manager',
      color: '#0f766e',
      home: 'role-approver.html'
    },
    {
      id: 'D',
      username: 'userD',
      password: '1234',
      initials: 'D',
      name: 'นาย D · ปรีชา แสงจันทร์',
      nameEn: 'Mr. D · Preecha Sangchan',
      role: 'stakeholder',
      empId: 'RVP-0688',
      dept: 'SQD',
      deptEn: 'SQD',
      position: 'หัวหน้าแผนก',
      positionEn: 'Department Head',
      color: '#6d28d9',
      home: 'role-stakeholder.html'
    },
    {
      id: 'E',
      username: 'userE',
      password: '1234',
      initials: 'E',
      name: 'นาย E · วิชัย ธนกิจ',
      nameEn: 'Mr. E · Wichai Thanakit',
      role: 'qc',
      empId: 'RVP-0115',
      dept: 'แผนกควบคุมคุณภาพ (QC)',
      deptEn: 'Quality Control Department',
      position: 'เจ้าหน้าที่ควบคุมคุณภาพ',
      positionEn: 'Quality Control Officer',
      color: '#b45309',
      home: 'role-qc.html'
    },
    {
      id: 'F',
      username: 'userF',
      password: '1234',
      initials: 'F',
      name: 'นาย F · สมพงษ์ รุ่งเรือง',
      nameEn: 'Mr. F · Sompong Rungruang',
      role: 'qcManager',
      empId: 'RVP-0098',
      dept: 'แผนกควบคุมคุณภาพ (QC)',
      deptEn: 'Quality Control Department',
      position: 'ผู้จัดการแผนกควบคุมคุณภาพ',
      positionEn: 'Quality Control Manager',
      color: '#9d174d',
      home: 'role-qc-manager.html'
    }
  ];

  /* ══════════════════════════════════════════
     State machine ตาม Flow chart
     ══════════════════════════════════════════ */
  const STATUS = {
    DRAFT: 'DRAFT',
    /* ผู้ร้องขอส่งแล้ว → รอหน่วยงานเจ้าของเอกสารลงนามในส่วนที่ 5 ก่อนถึงผู้อนุมัติ */
    PENDING_OWNER: 'PENDING_OWNER',
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    RETURNED: 'RETURNED',
    REJECTED: 'REJECTED',
    PENDING_SIGN: 'PENDING_SIGN',
    SENT_TO_QC: 'SENT_TO_QC',
    /* เจ้าหน้าที่ควบคุมคุณภาพลงนามส่วนที่ 6 แล้ว → รอผู้จัดการแผนกลงนามและขึ้นทะเบียน */
    PENDING_QC_MANAGER: 'PENDING_QC_MANAGER',
    REGISTERED: 'REGISTERED',
    EXPIRED_RETURNED: 'EXPIRED_RETURNED'
  };

  /* สีของ pill สถานะ (ใช้ class เดิมที่มีอยู่ใน style.css / tailwind) */
  const STATUS_STYLE = {
    DRAFT:            { pill: 'bg-slate-100 text-slate-500',   dot: 'bg-slate-400'   },
    /* ระหว่างที่ flow ยังเดินอยู่ (รออนุมัติ / รอเซ็น / รอ QC) ใช้ป้าย "In process" สีม่วงเหมือนกันหมด */
    PENDING_OWNER:    { pill: 'bg-violet-50 text-violet-600',  dot: 'bg-violet-500'  },
    PENDING_APPROVAL: { pill: 'bg-violet-50 text-violet-600',  dot: 'bg-violet-500'  },
    PENDING_SIGN:     { pill: 'bg-violet-50 text-violet-600',  dot: 'bg-violet-500'  },
    SENT_TO_QC:       { pill: 'bg-violet-50 text-violet-600',  dot: 'bg-violet-500'  },
    PENDING_QC_MANAGER: { pill: 'bg-violet-50 text-violet-600', dot: 'bg-violet-500'  },
    RETURNED:         { pill: 'bg-orange-50 text-orange-600',  dot: 'bg-orange-500'  },
    REJECTED:         { pill: 'bg-rose-100 text-rose-700',     dot: 'bg-rose-600'    },
    REGISTERED:       { pill: 'bg-teal-50 text-teal-700',      dot: 'bg-teal-600'    },
    /* หมดเวลาลงนาม — ปิดตัวเองด้วยความผิดปกติ จึงใช้สีแดง */
    EXPIRED_RETURNED: { pill: 'bg-red-50 text-red-600',        dot: 'bg-red-500'     }
  };

  const DOC_TYPES = {
    qm:   { th: 'คู่มือคุณภาพ (QM)',            en: 'Quality Manual (QM)' },
    qp:   { th: 'ขั้นตอนการดำเนินการ (QP)',      en: 'Quality Procedure (QP)' },
    wi:   { th: 'วิธีปฏิบัติงาน (WI)',           en: 'Work Instruction (WI)' },
    sd:   { th: 'เอกสารสนับสนุน (SD)',          en: 'Supporting Document (SD)' },
    form: { th: 'แบบฟอร์ม (FM)',                en: 'Form (FM)' },
    esd:  { th: 'เอกสารสนับสนุนภายนอก (ED)',     en: 'External Support Doc (ED)' }
  };

  const PURPOSES = {
    new:    { th: 'จัดทำเอกสารใหม่ และ ขึ้นทะเบียน', en: 'Create & register a new document' },
    edit:   { th: 'เปลี่ยนแปลงแก้ไขเอกสาร',        en: 'Amend an existing document' },
    cancel: { th: 'ยกเลิกการใช้งานเอกสาร',        en: 'Withdraw a document from use' },
    copy:   { th: 'ขอสำเนาเอกสารควบคุม',          en: 'Request controlled copies' },
    other:  { th: 'อื่นๆ',                       en: 'Other' }
  };

  /* รายชื่อผู้มีส่วนเกี่ยวข้องที่เลือกได้ (mock) */
  const STAKEHOLDER_POOL = [
    { id: 'SQD',  name: 'SQD',          nameEn: 'SQD',                userId: 'D' },
    { id: 'QC',   name: 'QC',           nameEn: 'QC',                 userId: null },
    { id: 'PROD', name: 'ฝ่ายผลิต',      nameEn: 'Production',         userId: null },
    { id: 'HR',   name: 'ฝ่ายบุคคล',     nameEn: 'Human Resources',    userId: null },
    { id: 'FIN',  name: 'ฝ่ายการเงิน',   nameEn: 'Finance',            userId: null },
    { id: 'IT',   name: 'ฝ่าย IT',       nameEn: 'IT Division',        userId: null }
  ];

  /* ══════════════════════════════════════════
     ข้อมูลตัวอย่างเริ่มต้น
     ══════════════════════════════════════════ */
  /* รับได้ทั้งรหัส ('QC') และข้อมูลเต็มของผู้เกี่ยวข้องที่เคยบันทึกไว้
     (คงลายเซ็น/ชื่อ/วันที่ และสถานะการลงนามไว้ครบ) */
  function normSh(x) {
    if (!x) return null;
    if (typeof x === 'string') return sh(x);
    return Object.assign(sh(x.id), x);
  }

  function sh(id, signed, day) {
    const base = STAKEHOLDER_POOL.find(s => s.id === id) || { id, name: id, nameEn: id, userId: null };
    return { id: base.id, name: base.name, nameEn: base.nameEn, userId: base.userId, signed: !!signed, signedDay: signed ? (day || 0) : null };
  }

  /* ── เครื่องมือสร้างข้อมูลตัวอย่างให้ "กรอกครบ" เหมือนใช้งานจริง ── */

  /* ตัดคำนำหน้า/รหัสออก เหลือชื่อ-นามสกุลสำหรับเขียนเป็นลายเซ็น */
  function shortName(name) {
    const parts = String(name || '').split('·');
    return (parts.length > 1 ? parts[1] : parts[0]).trim();
  }

  /* วันที่จริงในรูปแบบ วว/ดด/ปปปป (offset = จำนวนวันจากวันนี้) */
  function dateStr(offset) {
    const d = new Date();
    d.setDate(d.getDate() + (Number(offset) || 0));
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  }

  /* ภาพลายเซ็นลายมือแบบย่อ (SVG) — ให้ข้อมูลตัวอย่างมีลายเซ็นจริงให้ดู */
  function sigImage(name, color) {
    const c = color || '#1e293b';
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="96" viewBox="0 0 280 96">' +
        '<g transform="rotate(-5 24 60)">' +
          '<text x="18" y="58" font-family="Segoe Script, Bradley Hand, Brush Script MT, cursive" ' +
          'font-size="30" fill="' + c + '">' + esc(name) + '</text>' +
        '</g>' +
        '<path d="M16 74 C 70 62, 150 88, 262 66" stroke="' + c + '" stroke-width="2" ' +
        'fill="none" opacity="0.5" stroke-linecap="round"/>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function seed() {
    const A = USERS[0];
    const mk = (o) => Object.assign({
      id: '',
      title: '', titleEn: '',
      docNo: '',
      type: 'wi',
      purpose: 'new',
      purposeDetail: '',
      revision: 0,
      description: '',
      relatedDept: 'ฝ่ายผลิต',
      effectiveDate: '',
      requesterId: 'A',
      requesterName: A.name,
      requesterNameEn: A.nameEn,
      requesterDept: A.dept,
      requesterEmpId: A.empId,
      requestDate: '',
      status: STATUS.DRAFT,
      createdDay: 0,
      sentDay: null,
      approvedDay: null,
      closedDay: null,
      dueDays: 14,
      files: [],
      stakeholders: [],
      signatures: {},
      lastRemark: '',
      history: []
    }, o);

    /* ลายเซ็นอิเล็กทรอนิกส์ — ข้อมูลครบเหมือนที่ผู้ใช้เซ็นเองในฟอร์ม
       (ภาพลายเซ็น + ชื่อผู้ลงนาม + ตำแหน่ง + วันที่) */
    const SIG = (by, dayOffset) => {
      const u = USERS.find(x => x.id === by);
      const nm = shortName(u ? u.name : by);
      return {
        by: by,
        day: dayOffset || 0,
        label: 'ลายเซ็นอิเล็กทรอนิกส์',
        img: sigImage(nm, u ? u.color : '#1e293b'),
        name: u ? u.name : by,
        position: u ? u.position : '',
        at: dateStr(dayOffset || 0)
      };
    };

    const docs = [
      /* ── ① ร่าง — ยังไม่ส่ง ───────────────────────────────── */
      mk({
        id: 'DAR001', docNo: 'RVP-WI-018', type: 'wi', purpose: 'edit',
        title: 'วิธีปฏิบัติงานตรวจสอบคุณภาพขั้นสุดท้ายก่อนส่งมอบ', titleEn: 'Final Inspection & Release Work Instruction',
        revision: 2, status: STATUS.DRAFT, createdDay: 0, relatedDept: 'ฝ่ายผลิต',
        description: 'ปรับเกณฑ์การสุ่มตรวจและผู้มีอำนาจปล่อยงาน ให้สอดคล้อง ISO 9001:2015 ข้อ 8.6 การปล่อยผลิตภัณฑ์และบริการ',
        files: [{ name: 'DAR-RVP-WI-018.pdf', size: 248320, kind: 'dar' }],
        stakeholders: [sh('SQD'), sh('QC'), sh('PROD')],
        history: [{ day: 0, actor: 'A', action: 'create' }]
      }),

      /* ── ② รอผู้อนุมัติตรวจสอบ ─────────────────────────────── */
      mk({
        id: 'DAR002', docNo: 'RVP-FM-105', type: 'form', purpose: 'new',
        title: 'แบบฟอร์มรายงานสิ่งที่ไม่เป็นไปตามข้อกำหนด (NCR)', titleEn: 'Nonconformity Report (NCR) Form',
        revision: 0, status: STATUS.PENDING_APPROVAL, createdDay: 0, sentDay: 0, relatedDept: 'ฝ่ายผลิต',
        description: 'จัดทำแบบฟอร์ม NCR ฉบับใหม่ รองรับการบันทึกสิ่งที่ไม่เป็นไปตามข้อกำหนดตามข้อ 8.7 และเชื่อมกับ CAR ตามข้อ 10.2',
        files: [
          { name: 'DAR-RVP-FM-105.pdf', size: 214000, kind: 'dar' },
          { name: 'FM-105-NCR-form-r0.docx', size: 88400, kind: 'change' }
        ],
        stakeholders: [sh('SQD'), sh('QC'), sh('PROD'), sh('IT')],
        history: [{ day: 0, actor: 'A', action: 'create' }, { day: 0, actor: 'A', action: 'send' }]
      }),

      /* ── ③ ถูกส่งกลับให้แก้ไข ─────────────────────────────── */
      mk({
        id: 'DAR003', docNo: 'RVP-SD-022', type: 'sd', purpose: 'edit',
        title: 'ผังปฏิสัมพันธ์ของกระบวนการในระบบบริหารคุณภาพ', titleEn: 'QMS Process Interaction Map',
        revision: 1, status: STATUS.RETURNED, createdDay: 0, sentDay: 0, relatedDept: 'ฝ่ายผลิต',
        lastRemark: 'กรุณาแนบผังฉบับเดิมที่จะถูกแทนที่ และระบุเหตุผลการแก้ไขในส่วนที่ 4 ให้ครบตามข้อ 7.5.3',
        description: 'ปรับผังกระบวนการหลักให้ครอบคลุมกระบวนการใหม่ และระบุปัจจัยนำเข้า/ผลลัพธ์ตามข้อ 4.4',
        files: [{ name: 'DAR-RVP-SD-022.pdf', size: 190500, kind: 'dar' }],
        stakeholders: [sh('SQD'), sh('QC')],
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'C', action: 'return', note: 'กรุณาแนบผังฉบับเดิมที่จะถูกแทนที่ และระบุเหตุผลการแก้ไขในส่วนที่ 4 ให้ครบตามข้อ 7.5.3' }
        ]
      }),

      /* ── ④ อนุมัติแล้ว รอผู้เกี่ยวข้องลงนาม ─────────────────── */
      mk({
        id: 'DAR004', docNo: 'RVP-QP-009', type: 'qp', purpose: 'new',
        title: 'ขั้นตอนการตรวจติดตามภายใน', titleEn: 'Internal Audit Procedure',
        revision: 0, status: STATUS.PENDING_SIGN, createdDay: 0, sentDay: 0, approvedDay: 0, relatedDept: 'ฝ่ายผลิต',
        description: 'จัดทำขั้นตอนการตรวจติดตามภายในตามข้อ 9.2 ครอบคลุมแผนการตรวจประจำปี เกณฑ์คัดเลือกผู้ตรวจ และการรายงานผล',
        files: [
          { name: 'DAR-RVP-QP-009.pdf', size: 268800, kind: 'dar' },
          { name: 'QP-009-internal-audit-r0.pdf', size: 512000, kind: 'change' }
        ],
        stakeholders: [sh('SQD'), sh('QC', true, 0), sh('PROD', true, 0), sh('HR'), sh('IT', true, 0)],
        signatures: { approver: SIG('C') },
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'C', action: 'approve' }
        ]
      }),

      /* ── ⑤ ลงนามครบ ส่งถึง QC รอขึ้นทะเบียน ────────────────── */
      mk({
        id: 'DAR005', docNo: 'RVP-FM-047', type: 'form', purpose: 'edit',
        title: 'แบบฟอร์มคำขอปฏิบัติการแก้ไข (CAR)', titleEn: 'Corrective Action Request (CAR) Form',
        revision: 3, status: STATUS.SENT_TO_QC, createdDay: 0, sentDay: 0, approvedDay: 0, closedDay: 0, relatedDept: 'ฝ่ายผลิต',
        description: 'เพิ่มช่องวิเคราะห์สาเหตุราก (Root Cause) และช่องติดตามผลประสิทธิผลการแก้ไขตามข้อ 10.2.1',
        files: [{ name: 'DAR-RVP-FM-047.pdf', size: 233000, kind: 'dar' }],
        stakeholders: [sh('SQD', true, 0), sh('QC', true, 0), sh('PROD', true, 0), sh('HR', true, 0), sh('FIN', true, 0)],
        signatures: { approver: SIG('C'), qcStaff: SIG('QC') },
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'C', action: 'approve' },
          { day: 0, actor: 'D', action: 'sign' },
          { day: 0, actor: 'SYSTEM', action: 'toQC' }
        ]
      }),

      /* ── ⑥ ลงนามไม่ครบใน 14 วัน → ระบบส่งกลับ ──────────────── */
      mk({
        id: 'DAR006', docNo: 'RVP-ED-011', type: 'esd', purpose: 'new',
        title: 'มาตรฐาน ISO 9001:2015 ฉบับควบคุมสำเนา', titleEn: 'ISO 9001:2015 Standard — Controlled Copy',
        revision: 0, status: STATUS.EXPIRED_RETURNED, createdDay: 0, sentDay: 0, approvedDay: 0, relatedDept: 'ฝ่ายผลิต',
        lastRemark: 'ผู้มีส่วนเกี่ยวข้องลงนามไม่ครบภายใน 14 วัน ระบบส่งกลับอัตโนมัติ',
        description: 'ขึ้นทะเบียนมาตรฐานสากลเป็นเอกสารสนับสนุนภายนอก และควบคุมการแจกจ่ายสำเนาตามข้อ 7.5.3.2',
        files: [{ name: 'DAR-RVP-ED-011.pdf', size: 205000, kind: 'dar' }],
        stakeholders: [sh('SQD', true, 0), sh('QC', true, 0), sh('PROD'), sh('HR'), sh('IT')],
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'C', action: 'approve' },
          { day: 0, actor: 'SYSTEM', action: 'expire' }
        ]
      }),

      /* ── ⑦⑧ รอผู้อนุมัติ (เพิ่มอีก 2 ฉบับ) ─────────────────── */
      mk({
        id: 'DAR007', docNo: 'RVP-QP-002', type: 'qp', purpose: 'edit',
        title: 'ขั้นตอนการควบคุมเอกสารและบันทึกคุณภาพ', titleEn: 'Control of Documented Information Procedure',
        revision: 4, status: STATUS.PENDING_APPROVAL, createdDay: 0, sentDay: 0, relatedDept: 'ฝ่าย IT',
        description: 'ปรับขั้นตอนตามข้อ 7.5 ให้รองรับการขออนุมัติและลงนามอิเล็กทรอนิกส์ผ่านระบบ DAR',
        files: [
          { name: 'DAR-RVP-QP-002.pdf', size: 259000, kind: 'dar' },
          { name: 'QP-002-r4-draft.docx', size: 141000, kind: 'change' }
        ],
        stakeholders: [sh('SQD'), sh('QC'), sh('IT')],
        history: [{ day: 0, actor: 'A', action: 'create' }, { day: 0, actor: 'A', action: 'send' }]
      }),
      mk({
        id: 'DAR008', docNo: 'RVP-FM-118', type: 'form', purpose: 'new',
        title: 'แบบฟอร์มทะเบียนรายชื่อเอกสารควบคุม (Master List)', titleEn: 'Master List of Controlled Documents',
        revision: 0, status: STATUS.PENDING_APPROVAL, createdDay: 0, sentDay: 0, relatedDept: 'ฝ่าย IT',
        description: 'แบบฟอร์มทะเบียนกลางสำหรับติดตามเลขที่เอกสาร ฉบับแก้ไข วันที่มีผลบังคับใช้ และจุดแจกจ่าย',
        files: [{ name: 'DAR-RVP-FM-118.pdf', size: 198700, kind: 'dar' }],
        stakeholders: [sh('SQD'), sh('QC')],
        history: [{ day: 0, actor: 'A', action: 'create' }, { day: 0, actor: 'A', action: 'send' }]
      }),

      /* ── ⑨⑩ อนุมัติแล้ว รอลงนาม (เพิ่มอีก 2 ฉบับ) ──────────── */
      mk({
        id: 'DAR009', docNo: 'RVP-SD-009', type: 'sd', purpose: 'cancel',
        title: 'เกณฑ์ประเมินผู้ส่งมอบฉบับเดิม (ยกเลิกการใช้งาน)', titleEn: 'Legacy Supplier Evaluation Criteria (Withdrawal)',
        revision: 2, status: STATUS.PENDING_SIGN, createdDay: 0, sentDay: 0, approvedDay: 0, relatedDept: 'ฝ่ายการเงิน',
        description: 'ยกเลิกการใช้งานเกณฑ์ประเมินผู้ส่งมอบฉบับเดิม ซึ่งถูกแทนที่ด้วย FM-063 ตามข้อ 8.4.1',
        files: [{ name: 'DAR-RVP-SD-009.pdf', size: 187300, kind: 'dar' }],
        stakeholders: [sh('SQD'), sh('QC'), sh('FIN', true, 0), sh('HR')],
        signatures: { approver: SIG('C') },
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'C', action: 'approve' }
        ]
      }),
      mk({
        id: 'DAR010', docNo: 'RVP-WI-041', type: 'wi', purpose: 'new',
        title: 'วิธีปฏิบัติงานสอบเทียบเครื่องมือวัด', titleEn: 'Measuring Equipment Calibration Work Instruction',
        revision: 0, status: STATUS.PENDING_SIGN, createdDay: 0, sentDay: 0, approvedDay: 0, relatedDept: 'ฝ่ายผลิต',
        description: 'กำหนดรอบสอบเทียบ ผู้รับผิดชอบ และการชี้บ่งสถานะเครื่องมือวัด ตามข้อ 7.1.5 ทรัพยากรสำหรับการติดตามและวัดผล',
        files: [{ name: 'DAR-RVP-WI-041.pdf', size: 241000, kind: 'dar' }],
        stakeholders: [sh('SQD'), sh('QC'), sh('PROD'), sh('IT')],
        signatures: { approver: SIG('C') },
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'C', action: 'approve' }
        ]
      }),

      /* ── ⑪ ไม่อนุมัติ (ปิดคำขอ) ───────────────────────────── */
      mk({
        id: 'DAR011', docNo: 'RVP-QM-001', type: 'qm', purpose: 'edit',
        title: 'คู่มือคุณภาพ (Quality Manual)', titleEn: 'Quality Manual',
        revision: 6, status: STATUS.REJECTED, createdDay: 0, sentDay: 0, closedDay: 0, relatedDept: 'ฝ่ายผลิต',
        lastRemark: 'การแก้ไขขอบเขตและบริบทองค์กรกระทบหลายกระบวนการ ให้เสนอผ่านการทบทวนของฝ่ายบริหารก่อนยื่นใหม่',
        description: 'ปรับขอบเขตระบบบริหารคุณภาพและบริบทองค์กรตามข้อ 4.1–4.3 ให้สอดคล้องโครงสร้างองค์กรใหม่',
        files: [{ name: 'DAR-RVP-QM-001.pdf', size: 302400, kind: 'dar' }],
        stakeholders: [sh('SQD'), sh('QC')],
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'C', action: 'reject', note: 'การแก้ไขขอบเขตและบริบทองค์กรกระทบหลายกระบวนการ ให้เสนอผ่านการทบทวนของฝ่ายบริหารก่อนยื่นใหม่' }
        ]
      }),

      /* ── ⑫–⑯ ขึ้นทะเบียนแล้ว (ทะเบียนเอกสารควบคุม) ────────── */
      mk({
        id: 'DAR012', docNo: 'RVP-QP-011', type: 'qp', purpose: 'edit',
        title: 'ขั้นตอนการทบทวนของฝ่ายบริหาร', titleEn: 'Management Review Procedure',
        revision: 5, status: STATUS.REGISTERED, createdDay: 0, sentDay: 0, approvedDay: 0, closedDay: 0, relatedDept: 'ฝ่ายผลิต',
        description: 'ปรับวาระการประชุมทบทวนฝ่ายบริหารให้ครบตามปัจจัยนำเข้า/ผลลัพธ์ในข้อ 9.3.2 และ 9.3.3',
        files: [{ name: 'DAR-RVP-QP-011.pdf', size: 226000, kind: 'dar' }],
        stakeholders: [sh('SQD', true, 0), sh('QC', true, 0), sh('PROD', true, 0)],
        signatures: { approver: SIG('C'), qcStaff: SIG('E'), qcManager: SIG('F') },
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'C', action: 'approve' },
          { day: 0, actor: 'D', action: 'sign' },
          { day: 0, actor: 'SYSTEM', action: 'toQC' },
          { day: 0, actor: 'E', action: 'register', note: 'ขึ้นทะเบียนเรียบร้อย · แจกจ่ายฉบับควบคุมแล้ว' }
        ]
      }),
      mk({
        id: 'DAR013', docNo: 'RVP-WI-052', type: 'wi', purpose: 'new',
        title: 'วิธีปฏิบัติงานชี้บ่งและสอบกลับผลิตภัณฑ์', titleEn: 'Identification & Traceability Work Instruction',
        revision: 0, status: STATUS.REGISTERED, createdDay: 0, sentDay: 0, approvedDay: 0, closedDay: 0, relatedDept: 'ฝ่ายผลิต',
        description: 'กำหนดวิธีชี้บ่งสถานะและการสอบกลับตลอดสายการผลิต ตามข้อ 8.5.2 การชี้บ่งและสอบกลับได้',
        files: [{ name: 'DAR-RVP-WI-052.pdf', size: 219400, kind: 'dar' }],
        stakeholders: [sh('SQD', true, 0), sh('QC', true, 0), sh('PROD', true, 0)],
        signatures: { approver: SIG('C'), qcStaff: SIG('E'), qcManager: SIG('F') },
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'C', action: 'approve' },
          { day: 0, actor: 'D', action: 'sign' },
          { day: 0, actor: 'SYSTEM', action: 'toQC' },
          { day: 0, actor: 'E', action: 'register', note: 'ขึ้นทะเบียนเรียบร้อย · แจกจ่ายฉบับควบคุมแล้ว' }
        ]
      }),
      mk({
        id: 'DAR014', docNo: 'RVP-FM-063', type: 'form', purpose: 'edit',
        title: 'แบบฟอร์มประเมินผู้ส่งมอบประจำปี', titleEn: 'Annual Supplier Evaluation Form',
        revision: 2, status: STATUS.REGISTERED, createdDay: 0, sentDay: 0, approvedDay: 0, closedDay: 0, relatedDept: 'ฝ่ายการเงิน',
        description: 'เพิ่มเกณฑ์ด้านคุณภาพ การส่งมอบ และการตอบสนอง สำหรับการประเมินผู้ส่งมอบภายนอกตามข้อ 8.4.1',
        files: [{ name: 'DAR-RVP-FM-063.pdf', size: 204800, kind: 'dar' }],
        stakeholders: [sh('SQD', true, 0), sh('QC', true, 0), sh('FIN', true, 0)],
        signatures: { approver: SIG('C'), qcStaff: SIG('E'), qcManager: SIG('F') },
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'C', action: 'approve' },
          { day: 0, actor: 'D', action: 'sign' },
          { day: 0, actor: 'SYSTEM', action: 'toQC' },
          { day: 0, actor: 'E', action: 'register', note: 'ขึ้นทะเบียนเรียบร้อย · แจกจ่ายฉบับควบคุมแล้ว' }
        ]
      }),
      mk({
        id: 'DAR015', docNo: 'RVP-QP-014', type: 'qp', purpose: 'new',
        title: 'ขั้นตอนการจัดการความเสี่ยงและโอกาส', titleEn: 'Risk & Opportunity Management Procedure',
        revision: 0, status: STATUS.REGISTERED, createdDay: 0, sentDay: 0, approvedDay: 0, closedDay: 0, relatedDept: 'ฝ่ายผลิต',
        description: 'กำหนดวิธีชี้บ่ง ประเมิน และจัดการความเสี่ยง/โอกาสของแต่ละกระบวนการ ตามข้อ 6.1',
        files: [{ name: 'DAR-RVP-QP-014.pdf', size: 251900, kind: 'dar' }],
        stakeholders: [sh('SQD', true, 0), sh('QC', true, 0), sh('PROD', true, 0), sh('IT', true, 0)],
        signatures: { approver: SIG('C'), qcStaff: SIG('E'), qcManager: SIG('F') },
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'C', action: 'approve' },
          { day: 0, actor: 'D', action: 'sign' },
          { day: 0, actor: 'SYSTEM', action: 'toQC' },
          { day: 0, actor: 'E', action: 'register', note: 'ขึ้นทะเบียนเรียบร้อย · แจกจ่ายฉบับควบคุมแล้ว' }
        ]
      }),
      mk({
        id: 'DAR016', docNo: 'RVP-SD-031', type: 'sd', purpose: 'edit',
        title: 'แผนฝึกอบรมและตารางความสามารถบุคลากร', titleEn: 'Training Plan & Competency Matrix',
        revision: 1, status: STATUS.REGISTERED, createdDay: 0, sentDay: 0, approvedDay: 0, closedDay: 0, relatedDept: 'ฝ่ายบุคคล',
        description: 'ปรับตารางความสามารถและแผนฝึกอบรมประจำปีให้ครอบคลุมตำแหน่งงานที่กระทบคุณภาพ ตามข้อ 7.2',
        files: [{ name: 'DAR-RVP-SD-031.pdf', size: 197600, kind: 'dar' }],
        stakeholders: [sh('SQD', true, 0), sh('QC', true, 0), sh('HR', true, 0)],
        signatures: { approver: SIG('C'), qcStaff: SIG('E'), qcManager: SIG('F') },
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'C', action: 'approve' },
          { day: 0, actor: 'D', action: 'sign' },
          { day: 0, actor: 'SYSTEM', action: 'toQC' },
          { day: 0, actor: 'E', action: 'register', note: 'ขึ้นทะเบียนเรียบร้อย · แจกจ่ายฉบับควบคุมแล้ว' }
        ]
      }),

      /* ── ⑰–㉑ อีกชุดหนึ่ง เพื่อให้ทุกสถานะมีตัวอย่างอย่างน้อย 2 ฉบับ ───── */
      mk({
        id: 'DAR017', docNo: 'RVP-QP-016', type: 'qp', purpose: 'new',
        title: 'ขั้นตอนการควบคุมผลิตภัณฑ์ที่ไม่เป็นไปตามข้อกำหนด', titleEn: 'Control of Nonconforming Output Procedure',
        revision: 0, status: STATUS.DRAFT, createdDay: 0, relatedDept: 'ฝ่ายผลิต',
        description: 'กำหนดวิธีชี้บ่ง แยกเก็บ ตัดสินใจ และบันทึกผลิตภัณฑ์ที่ไม่เป็นไปตามข้อกำหนด ตามข้อ 8.7',
        files: [{ name: 'DAR-RVP-QP-016.pdf', size: 238100, kind: 'dar' }],
        stakeholders: [sh('SQD'), sh('QC'), sh('PROD')],
        history: [{ day: 0, actor: 'A', action: 'create' }]
      }),
      mk({
        id: 'DAR018', docNo: 'RVP-FM-072', type: 'form', purpose: 'edit',
        title: 'แบบฟอร์มรายงานผลการตรวจติดตามภายใน', titleEn: 'Internal Audit Report Form',
        revision: 1, status: STATUS.RETURNED, createdDay: 0, sentDay: 0, relatedDept: 'ฝ่ายผลิต',
        lastRemark: 'ยังไม่ได้แนบ Checklist ที่ใช้ตรวจจริง และช่องสรุปผลควรแยกข้อบกพร่องหลัก/รอง ตามข้อ 9.2.2',
        description: 'ปรับแบบฟอร์มรายงานผลการตรวจติดตามภายในให้บันทึกข้อบกพร่องและกำหนดวันปิดได้ในฉบับเดียว',
        files: [{ name: 'DAR-RVP-FM-072.pdf', size: 201400, kind: 'dar' }],
        stakeholders: [sh('SQD'), sh('QC')],
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'C', action: 'return', note: 'ยังไม่ได้แนบ Checklist ที่ใช้ตรวจจริง และช่องสรุปผลควรแยกข้อบกพร่องหลัก/รอง ตามข้อ 9.2.2' }
        ]
      }),
      mk({
        id: 'DAR019', docNo: 'RVP-WI-027', type: 'wi', purpose: 'edit',
        title: 'วิธีปฏิบัติงานควบคุมสภาพแวดล้อมในการทำงาน', titleEn: 'Work Environment Control Work Instruction',
        revision: 2, status: STATUS.SENT_TO_QC, createdDay: 0, sentDay: 0, approvedDay: 0, closedDay: 0, relatedDept: 'ฝ่ายผลิต',
        description: 'เพิ่มเกณฑ์อุณหภูมิ ความชื้น และความสะอาดของพื้นที่ปฏิบัติงาน พร้อมรอบการตรวจ ตามข้อ 7.1.4',
        files: [{ name: 'DAR-RVP-WI-027.pdf', size: 228700, kind: 'dar' }],
        stakeholders: [sh('SQD', true, 0), sh('QC', true, 0), sh('PROD', true, 0), sh('HR', true, 0)],
        signatures: { approver: SIG('C'), qcStaff: SIG('QC') },
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'C', action: 'approve' },
          { day: 0, actor: 'D', action: 'sign' },
          { day: 0, actor: 'SYSTEM', action: 'toQC' }
        ]
      }),
      mk({
        id: 'DAR020', docNo: 'RVP-SD-045', type: 'sd', purpose: 'new',
        title: 'ทะเบียนกฎหมายและข้อกำหนดที่เกี่ยวข้อง', titleEn: 'Register of Legal & Other Requirements',
        revision: 0, status: STATUS.EXPIRED_RETURNED, createdDay: 0, sentDay: 0, approvedDay: 0, relatedDept: 'ฝ่ายบุคคล',
        lastRemark: 'ผู้มีส่วนเกี่ยวข้องลงนามไม่ครบภายใน 14 วัน ระบบส่งกลับอัตโนมัติ',
        description: 'รวบรวมกฎหมายและข้อกำหนดที่องค์กรต้องปฏิบัติตาม พร้อมผู้รับผิดชอบและรอบทบทวน ตามข้อ 4.2',
        files: [{ name: 'DAR-RVP-SD-045.pdf', size: 212900, kind: 'dar' }],
        stakeholders: [sh('SQD', true, 0), sh('HR', true, 0), sh('QC'), sh('FIN'), sh('IT')],
        signatures: { approver: SIG('C') },
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'C', action: 'approve' },
          { day: 0, actor: 'SYSTEM', action: 'expire' }
        ]
      }),
      mk({
        id: 'DAR021', docNo: 'RVP-ED-018', type: 'esd', purpose: 'new',
        title: 'คู่มือเครื่องจักรจากผู้ผลิต (ฉบับแปลไทย)', titleEn: 'Vendor Machine Manual (Thai Translation)',
        revision: 0, status: STATUS.REJECTED, createdDay: 0, sentDay: 0, closedDay: 0, relatedDept: 'ฝ่ายผลิต',
        lastRemark: 'ฉบับแปลยังไม่ผ่านการทวนสอบกับต้นฉบับ ให้ขึ้นทะเบียนต้นฉบับก่อน แล้วค่อยเสนอฉบับแปลเป็นเอกสารแนบ',
        description: 'ขอขึ้นทะเบียนคู่มือเครื่องจักรฉบับแปลไทยเป็นเอกสารสนับสนุนภายนอก ตามข้อ 7.5.3',
        files: [{ name: 'DAR-RVP-ED-018.pdf', size: 244300, kind: 'dar' }],
        stakeholders: [sh('SQD'), sh('QC'), sh('PROD')],
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'C', action: 'reject', note: 'ฉบับแปลยังไม่ผ่านการทวนสอบกับต้นฉบับ ให้ขึ้นทะเบียนต้นฉบับก่อน แล้วค่อยเสนอฉบับแปลเป็นเอกสารแนบ' }
        ]
      })
    ];

    /* รายละเอียดวัตถุประสงค์ (ส่วนที่ 2 ของฟอร์ม) — ให้ทุกคำขอมีข้อมูลครบ ไม่มีช่องว่าง */
    const PURPOSE_DETAIL = {
      DAR001: 'แก้ไขข้อ 4.2 เกณฑ์การสุ่มตรวจ และเพิ่มผู้มีอำนาจปล่อยงานกรณีหัวหน้าส่วนไม่อยู่',
      DAR002: 'จัดทำแบบฟอร์ม NCR ใหม่แทนการบันทึกในสมุดปกแข็ง เพื่อให้สอบกลับและสรุปสถิติได้',
      DAR003: 'ปรับผังกระบวนการให้ตรงกับโครงสร้างจริงหลังรวมหน่วยงาน และเพิ่มตัวชี้วัดของแต่ละกระบวนการ',
      DAR004: 'จัดทำขั้นตอนการตรวจติดตามภายในฉบับแรกของบริษัท เพื่อรองรับการตรวจ Surveillance Audit',
      DAR005: 'เพิ่มช่องวิเคราะห์สาเหตุรากและช่องติดตามประสิทธิผล หลังพบว่าปัญหาเดิมกลับมาซ้ำ',
      DAR006: 'ขึ้นทะเบียนมาตรฐาน ISO 9001:2015 เป็นเอกสารสนับสนุนภายนอก และควบคุมสำเนาที่แจกจ่าย',
      DAR007: 'ปรับขั้นตอนให้รองรับการอนุมัติและลงนามผ่านระบบ DAR แทนการเดินเอกสารกระดาษ',
      DAR008: 'จัดทำทะเบียนกลางของเอกสารควบคุมทั้งหมด เพื่อใช้ตรวจสอบฉบับล่าสุดก่อนนำไปใช้งาน',
      DAR009: 'ยกเลิกเกณฑ์ประเมินผู้ส่งมอบฉบับเดิม เนื่องจากถูกแทนที่ด้วย FM-063 ตั้งแต่รอบประเมินปีนี้',
      DAR010: 'จัดทำวิธีปฏิบัติงานสอบเทียบ หลังการตรวจติดตามภายในพบว่าเครื่องมือวัดบางรายการเลยรอบสอบเทียบ',
      DAR011: 'ปรับขอบเขตและบริบทองค์กรในคู่มือคุณภาพให้ตรงกับโครงสร้างใหม่หลังตั้งฝ่ายปฏิบัติการ',
      DAR012: 'เพิ่มวาระความเสี่ยง/โอกาส และผลการประเมินผู้ส่งมอบ เข้าในวาระประชุมทบทวนฝ่ายบริหาร',
      DAR013: 'จัดทำวิธีการชี้บ่งสถานะและหมายเลขล็อต เพื่อให้สอบกลับได้ตลอดสายการผลิต',
      DAR014: 'ปรับเกณฑ์การให้คะแนนผู้ส่งมอบ และกำหนดเกณฑ์ผ่านขั้นต่ำใหม่เป็น 70 คะแนน',
      DAR015: 'จัดทำขั้นตอนการจัดการความเสี่ยงและโอกาสประจำปี พร้อมแบบประเมินระดับความเสี่ยง',
      DAR016: 'ปรับตารางความสามารถให้ครอบคลุมตำแหน่งงานใหม่ และกำหนดหลักสูตรอบรมประจำปี',
      DAR017: 'จัดทำขั้นตอนควบคุมของเสีย/งานไม่ผ่าน ให้ชัดเจนว่าใครเป็นผู้ตัดสินใจแก้ไข ลดเกรด หรือทำลาย',
      DAR018: 'ปรับแบบฟอร์มรายงานผลการตรวจติดตามภายในให้บันทึกข้อบกพร่องและวันปิดได้ในฉบับเดียว',
      DAR019: 'เพิ่มเกณฑ์อุณหภูมิ ความชื้น และรอบการตรวจพื้นที่ปฏิบัติงาน หลังลูกค้าสอบถามเรื่องสภาพจัดเก็บ',
      DAR020: 'จัดทำทะเบียนกฎหมายที่เกี่ยวข้อง พร้อมผู้รับผิดชอบและรอบทบทวนทุก 6 เดือน',
      DAR021: 'ขอขึ้นทะเบียนคู่มือเครื่องจักรฉบับแปลไทย เพื่อให้ช่างที่หน้างานใช้อ้างอิงได้โดยตรง'
    };

    /* ทำให้ข้อมูลตัวอย่างดู "มีอายุ" ต่างกัน เพื่อให้เดโมเห็นตัวเลขวันจริง */
    const ages = {
      DAR001: 0, DAR002: 2, DAR003: 1, DAR004: 10, DAR005: 9, DAR006: 14, DAR007: 5, DAR008: 12,
      DAR009: 3, DAR010: 6, DAR011: 4, DAR012: 11, DAR013: 16, DAR014: 21, DAR015: 27, DAR016: 33,
      DAR017: 0, DAR018: 2, DAR019: 7, DAR020: 15, DAR021: 8
    };
    const dayTxt = (n) => 'D' + (n < 0 ? '' : '+') + n;

    docs.forEach(d => {
      const age = ages[d.id] || 0;
      d.createdDay = -age;
      if (d.sentDay !== null) d.sentDay = -age;
      if (d.approvedDay !== null) d.approvedDay = -age + 1;
      if (d.closedDay !== null) d.closedDay = 0;
      d.history.forEach((h, i) => { h.day = -age + Math.min(i, age); });
      d.stakeholders.forEach(s => { if (s.signed) s.signedDay = -age + 2; });

      /* เติมช่องที่ฟอร์มต้องใช้ให้ครบ — วันที่ยื่น / วันที่มีผลบังคับใช้ / รายละเอียดวัตถุประสงค์ */
      d.requestDate = dateStr(d.createdDay);
      d.effectiveDate = dateStr(d.createdDay + 30);
      d.purposeDetail = PURPOSE_DETAIL[d.id] || '';
    });

    /* ══════════════════════════════════════════
       เติมงานของทุกบทบาทให้ "ครบตามขั้นที่เดินมาถึง"
       — เอกสารอยู่ขั้นไหน ลายเซ็น/ชื่อ/ตำแหน่ง/วันที่ ของขั้นก่อนหน้าต้องมีครบ
       ══════════════════════════════════════════ */
    const OWNER_QUEUE  = ['DAR002', 'DAR008'];   /* ค้างที่หน่วยงานเจ้าของเอกสาร */
    const QC_MGR_QUEUE = ['DAR005'];             /* ค้างที่ผู้จัดการแผนกควบคุมคุณภาพ */

    docs.forEach(d => {
      if (OWNER_QUEUE.indexOf(d.id) !== -1 && d.status === STATUS.PENDING_APPROVAL) d.status = STATUS.PENDING_OWNER;
      if (QC_MGR_QUEUE.indexOf(d.id) !== -1 && d.status === STATUS.SENT_TO_QC) d.status = STATUS.PENDING_QC_MANAGER;
    });

    /* ขั้นที่เอกสารเดินผ่านมาแล้ว (ตามสถานะปัจจุบัน) */
    const PASSED = {
      DRAFT:              ['requester'],
      RETURNED:           ['requester'],
      EXPIRED_RETURNED:   ['requester', 'owner', 'approver'],
      PENDING_OWNER:      ['requester'],
      PENDING_APPROVAL:   ['requester', 'owner'],
      REJECTED:           ['requester', 'owner'],
      PENDING_SIGN:       ['requester', 'owner', 'approver'],
      SENT_TO_QC:         ['requester', 'owner', 'approver'],
      PENDING_QC_MANAGER: ['requester', 'owner', 'approver', 'qcStaff'],
      REGISTERED:         ['requester', 'owner', 'approver', 'qcStaff', 'qcManager']
    };
    const SIGNER = { requester: 'A', owner: 'B', approver: 'C', qcStaff: 'E', qcManager: 'F' };

    docs.forEach(d => {
      const age = ages[d.id] || 0;
      d.signatures = d.signatures || {};

      /* ① ลายเซ็นตามขั้นที่ผ่านมา — เติมภาพ/ชื่อ/ตำแหน่ง/วันที่ให้ครบทุกช่อง */
      const passed = PASSED[d.status] || ['requester'];
      const step = { requester: 0, owner: 1, approver: 2, qcStaff: age - 1, qcManager: age };
      passed.forEach(k => {
        const dayOffset = -age + Math.min(step[k] || 0, age);
        d.signatures[k] = SIG(SIGNER[k], dayOffset);
      });
      /* ช่องของขั้นที่ยังไม่ถึง ต้องว่างไว้ */
      Object.keys(SIGNER).forEach(k => { if (passed.indexOf(k) === -1) delete d.signatures[k]; });

      /* ② ผู้มีส่วนเกี่ยวข้องที่ลงนามแล้ว — ใส่ลายเซ็น ชื่อ ตำแหน่ง วันที่ ให้ครบ */
      (d.stakeholders || []).forEach(sk => {
        if (!sk.signed) { delete sk.sigImg; delete sk.signName; delete sk.signAt; delete sk.signPosition; return; }
        const u = USERS.find(x => x.role === 'stakeholder');
        sk.sigImg = sk.sigImg || sigImage(sk.name, u ? u.color : '#6d28d9');
        sk.signName = sk.signName || (u ? u.name : sk.name);
        sk.signPosition = sk.signPosition || (u ? u.position : 'หัวหน้าแผนก');
        sk.signAt = sk.signAt || dateStr(sk.signedDay || 0);
      });

      /* ③ ประวัติการทำงานให้ตรงกับขั้นที่ผ่านมา */
      const addHist = (after, actor, action) => {
        if (d.history.some(h => h.action === action)) return;
        const at = d.history.findIndex(h => h.action === after);
        if (at === -1) return;
        d.history.splice(at + 1, 0, { day: d.history[at].day, actor: actor, action: action, note: '' });
      };
      if (passed.indexOf('owner') !== -1) addHist('send', 'B', 'ownerSign');
      if (passed.indexOf('qcStaff') !== -1) {
        if (d.history.some(h => h.action === 'toQC')) addHist('toQC', 'E', 'qcStaffSign');
        else if (!d.history.some(h => h.action === 'qcStaffSign')) {
          d.history.push({ day: 0, actor: 'E', action: 'qcStaffSign', note: '' });
        }
      }
    });

    return {
      version: DB_VERSION,
      day: 0,                 /* วันจำลองปัจจุบัน (0 = วันนี้) */
      seq: 21,
      docs: docs,
      notifications: seedNotifications(docs)
    };
  }

  function seedNotifications(docs) {
    const list = [];
    let n = 1;
    const push = (to, docId, key, day) => {
      const d = docs.find(x => x.id === docId);
      list.push({
        id: 'N' + (n++), to: to, docId: docId,
        docNo: d ? d.docNo : docId, title: d ? d.title : '', titleEn: d ? d.titleEn : '',
        key: key, day: day, read: false
      });
    };
    push('owner', 'DAR002', 'n.sent', -2);
    push('owner', 'DAR008', 'n.sent', -12);
    push('approver', 'DAR007', 'n.sent', -5);
    push('approver', 'DAR004', 'n.sent', -9);
    push('requester', 'DAR007', 'n.ownerSigned', -5);
    push('requester', 'DAR003', 'n.returned', -1);
    push('requester', 'DAR011', 'n.rejected', -4);
    push('stakeholder', 'DAR004', 'n.approved', -9);
    push('stakeholder', 'DAR009', 'n.approved', -2);
    push('stakeholder', 'DAR010', 'n.approved', -5);
    push('requester', 'DAR006', 'n.expired', 0);
    push('requester', 'DAR005', 'n.allSigned', 0);
    push('qc', 'DAR005', 'n.allSigned', 0);
    push('qcManager', 'DAR005', 'n.qcStaffSigned', 0);
    push('qc', 'DAR012', 'n.registered', -1);
    push('requester', 'DAR012', 'n.registered', -1);
    push('qc', 'DAR013', 'n.registered', -6);
    push('requester', 'DAR014', 'n.registered', -11);
    push('requester', 'DAR018', 'n.returned', -1);
    push('qc', 'DAR019', 'n.allSigned', -2);
    push('qcManager', 'DAR012', 'n.registered', -1);
    push('requester', 'DAR020', 'n.expired', 0);
    push('requester', 'DAR021', 'n.rejected', -6);
    return list;
  }

  /* ══════════════════════════════════════════
     โหลด / บันทึก
     ══════════════════════════════════════════ */
  let db = null;

  /* ตัวเลขรุ่นข้อมูล — เก็บแยกคีย์เล็ก ๆ เพื่อให้หน้าอื่นเช็คได้ว่ามีอะไรเปลี่ยนไหม
     โดยไม่ต้องอ่าน/แปลงฐานข้อมูลทั้งก้อน */
  const REV_KEY = 'rvp_rev';
  let seenRev = null;

  function rev() {
    try { return localStorage.getItem(REV_KEY) || ''; } catch (e) { return ''; }
  }

  function bumpRev() {
    try { localStorage.setItem(REV_KEY, String(Date.now()) + '.' + Math.random().toString(36).slice(2, 7)); } catch (e) {}
  }

  /* มีบทบาทอื่นบันทึกข้อมูลใหม่หรือยัง (แท็บอื่น / หน้าต่างอื่น) */
  function isStale() { return rev() !== seenRev; }

  /* ดึงข้อมูลรุ่นล่าสุดมาใช้ — คืน true ถ้ามีการเปลี่ยนแปลงจริง */
  function syncIfStale() {
    if (!isStale()) return false;
    db = null;
    load();
    return true;
  }

  function load() {
    if (db) return db;
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === DB_VERSION) { db = parsed; seenRev = rev(); return db; }
      }
    } catch (e) { /* ข้อมูลเสีย → seed ใหม่ */ }
    db = seed();
    save();
    return db;
  }

  function save() {
    try {
      /* ไม่บันทึก blob URL ชั่วคราว (คีย์ที่ขึ้นต้นด้วย _) */
      localStorage.setItem(DB_KEY, JSON.stringify(db, (k, v) => (k.charAt(0) === '_' ? undefined : v)));
    } catch (e) {
      /* พื้นที่เต็ม — ทิ้งไฟล์แนบที่หนักที่สุดแล้วลองใหม่ 1 ครั้ง */
      try {
        const all = [];
        db.docs.forEach(d => (d.files || []).forEach(f => { if (f.data) all.push(f); }));
        all.sort((a, b) => b.data.length - a.data.length).slice(0, 3).forEach(f => { delete f.data; f.dropped = true; });
        localStorage.setItem(DB_KEY, JSON.stringify(db, (k, v) => (k.charAt(0) === '_' ? undefined : v)));
      } catch (e2) {}
    }
    bumpRev();
    seenRev = rev();
    document.dispatchEvent(new CustomEvent('storechange'));
  }

  /* แท็บอื่นบันทึกข้อมูล → ทิ้งของเก่าในหน่วยความจำ แล้วบอกหน้าให้วาดใหม่ */
  window.addEventListener('storage', function (e) {
    if (e.key !== DB_KEY && e.key !== REV_KEY) return;
    db = null;
    seenRev = rev();
    document.dispatchEvent(new CustomEvent('storechange'));
  });

  function reset() {
    db = seed();
    save();
  }

  /* ══════════════════════════════════════════
     Session / Auth  (mock — ไม่มีการตรวจสอบจริง)
     ══════════════════════════════════════════ */
  function login(username, password) {
    const u = USERS.find(x => x.username.toLowerCase() === String(username || '').trim().toLowerCase());
    if (!u) return null;
    if (password && password !== u.password && password !== '') { /* mockup: ยอมรับรหัสผ่านใดก็ได้ */ }
    localStorage.setItem(SESSION_KEY, u.id);
    return u;
  }

  function loginAs(userId) {
    const u = USERS.find(x => x.id === userId);
    if (!u) return null;
    localStorage.setItem(SESSION_KEY, u.id);
    return u;
  }

  function logout() { localStorage.removeItem(SESSION_KEY); }

  function currentUser() {
    const id = localStorage.getItem(SESSION_KEY);
    return USERS.find(x => x.id === id) || null;
  }

  /* ══════════════════════════════════════════
     Helper
     ══════════════════════════════════════════ */
  function today() { return load().day; }

  function ageOf(doc) {
    const d = load();
    const start = doc.sentDay !== null && doc.sentDay !== undefined ? doc.sentDay : doc.createdDay;
    return Math.max(0, d.day - start);
  }

  function remainingOf(doc) { return doc.dueDays - ageOf(doc); }

  function signedCount(doc) { return (doc.stakeholders || []).filter(s => s.signed).length; }
  function totalSigners(doc) { return (doc.stakeholders || []).length; }

  function docTypeLabel(type, lang) {
    const t = DOC_TYPES[type];
    if (!t) return type;
    return lang === 'en' ? t.en : t.th;
  }

  function purposeLabel(p, lang) {
    const t = PURPOSES[p];
    if (!t) return p;
    return lang === 'en' ? t.en : t.th;
  }

  function docTitle(doc, lang) {
    return lang === 'en' && doc.titleEn ? doc.titleEn : doc.title;
  }

  function statusStyle(status) { return STATUS_STYLE[status] || STATUS_STYLE.DRAFT; }

  function getDoc(id) { return load().docs.find(d => d.id === id) || null; }

  function allDocs() { return load().docs.slice(); }

  /* เอกสารที่ role นั้น ๆ ควรเห็นในหน้า workspace ของตัวเอง */
  function docsForRole(role, userId) {
    const list = load().docs;
    if (role === 'requester') {
      return list.filter(d => d.requesterId === (userId || 'A'));
    }
    if (role === 'owner') {
      /* เอกสารที่ผู้ร้องขอส่งมาแล้ว — คิวของตัวเองคือที่รอลงนามส่วนที่ 5 */
      return list.filter(d => [STATUS.PENDING_OWNER, STATUS.PENDING_APPROVAL, STATUS.RETURNED,
        STATUS.REJECTED, STATUS.PENDING_SIGN, STATUS.SENT_TO_QC, STATUS.REGISTERED,
        STATUS.EXPIRED_RETURNED].indexOf(d.status) !== -1);
    }
    if (role === 'approver') {
      return list.filter(d => [STATUS.PENDING_APPROVAL, STATUS.RETURNED, STATUS.REJECTED,
        STATUS.PENDING_SIGN, STATUS.SENT_TO_QC, STATUS.REGISTERED].indexOf(d.status) !== -1);
    }
    if (role === 'stakeholder') {
      /* ผู้มีส่วนเกี่ยวข้องเห็นทุกฉบับที่ผู้อนุมัติส่งมาให้ลงนาม
         (ช่องที่ตรงกับตัวเอง/แผนกของตัวเองก่อน ถ้าไม่มีจึงรับช่องที่ยังไม่มีใครเซ็น) */
      return list.filter(d =>
        [STATUS.PENDING_SIGN, STATUS.SENT_TO_QC, STATUS.REGISTERED, STATUS.EXPIRED_RETURNED].indexOf(d.status) !== -1 &&
        !!slotForUser(d, userId)
      );
    }
    if (role === 'qc') {
      /* เจ้าหน้าที่ควบคุมคุณภาพเห็นเฉพาะเอกสารที่เดินมาถึงแผนกแล้ว */
      return list.filter(d =>
        [STATUS.SENT_TO_QC, STATUS.PENDING_QC_MANAGER, STATUS.REGISTERED,
         STATUS.PENDING_SIGN, STATUS.RETURNED].indexOf(d.status) !== -1);
    }
    if (role === 'qcManager') {
      /* ผู้จัดการแผนก — คิวคือเอกสารที่เจ้าหน้าที่ลงนามแล้ว รอขึ้นทะเบียน */
      return list.filter(d =>
        [STATUS.PENDING_QC_MANAGER, STATUS.REGISTERED, STATUS.SENT_TO_QC,
         STATUS.PENDING_SIGN, STATUS.RETURNED].indexOf(d.status) !== -1);
    }
    return list;
  }

  /* หาช่องลงนามของผู้ใช้คนนี้ในเอกสาร
     ① ช่องที่ผูกกับบัญชีของเขาโดยตรง
     ② ช่องที่เป็นแผนกของเขา
     ③ ช่องที่ยังไม่มีใครลงนาม — ผู้ร้องขออาจเลือกเฉพาะชื่อแผนก
        ถ้าไม่มีข้อนี้ เอกสารที่ผู้อนุมัติส่งมาจะไม่ขึ้นให้ลงนามเลย */
  function slotForUser(doc, userId) {
    const u = USERS.find(x => x.id === (userId || 'D')) || { id: userId || 'D', dept: '' };
    const list = doc && doc.stakeholders ? doc.stakeholders : [];
    return list.find(s => s.userId === u.id) ||
           list.find(s => s.id === u.dept) ||
           list.find(s => !s.signed) ||
           list[0] || null;
  }

  function mySignSlot(doc, user) {
    if (!doc || !user || user.role !== 'stakeholder') return null;
    return slotForUser(doc, user.id);
  }

  /* ══════════════════════════════════════════
     สิทธิ์ตาม Role + สถานะ (ข้อ 4 ของข้อกำหนด)
     ══════════════════════════════════════════ */
  function permissions(doc, user) {
    const p = { view: false, edit: false, draft: false, send: false, preview: false,
                approve: false, reject: false, return: false, sign: false, register: false,
                ownerSign: false, qcSign: false };
    if (!doc || !user) return p;
    p.view = true;
    p.preview = true;

    if (user.role === 'requester' && doc.requesterId === user.id) {
      if (doc.status === STATUS.DRAFT) { p.edit = true; p.draft = true; p.send = true; }
      if (doc.status === STATUS.RETURNED || doc.status === STATUS.EXPIRED_RETURNED) { p.edit = true; p.draft = true; p.send = true; }
    }

    if (user.role === 'owner' && doc.status === STATUS.PENDING_OWNER) {
      p.ownerSign = true; p.return = true;
    }

    if (user.role === 'approver' && doc.status === STATUS.PENDING_APPROVAL) {
      p.approve = true; p.reject = true; p.return = true;
    }

    if (user.role === 'stakeholder' && doc.status === STATUS.PENDING_SIGN) {
      const slot = mySignSlot(doc, user);
      if (slot && !slot.signed) p.sign = true;
    }

    /* ⑧ เจ้าหน้าที่ควบคุมคุณภาพ — ลงนามส่วนที่ 6 ช่องเจ้าหน้าที่ */
    if (user.role === 'qc' && doc.status === STATUS.SENT_TO_QC) {
      p.qcSign = true; p.return = true;
    }

    /* ⑨ ผู้จัดการแผนกควบคุมคุณภาพ — ลงนามแล้วขึ้นทะเบียน (ขั้นสุดท้ายของ flow) */
    if (user.role === 'qcManager' && doc.status === STATUS.PENDING_QC_MANAGER) {
      p.register = true; p.return = true;
    }
    return p;
  }

  /* ══════════════════════════════════════════
     Notification
     ══════════════════════════════════════════ */
  function notify(toRole, doc, key) {
    const d = load();
    d.notifications.unshift({
      id: 'N' + Date.now() + Math.floor(Math.random() * 1000),
      to: toRole, docId: doc.id, docNo: doc.docNo,
      title: doc.title, titleEn: doc.titleEn,
      key: key, day: d.day, read: false
    });
    if (d.notifications.length > 60) d.notifications.length = 60;
  }

  function notificationsFor(role) {
    return load().notifications.filter(n => n.to === role);
  }

  function unreadCount(role) {
    return notificationsFor(role).filter(n => !n.read).length;
  }

  function markAllRead(role) {
    load().notifications.forEach(n => { if (n.to === role) n.read = true; });
    save();
  }

  function markRead(id) {
    const n = load().notifications.find(x => x.id === id);
    if (n) { n.read = true; save(); }
  }

  /* ══════════════════════════════════════════
     Workflow transitions (ตาม Flow chart)
     ══════════════════════════════════════════ */
  function pushHistory(doc, actor, action, note) {
    doc.history = doc.history || [];
    doc.history.push({ day: load().day, actor: actor, action: action, note: note || '' });
  }

  /* ① สร้าง / บันทึกร่าง */
  function createDraft(data, user) {
    const d = load();
    d.seq += 1;
    const id = 'DAR' + String(d.seq).padStart(3, '0');
    const doc = {
      id: id,
      docNo: data.docNo || ('RVP-NEW-' + String(d.seq).padStart(3, '0')),
      title: data.title || 'เอกสารใหม่',
      titleEn: data.titleEn || data.title || 'New document',
      type: data.type || 'wi',
      purpose: data.purpose || 'new',
      purposeDetail: data.purposeDetail || '',
      revision: data.revision || 0,
      description: data.description || '',
      relatedDept: data.relatedDept || '',
      effectiveDate: data.effectiveDate || '',
      requesterId: user ? user.id : 'A',
      requesterName: data.requesterName || (user ? user.name : USERS[0].name),
      requesterNameEn: data.requesterName || (user ? user.nameEn : USERS[0].nameEn),
      requesterDept: data.dept || (user ? user.dept : ''),
      requesterEmpId: data.empId || (user ? user.empId : ''),
      requestDate: data.requestDate || '',
      status: STATUS.DRAFT,
      createdDay: d.day, sentDay: null, approvedDay: null, closedDay: null,
      dueDays: 14,
      files: data.files || [],
      stakeholders: (data.stakeholders || []).map(normSh).filter(Boolean),
      signatures: data.signatures || {},
      lastRemark: '',
      history: []
    };
    pushHistory(doc, doc.requesterId, 'create');
    d.docs.unshift(doc);
    notify('requester', doc, 'n.draft');
    save();
    return doc;
  }

  function updateDraft(id, data) {
    const doc = getDoc(id);
    if (!doc) return null;
    ['docNo', 'title', 'titleEn', 'type', 'purpose', 'purposeDetail', 'revision',
     'description', 'relatedDept', 'effectiveDate', 'requestDate'].forEach(k => {
      if (data[k] !== undefined && data[k] !== '') doc[k] = data[k];
    });
    if (data.dept) doc.requesterDept = data.dept;
    if (data.empId) doc.requesterEmpId = data.empId;
    if (data.requesterName) { doc.requesterName = data.requesterName; doc.requesterNameEn = data.requesterName; }
    if (data.files) doc.files = data.files;
    if (data.stakeholders) doc.stakeholders = data.stakeholders.map(normSh).filter(Boolean);
    if (data.signatures) {
      doc.signatures = Object.assign({}, doc.signatures, data.signatures);
      /* ช่องที่ผู้จัดทำลบลายเซ็นออก ต้องหายไปจากเอกสารด้วย
         (เฉพาะช่องของผู้จัดทำเอง — ช่องหน่วยงานเจ้าของเอกสารเป็นของบทบาทอื่น) */
      ['requester'].forEach(k => {
        if (!data.signatures[k]) delete doc.signatures[k];
      });
    }
    save();
    return doc;
  }

  /* ④ ส่งเอกสารให้ผู้อนุมัติ */
  function send(id, user, remark) {
    const doc = getDoc(id);
    if (!doc) return null;
    /* ผู้ร้องขอส่ง → หน่วยงานเจ้าของเอกสารลงนามส่วนที่ 5 ก่อน แล้วจึงถึงผู้อนุมัติ */
    doc.status = STATUS.PENDING_OWNER;
    doc.sentDay = load().day;
    doc.lastRemark = remark || '';
    pushHistory(doc, user ? user.id : 'A', 'send', remark);
    notify('owner', doc, 'n.sent');
    save();
    return doc;
  }

  /* ⑥ อนุมัติ → ส่งต่อผู้มีส่วนเกี่ยวข้อง */
  function approve(id, user, remark) {
    const doc = getDoc(id);
    if (!doc) return null;
    doc.status = STATUS.PENDING_SIGN;
    doc.approvedDay = load().day;
    doc.lastRemark = remark || '';
    doc.signatures = doc.signatures || {};
    doc.signatures.approver = { by: user ? user.id : 'C', day: load().day, label: 'ลายเซ็นอิเล็กทรอนิกส์' };
    pushHistory(doc, user ? user.id : 'C', 'approve', remark);
    notify('stakeholder', doc, 'n.approved');
    notify('requester', doc, 'n.approved');
    save();
    return doc;
  }

  /* ⑤ หน่วยงานเจ้าของเอกสารลงนามส่วนที่ 5 → ส่งต่อผู้อนุมัติ */
  function ownerSign(id, user, remark) {
    const doc = getDoc(id);
    if (!doc) return null;
    doc.status = STATUS.PENDING_APPROVAL;
    doc.lastRemark = remark || '';
    doc.signatures = doc.signatures || {};
    doc.signatures.owner = Object.assign(
      { by: user ? user.id : 'B', day: load().day, label: 'ลายเซ็นอิเล็กทรอนิกส์' },
      doc.signatures.owner
    );
    pushHistory(doc, user ? user.id : 'B', 'ownerSign', remark);
    notify('approver', doc, 'n.sent');
    notify('requester', doc, 'n.ownerSigned');
    save();
    return doc;
  }

  /* ⑥ ส่งกลับไปแก้ไข */
  function returnForEdit(id, user, remark) {
    const doc = getDoc(id);
    if (!doc) return null;
    doc.status = STATUS.RETURNED;
    doc.lastRemark = remark || '';
    pushHistory(doc, user ? user.id : 'C', 'return', remark);
    notify('requester', doc, 'n.returned');
    save();
    return doc;
  }

  /* ⑥ ไม่อนุมัติ → ปิดคำขอ */
  function reject(id, user, remark) {
    const doc = getDoc(id);
    if (!doc) return null;
    doc.status = STATUS.REJECTED;
    doc.closedDay = load().day;
    doc.lastRemark = remark || '';
    pushHistory(doc, user ? user.id : 'C', 'reject', remark);
    notify('requester', doc, 'n.rejected');
    save();
    return doc;
  }

  /* ⑦ ผู้เกี่ยวข้องลงนาม — ถ้าครบทุกคนจะส่งต่อ QC อัตโนมัติ */
  function sign(id, user, remark) {
    const doc = getDoc(id);
    if (!doc) return null;
    const slot = mySignSlot(doc, user);
    if (slot) { slot.signed = true; slot.signedDay = load().day; }
    pushHistory(doc, user ? user.id : 'D', 'sign', remark);

    if (signedCount(doc) >= totalSigners(doc) && totalSigners(doc) > 0) {
      doc.status = STATUS.SENT_TO_QC;
      doc.closedDay = load().day;
      pushHistory(doc, 'SYSTEM', 'toQC');
      notify('requester', doc, 'n.allSigned');
      notify('approver', doc, 'n.allSigned');
      notify('stakeholder', doc, 'n.allSigned');
    } else {
      notify('requester', doc, 'n.signed');
    }
    save();
    return doc;
  }

  /* เดโม: จำลองให้ผู้เกี่ยวข้องคนอื่นลงนาม (ใช้ในหน้าเอกสาร) */
  function signAs(id, stakeholderId) {
    const doc = getDoc(id);
    if (!doc) return null;
    const slot = (doc.stakeholders || []).find(s => s.id === stakeholderId);
    if (!slot || slot.signed) return doc;
    slot.signed = true; slot.signedDay = load().day;
    pushHistory(doc, stakeholderId, 'sign');
    if (signedCount(doc) >= totalSigners(doc)) {
      doc.status = STATUS.SENT_TO_QC;
      doc.closedDay = load().day;
      pushHistory(doc, 'SYSTEM', 'toQC');
      notify('requester', doc, 'n.allSigned');
      notify('approver', doc, 'n.allSigned');
    }
    save();
    return doc;
  }

  /* ⑧ เจ้าหน้าที่ควบคุมคุณภาพลงนามส่วนที่ 6 → ส่งต่อผู้จัดการแผนก */
  function qcStaffSign(id, user, remark) {
    const doc = getDoc(id);
    if (!doc) return null;
    const day = load().day;
    doc.status = STATUS.PENDING_QC_MANAGER;
    doc.lastRemark = remark || '';
    doc.signatures = doc.signatures || {};
    doc.signatures.qcStaff = Object.assign(
      { by: user ? user.id : 'E', day: day, label: 'ลายเซ็นอิเล็กทรอนิกส์' },
      doc.signatures.qcStaff
    );
    pushHistory(doc, user ? user.id : 'E', 'qcStaffSign', remark);
    notify('qcManager', doc, 'n.qcStaffSigned');
    save();
    return doc;
  }

  /* ⑨ ผู้จัดการแผนกควบคุมคุณภาพขึ้นทะเบียนเอกสาร → จบ flow */
  function register(id, user, remark) {
    const doc = getDoc(id);
    if (!doc) return null;
    const day = load().day;
    doc.status = STATUS.REGISTERED;
    doc.closedDay = day;
    doc.lastRemark = remark || '';
    doc.signatures = doc.signatures || {};
    doc.signatures.qcStaff   = doc.signatures.qcStaff   || { by: 'E', day: day, label: 'ลายเซ็นอิเล็กทรอนิกส์' };
    doc.signatures.qcManager = doc.signatures.qcManager || { by: user ? user.id : 'F', day: day, label: 'ลายเซ็นอิเล็กทรอนิกส์' };
    pushHistory(doc, user ? user.id : 'F', 'register', remark);
    notify('requester', doc, 'n.registered');
    notify('approver', doc, 'n.registered');
    notify('stakeholder', doc, 'n.registered');
    notify('qc', doc, 'n.registered');
    save();
    return doc;
  }

  /* ⑦ หมดอายุ → ระบบส่งกลับอัตโนมัติ */
  function runExpiryCheck() {
    const d = load();
    let changed = false;
    d.docs.forEach(doc => {
      if (doc.status === STATUS.PENDING_SIGN && ageOf(doc) >= doc.dueDays) {
        doc.status = STATUS.EXPIRED_RETURNED;
        doc.lastRemark = 'ผู้มีส่วนเกี่ยวข้องลงนามไม่ครบภายในกำหนด ระบบส่งกลับอัตโนมัติ';
        pushHistory(doc, 'SYSTEM', 'expire');
        notify('requester', doc, 'n.expired');
        notify('stakeholder', doc, 'n.expired');
        changed = true;
      }
    });
    if (changed) save();
    return changed;
  }

  /* เดโม: เดินเวลาไป 1 วัน */
  function advanceDay(n) {
    const d = load();
    d.day += (n || 1);
    save();
    runExpiryCheck();
    return d.day;
  }

  /* ══════════════════════════════════════════
     สรุปตัวเลขสำหรับการ์ด Dashboard
     ══════════════════════════════════════════ */
  function stats(role, userId) {
    const list = load().docs;
    const mine = list.filter(d => d.requesterId === (userId || 'A'));
    const byStatus = (arr, s) => arr.filter(d => d.status === s).length;

    if (role === 'requester') {
      return {
        draft: byStatus(mine, STATUS.DRAFT),
        pending: byStatus(mine, STATUS.PENDING_OWNER) + byStatus(mine, STATUS.PENDING_APPROVAL),
        returned: byStatus(mine, STATUS.RETURNED) + byStatus(mine, STATUS.REJECTED),
        signing: byStatus(mine, STATUS.PENDING_SIGN),
        qc: byStatus(mine, STATUS.SENT_TO_QC) + byStatus(mine, STATUS.PENDING_QC_MANAGER) + byStatus(mine, STATUS.REGISTERED)
      };
    }
    if (role === 'owner') {
      return {
        queue: byStatus(list, STATUS.PENDING_OWNER),
        signed: list.filter(d => [STATUS.PENDING_APPROVAL, STATUS.PENDING_SIGN,
          STATUS.SENT_TO_QC, STATUS.REGISTERED].indexOf(d.status) !== -1).length,
        returned: byStatus(list, STATUS.RETURNED) + byStatus(list, STATUS.REJECTED),
        near: list.filter(d => d.status === STATUS.PENDING_OWNER && remainingOf(d) <= 2).length
      };
    }
    if (role === 'approver') {
      return {
        queue: byStatus(list, STATUS.PENDING_APPROVAL),
        approved: list.filter(d => [STATUS.PENDING_SIGN, STATUS.SENT_TO_QC, STATUS.REGISTERED].indexOf(d.status) !== -1).length,
        returned: byStatus(list, STATUS.RETURNED) + byStatus(list, STATUS.REJECTED),
        near: list.filter(d => d.status === STATUS.PENDING_APPROVAL && remainingOf(d) <= 2).length
      };
    }
    if (role === 'qc') {
      return {
        queue: byStatus(list, STATUS.SENT_TO_QC),
        registered: byStatus(list, STATUS.REGISTERED),
        incoming: byStatus(list, STATUS.PENDING_SIGN),
        returned: byStatus(list, STATUS.RETURNED)
      };
    }
    if (role === 'qcManager') {
      return {
        queue: byStatus(list, STATUS.PENDING_QC_MANAGER),
        registered: byStatus(list, STATUS.REGISTERED),
        incoming: byStatus(list, STATUS.SENT_TO_QC),
        returned: byStatus(list, STATUS.RETURNED)
      };
    }
    if (role === 'stakeholder') {
      const rel = docsForRole('stakeholder', userId);
      const waiting = rel.filter(d => {
        if (d.status !== STATUS.PENDING_SIGN) return false;
        const s = slotForUser(d, userId);
        return s && !s.signed;
      });
      return {
        waitMe: waiting.length,
        signed: rel.filter(d => {
          const s = slotForUser(d, userId);
          return s && s.signed;
        }).length,
        near: waiting.filter(d => remainingOf(d) <= 2).length,
        returned: rel.filter(d => d.status === STATUS.EXPIRED_RETURNED).length
      };
    }
    /* ภาพรวมทั้งระบบ */
    return {
      total: list.length,
      draft: byStatus(list, STATUS.DRAFT),
      pending: byStatus(list, STATUS.PENDING_OWNER) + byStatus(list, STATUS.PENDING_APPROVAL),
      signing: byStatus(list, STATUS.PENDING_SIGN),
      returned: byStatus(list, STATUS.RETURNED) + byStatus(list, STATUS.EXPIRED_RETURNED),
      rejected: byStatus(list, STATUS.REJECTED),
      qc: byStatus(list, STATUS.SENT_TO_QC) + byStatus(list, STATUS.PENDING_QC_MANAGER),
      registered: byStatus(list, STATUS.REGISTERED)
    };
  }

  /* ══════════════════════════════════════════
     ไฟล์แนบ — เก็บไฟล์จริงเป็น data URL
     ══════════════════════════════════════════ */
  function fileBytes(doc) {
    return (doc.files || []).reduce((n, f) => n + (f.data ? f.data.length : 0), 0);
  }

  function usedBytes() {
    return load().docs.reduce((n, d) => n + fileBytes(d), 0);
  }

  function quotaLeft() { return Math.max(0, FILE_QUOTA - usedBytes()); }

  /* แปลง data URL → blob URL เพื่อให้ <iframe>/<img> เปิดดูได้จริง */
  function fileURL(f) {
    if (!f || !f.data) return null;
    if (f._url) return f._url;
    try {
      const parts = f.data.split(',');
      const mime = (parts[0].match(/:(.*?);/) || [])[1] || 'application/octet-stream';
      const bin = atob(parts[1]);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      f._url = URL.createObjectURL(new Blob([buf], { type: mime }));
      return f._url;
    } catch (e) { return null; }
  }

  function fileKind(f) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].indexOf(ext) !== -1) return 'image';
    return 'other';
  }

  /* ══════════════════════════════════════════
     export
     ══════════════════════════════════════════ */
  global.Store = {
    STATUS, STATUS_STYLE, DOC_TYPES, PURPOSES, USERS, STAKEHOLDER_POOL, FILE_QUOTA,
    load, save, reset,
    fileURL, fileKind, usedBytes, quotaLeft, register,
    login, loginAs, logout, currentUser,
    today, advanceDay, runExpiryCheck,
    allDocs, getDoc, docsForRole, stats,
    ageOf, remainingOf, signedCount, totalSigners,
    rev, isStale, syncIfStale,
    docTypeLabel, purposeLabel, docTitle, statusStyle,
    permissions, mySignSlot, slotForUser,
    createDraft, updateDraft, send, ownerSign, approve, returnForEdit, reject, sign, signAs, qcStaffSign,
    notify, notificationsFor, unreadCount, markAllRead, markRead
  };
})(window);
