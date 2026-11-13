Med Dashboard - ชุดติดตั้งสำหรับเครื่อง CSSD (Windows 10/11 แบบ 64-bit)
=====================================================================

ชุดนี้มีทุกอย่างพร้อมใช้: ไม่ต้องต่ออินเทอร์เน็ต ไม่ต้องติดตั้ง Node.js หรือโปรแกรมอื่น
ไม่แก้โปรแกรม CSSD, SQL Server หรือ IIS เดิม - dashboard แค่ "อ่าน" ข้อมูลจากฐานข้อมูล CSSD


ขั้นที่ 1  สร้าง login แบบอ่านอย่างเดียว (ทำครั้งเดียว)
  - เปิด SSMS > File > Open > เลือกไฟล์ create-readonly-login.sql
  - เปลี่ยน CHANGE_ME เป็นรหัสผ่านที่ต้องการ แล้วกด Execute
  - ไม่ต้อง restart SQL Server โปรแกรม CSSD ใช้งานได้ตามปกติ

ขั้นที่ 2  วางโฟลเดอร์
  - แตก zip ไว้ที่ C:\med-dashboard (หรือที่อื่นก็ได้ แต่ต้องเป็นโฟลเดอร์ที่ไม่ถูกลบ)

ขั้นที่ 3  ตั้งค่ารหัสผ่าน
  - ดับเบิลคลิก 1-start-dashboard.bat ครั้งแรก จะเปิดไฟล์ dashboard.env ใน Notepad ให้
  - ใส่รหัสผ่านจากขั้นที่ 1 แทน CHANGE_ME (เก็บเครื่องหมายคำพูดไว้) แล้วกดบันทึก

ขั้นที่ 4  ลองเปิด
  - ดับเบิลคลิก 1-start-dashboard.bat อีกครั้ง
  - เปิด Chrome ไปที่ http://localhost:3001 เลือกรายงานและช่วงเวลา แล้วกด "ดึงข้อมูล"
  - ใช้ได้แล้ว ปิดหน้าต่างสีดำได้

ขั้นที่ 5  ให้เปิดเองทุกครั้งที่เปิดเครื่อง
  - คลิกขวา 2-install-autostart.bat > Run as administrator
  - ไม่ต้อง login เข้าเครื่องก็ทำงาน และถ้าหยุดทำงานจะเปิดใหม่เองภายใน 1 นาที

ขั้นที่ 6  (ถ้าต้องการ) ให้เครื่องอื่นในโรงพยาบาลเปิดดูได้
  - คลิกขวา 3-open-firewall.bat > Run as administrator
  - หน้าต่างจะบอก IP ของเครื่องนี้ ให้เครื่องอื่นเปิด http://<IP>:3001
  - เปิดให้เฉพาะเครื่องในวงแลนเดียวกันเท่านั้น

ขั้นที่ 7  ตั้งไม่ให้เครื่อง sleep
  - Settings > System > Power > Screen and sleep
  - "When plugged in, put my device to sleep after" = Never
  - ถ้าเครื่อง sleep dashboard จะเปิดไม่ได้จนกว่าจะปลุกเครื่อง


อัปเดตรุ่นใหม่
  1. วางไฟล์ zip รุ่นใหม่ (med-dashboard-windows-....zip) ไว้ในโฟลเดอร์นี้ ไม่ต้องแตก
  2. คลิกขวา 4-update.bat > Run as administrator แล้วรอจนขึ้นว่า "อัปเดตเรียบร้อย"
  - สคริปต์จะหยุด dashboard ใส่รุ่นใหม่ เปิดกลับ แล้วลบไฟล์ zip ให้เอง
  - dashboard.env (รหัสผ่าน) และโฟลเดอร์ logs ไม่ถูกแตะ
  - ถ้าใส่รุ่นใหม่ไม่สำเร็จ จะคืนรุ่นเดิมและเปิดกลับให้เอง

  ถ้าโฟลเดอร์นี้ยังไม่มี 4-update.bat (ชุดรุ่นแรก) ให้ทำเองครั้งเดียว:
  1. คลิกขวา stop-dashboard.bat > Run as administrator
  2. คลิกขวาไฟล์ zip > Extract All > ปลายทางเป็นโฟลเดอร์ที่ med-dashboard อยู่ข้างใน
     เช่น C:\ (ไม่ใช่ C:\med-dashboard) > เลือก Replace the files in the destination
  3. คลิกขวา 2-install-autostart.bat > Run as administrator

ถอนการติดตั้ง
  1. คลิกขวา uninstall.bat > Run as administrator
  2. ลบโฟลเดอร์นี้ทิ้ง
  3. ถ้าเลิกใช้ถาวร ลบ login ด้วย 3 บรรทัดท้ายไฟล์ create-readonly-login.sql

ถ้ามีปัญหา
  - ดูไฟล์ logs\dashboard.log (มีเมื่อตั้งเปิดเองตอนเปิดเครื่องแล้ว)
  - หน้าเว็บขึ้นว่าเข้าสู่ฐานข้อมูลไม่สำเร็จ: เช็คชื่อ login และรหัสผ่านใน dashboard.env
  - หน้าเว็บขึ้นว่า login แก้ไขข้อมูลได้: ต้องใช้ login จากขั้นที่ 1 ห้ามใช้ sa
  - port 3001 ถูกใช้แล้ว: แก้ PORT=3001 ใน dashboard.env เป็นเลขอื่น เช่น 3005
