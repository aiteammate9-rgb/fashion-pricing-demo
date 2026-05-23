# Static Demo Browser Test Notes

ทดสอบ `docs/index.html` ผ่าน browser local file แล้วหน้าโหลดสำเร็จ แสดง hero, mobile preview, form ประเมินราคา, result card, caption และ history table ได้ครบถ้วน

ผลทดสอบ interactive:

| Action | Expected | Observed |
|---|---|---|
| โหลดหน้าแรก | แสดงราคา default สำหรับเสื้อยืด No Brand | แสดงราคาแนะนำประมาณ ฿90 และคะแนน 65/100 |
| เปลี่ยนแบรนด์เป็น Uniqlo | ราคาและแคปชันคำนวณใหม่แบบ client-side | แสดง `เสื้อยืด Uniqlo`, ขายเร็ว ฿170, ราคาแนะนำ ฿220, เพิ่มมูลค่า ฿270, คะแนน 71/100 |

สรุป: static demo พร้อม commit และ deploy ผ่าน GitHub Pages โดยไม่ต้องใช้ backend, database, Docker หรือบัตรเครดิต hosting
