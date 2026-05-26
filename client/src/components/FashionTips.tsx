/**
 * FashionTips — self-contained rotating fashion tips box.
 * Drop <FashionTips /> anywhere a loading/waiting state needs to keep the
 * user engaged. Rotates every ~4.5s. No props required.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

const FASHION_TIPS = [
  "เสื้อโทนเย็น (ฟ้า เทา ชมพูอมฟ้า) เข้ากับผิวอันเดอร์โทนเย็น",
  "โทนอุ่น (ครีม น้ำตาล ส้มอิฐ) ช่วยขับผิวอันเดอร์โทนอุ่นให้ดูสุขภาพดี",
  "ตัวบนหลวม → จับคู่ตัวล่างทรงเข้ารูป ให้สัดส่วนสมดุล",
  "สีเอิร์ธโทนใส่ด้วยกันได้แทบทุกแบบ แทบไม่พลาด",
  "ชิ้นลายเด่น 1 ชิ้นต่อลุคก็พอ ที่เหลือเล่นสีพื้น",
  "รองเท้าโทนเดียวกับกางเกง ช่วยให้ขาดูยาวขึ้น",
  "ผ้าเนื้อมันกับผ้าเนื้อด้าน จับคู่ให้พอดี อย่าให้ตีกัน",
  "สีขาว-ครีมเป็นเบสที่จับคู่อะไรก็ดูสะอาดตา",
  "เครื่องประดับชิ้นเล็กสีทอง/เงิน ช่วยยกลุคให้ดูพรีเมียม",
  "ลุคโมโนโครม (สีเดียวไล่เฉด) ดูแพงและสูงโปร่ง",
];

export default function FashionTips({ className = "" }: { className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % FASHION_TIPS.length), 4500);
    return () => clearInterval(id);
  }, []);
  return (
    <div
      className={`rounded-xl bg-warm-50 border border-warm-200 px-3 py-2.5 text-left flex items-start gap-2 ${className}`}
    >
      <Sparkles className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium text-teal-700 mb-0.5">เกร็ดแฟชั่นระหว่างรอ</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
            className="text-xs text-foreground leading-relaxed"
          >
            {FASHION_TIPS[i]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
