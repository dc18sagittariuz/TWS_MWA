/* Admin: ซ่อน/แสดงโครงการสำหรับผู้ชมทั่วไป
   ค่าเก็บใน Google Apps Script (ดู scripts/admin-apps-script.gs) — ใส่ URL Web app ด้านล่าง */
const ADMIN_API = 'https://script.google.com/macros/s/AKfycbw5J2inf6zU3VCBZv00ywG0xNTnZcsTiyfHNWc3M7fUH945NoYMn2lCoT92cCiy9h6CjA/exec'; // เช่น 'https://script.google.com/macros/s/XXXX/exec'

let HIDDEN = new Set();
let adminPw = '';
try { adminPw = sessionStorage.getItem('adminPw') || ''; } catch (e) {}
try { HIDDEN = new Set(JSON.parse(localStorage.getItem('hiddenProjects') || '[]')); } catch (e) {}

const canView = k => !!adminPw || !HIDDEN.has(k);
const adminApi = b => fetch(ADMIN_API, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(b) })
  .then(r => r.json()).catch(() => ({}));

function setHidden(list) {
  HIDDEN = new Set(list || []);
  try { localStorage.setItem('hiddenProjects', JSON.stringify([...HIDDEN])); } catch (e) {}
}
async function loadVisibility() {
  if (!ADMIN_API) return;
  try { setHidden((await (await fetch(ADMIN_API)).json()).hidden); } catch (e) { return; }
  applyVisibility(); ensureVisibleProject();
}
function applyVisibility() {
  Object.keys(PROJECTS).forEach(k => {
    const item = document.getElementById('smenu-' + k);
    if (item) item.style.display = canView(k) ? '' : 'none';
    const o = document.querySelector(`#project-select option[value="${k}"]`);
    if (o) o.hidden = o.disabled = !canView(k);
  });
  document.getElementById('admin-login').hidden = !!adminPw;
  const panel = document.getElementById('admin-panel');
  panel.hidden = !adminPw;
  panel.innerHTML = adminPw ? '<b>แสดงต่อผู้ชมทั่วไป</b>' + Object.values(PROJECTS).map(p =>
    `<label style="display:flex;gap:8px;align-items:center;padding:6px 0"><input type="checkbox" ${HIDDEN.has(p.key) ? '' : 'checked'}
      onchange="toggleHidden('${p.key}', !this.checked, this)"> ${p.icon} ${escHtml(p.name)}</label>`).join('') +
    '<button class="tool-btn" onclick="adminLogout()">ออกจากระบบ</button>' : '';
}
function ensureVisibleProject() {
  if (canView(CURRENT_PROJECT.key)) return;
  const k = Object.keys(PROJECTS).find(canView);
  if (k) switchProject(k);
}
async function adminLogin(e) {
  e.preventDefault();
  if (!ADMIN_API) return alert('ยังไม่ได้ตั้งค่า ADMIN_API ใน admin.js');
  const pw = document.getElementById('admin-pw').value;
  const r = await adminApi({ action: 'login', password: pw });
  if (!r.ok) return alert(r.error || 'เข้าสู่ระบบไม่สำเร็จ');
  adminPw = pw;
  try { sessionStorage.setItem('adminPw', pw); } catch (e) {}
  document.getElementById('admin-pw').value = '';
  setHidden(r.hidden); applyVisibility();
}
function adminLogout() {
  adminPw = '';
  try { sessionStorage.removeItem('adminPw'); } catch (e) {}
  applyVisibility(); ensureVisibleProject();
}
async function toggleHidden(key, hide, el) {
  const next = new Set(HIDDEN); hide ? next.add(key) : next.delete(key);
  if (next.size >= Object.keys(PROJECTS).length) { el.checked = true; return alert('ต้องแสดงอย่างน้อย 1 โครงการ'); }
  el.disabled = true;
  const r = await adminApi({ action: 'setHidden', password: adminPw, hidden: [...next] });
  el.disabled = false;
  if (!r.ok) { el.checked = !hide; return alert(r.error || 'บันทึกไม่สำเร็จ'); }
  setHidden(r.hidden); applyVisibility();
}

// ก่อนโหลดข้อมูลครั้งแรก: ถ้าโครงการเริ่มต้นถูกซ่อน (จากค่าที่จำไว้) ให้เปลี่ยนโดยไม่โหลดซ้ำ
applyVisibility();
if (!canView(CURRENT_PROJECT.key)) {
  const k = Object.keys(PROJECTS).find(canView);
  if (k) {
    CURRENT_PROJECT = PROJECTS[k];
    Object.keys(PROJECTS).forEach(x => {
      const item = document.getElementById('smenu-' + x);
      item.classList.toggle('active', x === k);
      item.querySelector('.smenu-check').style.display = x === k ? 'inline' : 'none';
    });
    document.getElementById('main-header').style.background = CURRENT_PROJECT.color;
    if (typeof setProjectHeading === 'function') setProjectHeading();
  }
}
window.addEventListener('DOMContentLoaded', loadVisibility);
