/**
 * Knowledge Page — คลังความรู้แต่งตัว (Style Tips)
 * เนื้อหา static จัดเป็นหมวด อ่านง่าย ภาษาคนธรรมดา ธีมแบรนด์
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  ArrowLeft,
  Home as HomeIcon,
  Shirt,
  Palette,
  Sparkles,
  Crown,
  ChevronDown,
} from "lucide-react";
import { Link } from "wouter";
import Logo from "@/components/Logo";

const TOPICS = [
  {
    icon: Shirt,
    title: "แต่งตัวตามรูปร่าง",
    tips: [
      "ทรงนาฬิกาทราย: เน้นเอว ใส่เดรสรัดเอวหรือเสื้อเข้ารูป",
      "ทรงลูกแพร์ (สะโพกกว้าง): ตัวบนสว่าง/มีลาย ตัวล่างสีเข้มเรียบ",
      "ทรงแอปเปิล (ช่วงกลางหนา): เสื้อทรงปล่อยพอดี กางเกงเอวสูง",
      "ทรงสี่เหลี่ยม: สร้างส่วนเว้าด้วยเข็มขัด เลเยอร์ หรือกระโปรงบาน",
    ],
  },
  {
    icon: Palette,
    title: "แต่งตัวตามสีผิว",
    tips: [
      "อันเดอร์โทนเย็น: ฟ้า เทา ชมพูอมฟ้า ม่วง ขับผิวให้สว่าง",
      "อันเดอร์โทนอุ่น: ครีม น้ำตาล ส้มอิฐ เขียวมะกอก ทำให้ดูสุขภาพดี",
      "ผิวเข้ม: สีสดจัด เช่น มรกต แดง เหลืองทอง ตัดกันสวย",
      "ไม่แน่ใจ? สแกนสีผิวในหน้าโปรไฟล์ ให้สไตลิสต์ช่วยดู",
    ],
  },
  {
    icon: Sparkles,
    title: "มิกซ์แอนด์แมตช์",
    tips: [
      "ลายเด่น 1 ชิ้นต่อลุคก็พอ ที่เหลือเล่นสีพื้น",
      "เอิร์ธโทนใส่ด้วยกันได้แทบทุกแบบ แทบไม่พลาด",
      "ตัวบนหลวม → จับคู่ตัวล่างเข้ารูป ให้สัดส่วนสมดุล",
      "รองเท้าโทนเดียวกับกางเกง ช่วยให้ขาดูยาว",
    ],
  },
  {
    icon: Crown,
    title: "แต่งให้ดูแพง",
    tips: [
      "ลุคโมโนโครม (สีเดียวไล่เฉด) ดูแพงและสูงโปร่ง",
      "เลือกผ้าทรงอยู่ตัว ไม่ยับง่าย สำคัญกว่าแบรนด์",
      "เครื่องประดับชิ้นเล็กสีทอง/เงิน ยกลุคให้ดูพรีเมียม",
      "เสื้อผ้าพอดีตัว (ไม่หลวม/คับเกิน) คือเคล็ดลับดูแพงที่สุด",
    ],
  },
];

export default function KnowledgePage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <BookOpen className="w-5 h-5 text-teal-600" />
            <h1 className="text-sm font-bold text-foreground">คลังความรู้แต่งตัว</h1>
          </div>
          <Logo size="sm" />
        </div>
      </header>

      <main className="px-4 py-5 space-y-3">
        <p className="text-sm text-muted-foreground">
          เคล็ดลับแต่งตัวง่าย ๆ ให้ดูดีในทุกวัน — แตะหัวข้อเพื่ออ่าน
        </p>

        {TOPICS.map((t, i) => {
          const Icon = t.icon;
          const isOpen = open === i;
          return (
            <div key={t.title} className="bg-card rounded-2xl border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full flex items-center gap-3 px-4 py-4 text-left"
              >
                <span className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-teal-600" />
                </span>
                <span className="flex-1 text-sm font-bold text-foreground">{t.title}</span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <ul className="px-4 pb-4 space-y-2">
                  {t.tips.map((tip, k) => (
                    <li key={k} className="flex items-start gap-2 text-sm text-foreground/90">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-coral-400 shrink-0" />
                      <span className="leading-relaxed">{tip}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}

        <div className="pt-2 flex gap-2">
          <Button asChild className="flex-1 bg-teal-600 hover:bg-teal-700">
            <Link href="/lookbook"><Sparkles className="w-4 h-4 mr-1.5" />ลองให้สไตลิสต์จัดลุค</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/"><HomeIcon className="w-4 h-4" /></Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
