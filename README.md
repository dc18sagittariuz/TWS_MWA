# ระบบตรวจสอบคุณภาพน้ำ — Responsive UX/UI

ไฟล์หลักสำหรับเผยแพร่คือ `index.html` ภายในแพ็กเกจนี้

## ทดสอบบนเครื่อง

การเปิดไฟล์โดยดับเบิลคลิกอาจทำให้บางเบราว์เซอร์จำกัดการเรียกข้อมูลภายนอก แนะนำให้เปิดผ่าน local server

### Python

```bash
python3 -m http.server 8000
```

จากนั้นเปิด `http://localhost:8000`

### VS Code

ติดตั้งส่วนขยาย **Live Server** แล้วคลิกขวาที่ `index.html` > **Open with Live Server**

## อัปโหลดด้วยหน้าเว็บ GitHub

1. เข้าสู่ GitHub และกด **New repository**
2. ตั้งชื่อ Repository เช่น `water-quality-dashboard`
3. เลือก **Public** แล้วกด **Create repository**
4. กด **Add file** > **Upload files**
5. อัปโหลด `index.html` และ `README.md`
6. ใส่ข้อความ Commit เช่น `Add responsive water quality dashboard`
7. กด **Commit changes**
8. ไปที่ **Settings** > **Pages**
9. ที่ **Build and deployment** เลือก **Deploy from a branch**
10. เลือก Branch `main` และ Folder `/ (root)` แล้วกด **Save**
11. รอจน GitHub Pages แสดง URL ของเว็บไซต์

## อัปโหลดด้วย Git

```bash
git init
git add index.html README.md
git commit -m "Add responsive water quality dashboard"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

จากนั้นเปิด **Settings > Pages** และเลือก `main` กับ `/ (root)`

## ก่อนเผยแพร่

- ตรวจว่า Google Sheets ที่ใช้เป็นแหล่งข้อมูลอนุญาตให้ผู้มีลิงก์ดูได้
- ทดสอบหน้า รายการ แผนที่ และ Dashboard ทั้งบนมือถือและคอมพิวเตอร์
- ตรวจ Console ของเบราว์เซอร์ว่าไม่มีข้อผิดพลาด
- ไม่ควรใส่ API key หรือข้อมูลลับไว้ในไฟล์สาธารณะ
- หากเปลี่ยนชื่อไฟล์ ต้องใช้ชื่อ `index.html` เป็นหน้าแรกของ GitHub Pages
