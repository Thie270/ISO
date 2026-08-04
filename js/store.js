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
  const DB_VERSION = 4;

  /* เพดานพื้นที่ไฟล์แนบที่ยอมให้เก็บลง localStorage (base64) */
  const FILE_QUOTA = 3.5 * 1024 * 1024;

  /* ══════════════════════════════════════════
     ผู้ใช้งานตัวอย่าง 4 บัญชี (4 บทบาท)
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
      name: 'นาย B · ประเสริฐ วงศ์ทอง',
      nameEn: 'Mr. B · Prasert Wongthong',
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
      id: 'C',
      username: 'userC',
      password: '1234',
      initials: 'C',
      name: 'นาย C · ปรีชา แสงจันทร์',
      nameEn: 'Mr. C · Preecha Sangchan',
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
      id: 'D',
      username: 'userD',
      password: '1234',
      initials: 'D',
      name: 'นาย D · วิชัย ธนกิจ',
      nameEn: 'Mr. D · Wichai Thanakit',
      role: 'qc',
      empId: 'RVP-0115',
      dept: 'แผนกควบคุมคุณภาพ (QC)',
      deptEn: 'Quality Control Department',
      position: 'ผู้จัดการแผนกควบคุมคุณภาพ',
      positionEn: 'Quality Control Manager',
      color: '#b45309',
      home: 'role-qc.html'
    }
  ];

  /* ══════════════════════════════════════════
     State machine ตาม Flow chart
     ══════════════════════════════════════════ */
  const STATUS = {
    DRAFT: 'DRAFT',
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    RETURNED: 'RETURNED',
    REJECTED: 'REJECTED',
    PENDING_SIGN: 'PENDING_SIGN',
    SENT_TO_QC: 'SENT_TO_QC',
    REGISTERED: 'REGISTERED',
    EXPIRED_RETURNED: 'EXPIRED_RETURNED'
  };

  /* สีของ pill สถานะ (ใช้ class เดิมที่มีอยู่ใน style.css / tailwind) */
  const STATUS_STYLE = {
    DRAFT:            { pill: 'bg-slate-100 text-slate-500',   dot: 'bg-slate-400'   },
    PENDING_APPROVAL: { pill: 'bg-blue-50 text-blue-600',      dot: 'bg-blue-500'    },
    RETURNED:         { pill: 'bg-red-50 text-red-500',        dot: 'bg-red-500'     },
    REJECTED:         { pill: 'bg-rose-100 text-rose-700',     dot: 'bg-rose-600'    },
    PENDING_SIGN:     { pill: 'bg-violet-50 text-violet-600',  dot: 'bg-violet-500'  },
    SENT_TO_QC:       { pill: 'bg-emerald-50 text-emerald-600',dot: 'bg-emerald-500' },
    REGISTERED:       { pill: 'bg-teal-50 text-teal-700',      dot: 'bg-teal-600'    },
    EXPIRED_RETURNED: { pill: 'bg-amber-50 text-amber-600',    dot: 'bg-amber-500'   }
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
    { id: 'SQD',  name: 'SQD',          nameEn: 'SQD',                userId: 'C' },
    { id: 'QC',   name: 'QC',           nameEn: 'QC',                 userId: null },
    { id: 'PROD', name: 'ฝ่ายผลิต',      nameEn: 'Production',         userId: null },
    { id: 'HR',   name: 'ฝ่ายบุคคล',     nameEn: 'Human Resources',    userId: null },
    { id: 'FIN',  name: 'ฝ่ายการเงิน',   nameEn: 'Finance',            userId: null },
    { id: 'IT',   name: 'ฝ่าย IT',       nameEn: 'IT Division',        userId: null }
  ];

  /* ══════════════════════════════════════════
     ข้อมูลตัวอย่างเริ่มต้น
     ══════════════════════════════════════════ */
  function sh(id, signed, day) {
    const base = STAKEHOLDER_POOL.find(s => s.id === id) || { id, name: id, nameEn: id, userId: null };
    return { id: base.id, name: base.name, nameEn: base.nameEn, userId: base.userId, signed: !!signed, signedDay: signed ? (day || 0) : null };
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

    const docs = [
      mk({
        id: 'DAR001', docNo: 'RVP-WI-014', type: 'wi', purpose: 'edit',
        title: 'เอกสารความปลอดภัยรถไฟฟ้า', titleEn: 'Electric Train Safety Procedure',
        revision: 2, status: STATUS.DRAFT, createdDay: 0,
        description: 'ปรับปรุงขั้นตอนการตรวจสอบความปลอดภัยก่อนนำขบวนออกให้บริการ',
        files: [{ name: 'DAR-RVP-WI-014.pdf', size: 248320, kind: 'dar' }],
        stakeholders: [sh('SQD'), sh('QC'), sh('PROD')],
        history: [{ day: 0, actor: 'A', action: 'create' }]
      }),
      mk({
        id: 'DAR002', docNo: 'RVP-FM-032', type: 'form', purpose: 'new',
        title: 'เอกสารการซ่อมบำรุงรางรถไฟ', titleEn: 'Rail Maintenance Record Form',
        revision: 0, status: STATUS.PENDING_APPROVAL, createdDay: 0, sentDay: 0,
        description: 'แบบฟอร์มบันทึกการซ่อมบำรุงรางประจำเดือน สำหรับหน่วยซ่อมบำรุงทาง',
        files: [
          { name: 'DAR-RVP-FM-032.pdf', size: 214000, kind: 'dar' },
          { name: 'แบบฟอร์มซ่อมบำรุงราง-r0.docx', size: 88400, kind: 'change' }
        ],
        stakeholders: [sh('SQD'), sh('QC'), sh('PROD'), sh('IT')],
        history: [{ day: 0, actor: 'A', action: 'create' }, { day: 0, actor: 'A', action: 'send' }]
      }),
      mk({
        id: 'DAR003', docNo: 'RVP-SD-007', type: 'sd', purpose: 'edit',
        title: 'เอกสารสนับสนุนภายใน', titleEn: 'Internal Supporting Document',
        revision: 1, status: STATUS.RETURNED, createdDay: 0, sentDay: 0,
        lastRemark: 'กรุณาแนบฉบับเดิมที่จะถูกแทนที่ และระบุเหตุผลการแก้ไขในส่วนที่ 4 ให้ชัดเจน',
        description: 'ปรับปรุงเอกสารสนับสนุนภายในให้สอดคล้องกับ ISO 9001:2015 ข้อ 7.5',
        files: [{ name: 'DAR-RVP-SD-007.pdf', size: 190500, kind: 'dar' }],
        stakeholders: [sh('SQD'), sh('QC')],
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'B', action: 'return', note: 'กรุณาแนบฉบับเดิมที่จะถูกแทนที่ และระบุเหตุผลการแก้ไขในส่วนที่ 4 ให้ชัดเจน' }
        ]
      }),
      mk({
        id: 'DAR004', docNo: 'RVP-WI-021', type: 'wi', purpose: 'new',
        title: 'เอกสารความปลอดภัยรถไฟฟ้า (ภาคสนาม)', titleEn: 'Field Safety Work Instruction',
        revision: 0, status: STATUS.PENDING_SIGN, createdDay: 0, sentDay: 0, approvedDay: 0,
        description: 'วิธีปฏิบัติงานด้านความปลอดภัยสำหรับเจ้าหน้าที่ภาคสนามในเขตทางวิ่ง',
        files: [
          { name: 'DAR-RVP-WI-021.pdf', size: 268800, kind: 'dar' },
          { name: 'WI-021-safety-field-r0.pdf', size: 512000, kind: 'change' }
        ],
        stakeholders: [sh('SQD'), sh('QC', true, 0), sh('PROD', true, 0), sh('HR'), sh('IT', true, 0)],
        signatures: { approver: { by: 'B', day: 0, label: 'ลายเซ็นอิเล็กทรอนิกส์' } },
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'B', action: 'approve' }
        ]
      }),
      mk({
        id: 'DAR005', docNo: 'RVP-FM-018', type: 'form', purpose: 'edit',
        title: 'แบบฟอร์มตรวจรับงานซ่อมบำรุง', titleEn: 'Maintenance Acceptance Form',
        revision: 3, status: STATUS.SENT_TO_QC, createdDay: 0, sentDay: 0, approvedDay: 0, closedDay: 0,
        description: 'ปรับช่องลงนามผู้ตรวจรับให้รองรับการลงนามอิเล็กทรอนิกส์',
        files: [{ name: 'DAR-RVP-FM-018.pdf', size: 233000, kind: 'dar' }],
        stakeholders: [sh('SQD', true, 0), sh('QC', true, 0), sh('PROD', true, 0), sh('HR', true, 0), sh('FIN', true, 0)],
        signatures: {
          approver: { by: 'B', day: 0, label: 'ลายเซ็นอิเล็กทรอนิกส์' },
          qcStaff: { by: 'QC', day: 0, label: 'ลายเซ็นอิเล็กทรอนิกส์' }
        },
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'B', action: 'approve' },
          { day: 0, actor: 'C', action: 'sign' },
          { day: 0, actor: 'SYSTEM', action: 'toQC' }
        ]
      }),
      mk({
        id: 'DAR006', docNo: 'RVP-ED-003', type: 'esd', purpose: 'new',
        title: 'เอกสารสนับสนุนภายนอก (มาตรฐานผู้ผลิต)', titleEn: 'External Supporting Document (Vendor Standard)',
        revision: 0, status: STATUS.EXPIRED_RETURNED, createdDay: 0, sentDay: 0, approvedDay: 0,
        lastRemark: 'ผู้มีส่วนเกี่ยวข้องลงนามไม่ครบภายใน 14 วัน ระบบส่งกลับอัตโนมัติ',
        description: 'ขึ้นทะเบียนคู่มือผู้ผลิตอุปกรณ์อาณัติสัญญาณเป็นเอกสารสนับสนุนภายนอก',
        files: [{ name: 'DAR-RVP-ED-003.pdf', size: 205000, kind: 'dar' }],
        stakeholders: [sh('SQD', true, 0), sh('QC', true, 0), sh('PROD'), sh('HR'), sh('IT')],
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'B', action: 'approve' },
          { day: 0, actor: 'SYSTEM', action: 'expire' }
        ]
      }),
      mk({
        id: 'DAR007', docNo: 'RVP-QP-005', type: 'qp', purpose: 'edit',
        title: 'ขั้นตอนการควบคุมเอกสารคุณภาพ', titleEn: 'Quality Document Control Procedure',
        revision: 4, status: STATUS.PENDING_APPROVAL, createdDay: 0, sentDay: 0,
        description: 'ปรับขั้นตอนการควบคุมเอกสารให้รองรับระบบ DAR อิเล็กทรอนิกส์',
        files: [
          { name: 'DAR-RVP-QP-005.pdf', size: 259000, kind: 'dar' },
          { name: 'QP-005-r4-draft.docx', size: 141000, kind: 'change' }
        ],
        stakeholders: [sh('SQD'), sh('QC'), sh('IT')],
        history: [{ day: 0, actor: 'A', action: 'create' }, { day: 0, actor: 'A', action: 'send' }]
      }),
      mk({
        id: 'DAR008', docNo: 'RVP-FM-041', type: 'form', purpose: 'new',
        title: 'แบบฟอร์มขอเปลี่ยนแปลงเอกสาร', titleEn: 'Document Change Request Form',
        revision: 0, status: STATUS.PENDING_APPROVAL, createdDay: 0, sentDay: 0,
        description: 'แบบฟอร์มมาตรฐานสำหรับการยื่นขอเปลี่ยนแปลงเอกสารในระบบคุณภาพ',
        files: [{ name: 'DAR-RVP-FM-041.pdf', size: 198700, kind: 'dar' }],
        stakeholders: [sh('SQD'), sh('QC')],
        history: [{ day: 0, actor: 'A', action: 'create' }, { day: 0, actor: 'A', action: 'send' }]
      }),
      mk({
        id: 'DAR009', docNo: 'RVP-SD-012', type: 'sd', purpose: 'cancel',
        title: 'เอกสารสนับสนุนภายใน (ยกเลิกการใช้งาน)', titleEn: 'Internal Supporting Document (Withdrawal)',
        revision: 2, status: STATUS.PENDING_SIGN, createdDay: 0, sentDay: 0, approvedDay: 0,
        description: 'ยกเลิกการใช้งานเอกสารสนับสนุนฉบับเดิมซึ่งถูกแทนที่ด้วย SD-014',
        files: [{ name: 'DAR-RVP-SD-012.pdf', size: 187300, kind: 'dar' }],
        stakeholders: [sh('SQD'), sh('QC'), sh('FIN', true, 0), sh('HR')],
        signatures: { approver: { by: 'B', day: 0, label: 'ลายเซ็นอิเล็กทรอนิกส์' } },
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'B', action: 'approve' }
        ]
      }),
      mk({
        id: 'DAR010', docNo: 'RVP-WI-030', type: 'wi', purpose: 'new',
        title: 'วิธีปฏิบัติงานตรวจสอบระบบจ่ายไฟ', titleEn: 'Power Supply Inspection Work Instruction',
        revision: 0, status: STATUS.PENDING_SIGN, createdDay: 0, sentDay: 0, approvedDay: 0,
        description: 'ขั้นตอนการตรวจสอบระบบจ่ายไฟฟ้ารางที่สามก่อนเปิดให้บริการประจำวัน',
        files: [{ name: 'DAR-RVP-WI-030.pdf', size: 241000, kind: 'dar' }],
        stakeholders: [sh('SQD'), sh('QC'), sh('PROD'), sh('IT')],
        signatures: { approver: { by: 'B', day: 0, label: 'ลายเซ็นอิเล็กทรอนิกส์' } },
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'B', action: 'approve' }
        ]
      }),
      mk({
        id: 'DAR011', docNo: 'RVP-QM-001', type: 'qm', purpose: 'edit',
        title: 'คู่มือคุณภาพองค์กร', titleEn: 'Corporate Quality Manual',
        revision: 6, status: STATUS.REJECTED, createdDay: 0, sentDay: 0, closedDay: 0,
        lastRemark: 'ขอบเขตการแก้ไขกระทบหลายฝ่าย ให้เปิดคำขอใหม่แยกตามฝ่ายที่เกี่ยวข้อง',
        description: 'ปรับปรุงคู่มือคุณภาพให้สอดคล้องกับโครงสร้างองค์กรใหม่',
        files: [{ name: 'DAR-RVP-QM-001.pdf', size: 302400, kind: 'dar' }],
        stakeholders: [sh('SQD'), sh('QC')],
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'B', action: 'reject', note: 'ขอบเขตการแก้ไขกระทบหลายฝ่าย ให้เปิดคำขอใหม่แยกตามฝ่ายที่เกี่ยวข้อง' }
        ]
      }),
      mk({
        id: 'DAR012', docNo: 'RVP-WI-009', type: 'wi', purpose: 'edit',
        title: 'วิธีปฏิบัติงานทำความสะอาดขบวนรถ', titleEn: 'Train Cleaning Work Instruction',
        revision: 5, status: STATUS.REGISTERED, createdDay: 0, sentDay: 0, approvedDay: 0, closedDay: 0,
        description: 'ปรับรอบการทำความสะอาดขบวนรถให้สอดคล้องกับตารางเดินรถใหม่',
        files: [{ name: 'DAR-RVP-WI-009.pdf', size: 226000, kind: 'dar' }],
        stakeholders: [sh('SQD', true, 0), sh('QC', true, 0), sh('PROD', true, 0)],
        signatures: {
          approver: { by: 'B', day: 0, label: 'ลายเซ็นอิเล็กทรอนิกส์' },
          qcStaff:  { by: 'D', day: 0, label: 'ลายเซ็นอิเล็กทรอนิกส์' },
          qcManager:{ by: 'D', day: 0, label: 'ลายเซ็นอิเล็กทรอนิกส์' }
        },
        history: [
          { day: 0, actor: 'A', action: 'create' },
          { day: 0, actor: 'A', action: 'send' },
          { day: 0, actor: 'B', action: 'approve' },
          { day: 0, actor: 'C', action: 'sign' },
          { day: 0, actor: 'SYSTEM', action: 'toQC' },
          { day: 0, actor: 'D', action: 'register', note: 'ขึ้นทะเบียนเรียบร้อย · แจกจ่ายฉบับควบคุมแล้ว' }
        ]
      })
    ];

    /* ทำให้ข้อมูลตัวอย่างดู "มีอายุ" ต่างกัน เพื่อให้เดโมเห็นตัวเลขวันจริง */
    const ages = { DAR001: 0, DAR002: 2, DAR003: 1, DAR004: 10, DAR005: 9, DAR006: 14, DAR007: 5, DAR008: 12, DAR009: 3, DAR010: 6, DAR011: 4, DAR012: 11 };
    docs.forEach(d => {
      const age = ages[d.id] || 0;
      d.createdDay = -age;
      if (d.sentDay !== null) d.sentDay = -age;
      if (d.approvedDay !== null) d.approvedDay = -age + 1;
      if (d.closedDay !== null) d.closedDay = 0;
      d.history.forEach((h, i) => { h.day = -age + Math.min(i, age); });
      d.stakeholders.forEach(s => { if (s.signed) s.signedDay = -age + 2; });
    });

    return {
      version: DB_VERSION,
      day: 0,                 /* วันจำลองปัจจุบัน (0 = วันนี้) */
      seq: 12,
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
    push('approver', 'DAR002', 'n.sent', -2);
    push('approver', 'DAR007', 'n.sent', -5);
    push('approver', 'DAR008', 'n.sent', -12);
    push('requester', 'DAR003', 'n.returned', -1);
    push('requester', 'DAR011', 'n.rejected', -4);
    push('stakeholder', 'DAR004', 'n.approved', -9);
    push('stakeholder', 'DAR009', 'n.approved', -2);
    push('stakeholder', 'DAR010', 'n.approved', -5);
    push('requester', 'DAR006', 'n.expired', 0);
    push('requester', 'DAR005', 'n.allSigned', 0);
    push('qc', 'DAR005', 'n.allSigned', 0);
    push('qc', 'DAR012', 'n.registered', -1);
    push('requester', 'DAR012', 'n.registered', -1);
    return list;
  }

  /* ══════════════════════════════════════════
     โหลด / บันทึก
     ══════════════════════════════════════════ */
  let db = null;

  function load() {
    if (db) return db;
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === DB_VERSION) { db = parsed; return db; }
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
    document.dispatchEvent(new CustomEvent('storechange'));
  }

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
    if (role === 'approver') {
      return list.filter(d => [STATUS.PENDING_APPROVAL, STATUS.RETURNED, STATUS.REJECTED,
        STATUS.PENDING_SIGN, STATUS.SENT_TO_QC, STATUS.REGISTERED].indexOf(d.status) !== -1);
    }
    if (role === 'stakeholder') {
      return list.filter(d =>
        [STATUS.PENDING_SIGN, STATUS.SENT_TO_QC, STATUS.REGISTERED, STATUS.EXPIRED_RETURNED].indexOf(d.status) !== -1 &&
        (d.stakeholders || []).some(s => s.userId === (userId || 'C') || s.id === 'SQD')
      );
    }
    if (role === 'qc') {
      /* QC เห็นเฉพาะเอกสารที่เดินมาถึงแผนกแล้ว */
      return list.filter(d =>
        [STATUS.SENT_TO_QC, STATUS.REGISTERED, STATUS.PENDING_SIGN, STATUS.RETURNED].indexOf(d.status) !== -1);
    }
    return list;
  }

  /* หา stakeholder record ของผู้ใช้คนนี้ในเอกสาร */
  function mySignSlot(doc, user) {
    if (!doc || !user || user.role !== 'stakeholder') return null;
    return (doc.stakeholders || []).find(s => s.userId === user.id) ||
           (doc.stakeholders || []).find(s => s.id === user.dept) || null;
  }

  /* ══════════════════════════════════════════
     สิทธิ์ตาม Role + สถานะ (ข้อ 4 ของข้อกำหนด)
     ══════════════════════════════════════════ */
  function permissions(doc, user) {
    const p = { view: false, edit: false, draft: false, send: false, preview: false,
                approve: false, reject: false, return: false, sign: false, register: false };
    if (!doc || !user) return p;
    p.view = true;
    p.preview = true;

    if (user.role === 'requester' && doc.requesterId === user.id) {
      if (doc.status === STATUS.DRAFT) { p.edit = true; p.draft = true; p.send = true; }
      if (doc.status === STATUS.RETURNED || doc.status === STATUS.EXPIRED_RETURNED) { p.edit = true; p.draft = true; p.send = true; }
    }

    if (user.role === 'approver' && doc.status === STATUS.PENDING_APPROVAL) {
      p.approve = true; p.reject = true; p.return = true;
    }

    if (user.role === 'stakeholder' && doc.status === STATUS.PENDING_SIGN) {
      const slot = mySignSlot(doc, user);
      if (slot && !slot.signed) p.sign = true;
    }

    /* ⑧ แผนกควบคุมคุณภาพ — ขั้นสุดท้ายของ flow */
    if (user.role === 'qc' && doc.status === STATUS.SENT_TO_QC) {
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
      stakeholders: (data.stakeholders || []).map(x => sh(x)),
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
    if (data.stakeholders) doc.stakeholders = data.stakeholders.map(x => typeof x === 'string' ? sh(x) : x);
    if (data.signatures) {
      doc.signatures = Object.assign({}, doc.signatures, data.signatures);
      /* ช่องที่ผู้จัดทำลบลายเซ็นออก ต้องหายไปจากเอกสารด้วย */
      ['requester', 'owner'].forEach(k => {
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
    doc.status = STATUS.PENDING_APPROVAL;
    doc.sentDay = load().day;
    doc.lastRemark = remark || '';
    pushHistory(doc, user ? user.id : 'A', 'send', remark);
    notify('approver', doc, 'n.sent');
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
    doc.signatures.approver = { by: user ? user.id : 'B', day: load().day, label: 'ลายเซ็นอิเล็กทรอนิกส์' };
    pushHistory(doc, user ? user.id : 'B', 'approve', remark);
    notify('stakeholder', doc, 'n.approved');
    notify('requester', doc, 'n.approved');
    save();
    return doc;
  }

  /* ⑥ ส่งกลับไปแก้ไข */
  function returnForEdit(id, user, remark) {
    const doc = getDoc(id);
    if (!doc) return null;
    doc.status = STATUS.RETURNED;
    doc.lastRemark = remark || '';
    pushHistory(doc, user ? user.id : 'B', 'return', remark);
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
    pushHistory(doc, user ? user.id : 'B', 'reject', remark);
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
    pushHistory(doc, user ? user.id : 'C', 'sign', remark);

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

  /* ⑧ QC ขึ้นทะเบียนเอกสาร → จบ flow */
  function register(id, user, remark) {
    const doc = getDoc(id);
    if (!doc) return null;
    const day = load().day;
    doc.status = STATUS.REGISTERED;
    doc.closedDay = day;
    doc.lastRemark = remark || '';
    doc.signatures = doc.signatures || {};
    doc.signatures.qcStaff   = doc.signatures.qcStaff   || { by: user ? user.id : 'D', day: day, label: 'ลายเซ็นอิเล็กทรอนิกส์' };
    doc.signatures.qcManager = { by: user ? user.id : 'D', day: day, label: 'ลายเซ็นอิเล็กทรอนิกส์' };
    pushHistory(doc, user ? user.id : 'D', 'register', remark);
    notify('requester', doc, 'n.registered');
    notify('approver', doc, 'n.registered');
    notify('stakeholder', doc, 'n.registered');
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
        pending: byStatus(mine, STATUS.PENDING_APPROVAL),
        returned: byStatus(mine, STATUS.RETURNED) + byStatus(mine, STATUS.REJECTED),
        signing: byStatus(mine, STATUS.PENDING_SIGN),
        qc: byStatus(mine, STATUS.SENT_TO_QC) + byStatus(mine, STATUS.REGISTERED)
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
    if (role === 'stakeholder') {
      const rel = docsForRole('stakeholder', userId);
      const waiting = rel.filter(d => {
        if (d.status !== STATUS.PENDING_SIGN) return false;
        const s = (d.stakeholders || []).find(x => x.userId === (userId || 'C') || x.id === 'SQD');
        return s && !s.signed;
      });
      return {
        waitMe: waiting.length,
        signed: rel.filter(d => {
          const s = (d.stakeholders || []).find(x => x.userId === (userId || 'C') || x.id === 'SQD');
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
      pending: byStatus(list, STATUS.PENDING_APPROVAL),
      signing: byStatus(list, STATUS.PENDING_SIGN),
      returned: byStatus(list, STATUS.RETURNED) + byStatus(list, STATUS.EXPIRED_RETURNED),
      rejected: byStatus(list, STATUS.REJECTED),
      qc: byStatus(list, STATUS.SENT_TO_QC),
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
    docTypeLabel, purposeLabel, docTitle, statusStyle,
    permissions, mySignSlot,
    createDraft, updateDraft, send, approve, returnForEdit, reject, sign, signAs,
    notify, notificationsFor, unreadCount, markAllRead, markRead
  };
})(window);
