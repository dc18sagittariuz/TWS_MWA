/* Backend สำหรับระบบผู้ดูแล (ซ่อน/แสดงโครงการ) — วางใน Google Apps Script
   1) script.google.com › New project › วางโค้ดนี้
   2) Project Settings › Script properties › เพิ่ม ADMIN_PASSWORD = รหัสผ่าน (ยาวและเดายาก)
   3) Deploy › New deployment › Web app: Execute as = Me, Who has access = Anyone
   4) คัดลอก URL ไปใส่ ADMIN_API ใน admin.js */
const P = PropertiesService.getScriptProperties();
const hidden = () => JSON.parse(P.getProperty('hidden') || '[]');
const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);

function doGet() { return out({ hidden: hidden() }); }

function doPost(e) {
  let b = {};
  try { b = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'ข้อมูลไม่ถูกต้อง' }); }
  const pw = P.getProperty('ADMIN_PASSWORD');
  if (!pw || b.password !== pw) { Utilities.sleep(1000); return out({ ok: false, error: 'รหัสผ่านไม่ถูกต้อง' }); }
  if (b.action === 'setHidden') {
    const list = Array.isArray(b.hidden) ? b.hidden.filter(k => typeof k === 'string').slice(0, 20) : [];
    P.setProperty('hidden', JSON.stringify(list));
  }
  return out({ ok: true, hidden: hidden() });
}
