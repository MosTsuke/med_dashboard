# Resterile Dashboard — โรงพยาบาลเบตง

Dashboard แสดงผลข้อมูล Resterile พร้อมนำเข้าไฟล์ PDF

## วิธีติดตั้งและรัน

```bash
cd med_dashboard

# ติดตั้ง dependencies
npm install

# รัน development server
npm run dev
```

เปิด http://localhost:3000 ในเบราว์เซอร์

## โครงสร้างโปรเจกต์

```
med_dashboard/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # หน้า dashboard หลัก
│   ├── globals.css
│   └── api/
│       └── parse-pdf/
│           └── route.ts    # API endpoint รับ PDF → parse → JSON
├── components/
│   ├── StatCard.tsx        # การ์ดสรุปตัวเลข (5 ตัว)
│   ├── DepartmentBarChart.tsx  # แผนภูมิแท่ง จำนวนต่อหน่วยงาน
│   ├── DepartmentPieChart.tsx  # แผนภูมิวงกลม สัดส่วน
│   ├── Top5Card.tsx        # Top 5 หน่วยงาน
│   ├── ItemTable.tsx       # ตารางรายการอุปกรณ์
│   └── PDFUploader.tsx     # drag-and-drop upload PDF
├── lib/
│   └── parsePDF.ts         # Logic parse text จาก PDF
├── types/
│   └── index.ts            # TypeScript types
└── package.json
```

## รองรับ PDF 2 รูปแบบ

1. **สรุปผล Resterile** — แสดง stat cards + bar chart + pie chart + top 5
2. **รายงานตามปริมาณ** — แสดง stat cards + ตารางรายการ

## Dependencies หลัก

- Next.js 14 (App Router)
- Recharts — charts
- pdf-parse — อ่านข้อความจาก PDF (server-side)
- Tailwind CSS
- lucide-react — icons
