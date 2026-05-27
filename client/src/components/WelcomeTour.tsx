/**
 * WelcomeTour — ป๊อปอัปต้อนรับ 3 สเตปสำหรับผู้ใช้ใหม่ (แก้ปัญหา "ไม่รู้ต้องทำอะไร")
 * แสดงครั้งเดียว (จำใน localStorage) ภาษาคนธรรมดา ปุ่มใหญ่ ธีมแบรนด์
 */
import { useEffect, useState } from "react";
import { Sparkles, Camera, ShoppingBag, ChevronRight } from "lucide-react";
import Logo from "./Logo";

const KEY = "sheowa_welcome_seen_v1";

const SLIDES = [
  {
    icon: Sparkles,
    title: "ยินดีต้อนรับสู่ SHEOWA",
    body: "ที่เดียวจบ — ให้สไตลิสต์จัดชุดให้ ขายเสื้อผ้าที่ไม่ใส่ และช้อปของมือสองสวย ๆ",
  },
  {
    icon: Camera,
    title: "อยากได้เงิน? กดปุ่ม “ขาย”",
    body: "ปุ่มกลางสีเขียวด้านล่าง — ถ่ายรูปเสื้อผ้า แล้วรู้ราคาที่ขายได้จริงในไม่กี่วินาที",
  },
  {
    icon: ShoppingBag,
    title: "อยากแต่งตัวสวย? กด “แมตช์ลุค”",
    body: "ให้สไตลิสต์ช่วยจัดชุดให้เข้ากับรูปร่างและสีผิวของคุณ — เลือกซื้อเพิ่มได้เลย",
  },
];

export default function WelcomeTour() {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  const close = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (!open) return null;
  const s = SLIDES[step];
  const Icon = s.icon;
  const last = step === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-card rounded-3xl p-6 border border-border shadow-xl">
        <div className="flex justify-center mb-4">
          <Logo size="md" />
        </div>

        <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-4">
          <Icon className="w-8 h-8 text-teal-600" />
        </div>

        <h2 className="text-lg font-bold text-foreground text-center mb-2">{s.title}</h2>
        <p className="text-sm text-muted-foreground text-center leading-relaxed mb-5">{s.body}</p>

        {/* dots */}
        <div className="flex justify-center gap-1.5 mb-5">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-teal-600" : "w-1.5 bg-border"}`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => (last ? close() : setStep(step + 1))}
          className="w-full py-3.5 rounded-2xl bg-teal-600 text-white font-medium text-base flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
        >
          {last ? "เริ่มเลย" : "ถัดไป"}
          {!last && <ChevronRight className="w-4 h-4" />}
        </button>
        {!last && (
          <button
            type="button"
            onClick={close}
            className="w-full mt-2 text-xs text-muted-foreground py-2"
          >
            ข้าม
          </button>
        )}
      </div>
    </div>
  );
}
