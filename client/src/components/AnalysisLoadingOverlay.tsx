/**
 * AnalysisLoadingOverlay – แสดงสถานะ step-by-step ระหว่าง AI ประมวลผล
 * มี 4 ขั้นตอน: อัปโหลดรูป → วิเคราะห์ AI → คำนวณราคา → สร้างผลลัพธ์
 */
import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Brain, Calculator, CheckCircle2, Loader2, Sparkles, UserCircle, X } from "lucide-react";

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

export type AnalysisStep = "uploading" | "analyzing" | "consensus" | "pricing" | "done";

interface Props {
  currentStep: AnalysisStep;
  visible: boolean;
  onClose?: () => void;
  footerNote?: ReactNode;
}

const STEPS = [
  { key: "uploading", label: "กำลังอัปโหลดรูปภาพ...", icon: Camera },
  { key: "analyzing", label: "สไตลิสต์กำลังดูเสื้อผ้า...", icon: Brain },
  { key: "consensus", label: "สไตลิสต์กำลังจับคู่ลุค...", icon: Brain },
  { key: "pricing", label: "กำลังคำนวณราคาประเมิน...", icon: Calculator },
  { key: "done", label: "เสร็จสิ้น!", icon: CheckCircle2 },
];

function getStepIndex(step: AnalysisStep): number {
  return STEPS.findIndex((s) => s.key === step);
}

export default function AnalysisLoadingOverlay({ currentStep, visible, onClose, footerNote }: Props) {
  const [tipIdx, setTipIdx] = useState(0);

  useEffect(() => {
    if (!visible || currentStep === "done") return;
    const id = setInterval(() => {
      setTipIdx((i) => (i + 1) % FASHION_TIPS.length);
    }, 4500);
    return () => clearInterval(id);
  }, [visible, currentStep]);

  if (!visible) return null;

  const currentIndex = getStepIndex(currentStep);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="relative bg-card rounded-2xl p-6 sm:p-8 border border-border shadow-xl max-w-sm w-full mx-4"
      >
        {onClose && currentStep !== "done" && (
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้านี้"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-warm-100 hover:bg-warm-200 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-foreground" />
          </button>
        )}

        {/* Animated Brain Icon */}
        <div className="flex justify-center mb-6">
          <motion.div
            animate={{ rotate: currentStep === "done" ? 0 : 360 }}
            transition={{ duration: 2, repeat: currentStep === "done" ? 0 : Infinity, ease: "linear" }}
            className={`w-16 h-16 rounded-full flex items-center justify-center ${
              currentStep === "done" ? "bg-teal-100" : "bg-teal-50"
            }`}
          >
            {currentStep === "done" ? (
              <CheckCircle2 className="w-8 h-8 text-teal-600" />
            ) : (
              <Brain className="w-8 h-8 text-teal-600" />
            )}
          </motion.div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === currentIndex;
            const isCompleted = i < currentIndex;
            const isPending = i > currentIndex;

            return (
              <motion.div
                key={step.key}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${
                  isActive
                    ? "bg-teal-50 border border-teal-200"
                    : isCompleted
                    ? "bg-warm-50/50"
                    : "opacity-40"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive
                      ? "bg-teal-100"
                      : isCompleted
                      ? "bg-teal-500"
                      : "bg-warm-100"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 text-teal-600 animate-spin" />
                  ) : (
                    <Icon className={`w-4 h-4 ${isPending ? "text-muted-foreground" : "text-teal-600"}`} />
                  )}
                </div>
                <span
                  className={`text-sm ${
                    isActive
                      ? "font-semibold text-teal-700"
                      : isCompleted
                      ? "font-medium text-foreground line-through opacity-60"
                      : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-5 h-1.5 bg-warm-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-teal-400 to-teal-600 rounded-full"
            initial={{ width: "0%" }}
            animate={{
              width:
                currentStep === "uploading"
                  ? "20%"
                  : currentStep === "analyzing"
                  ? "40%"
                  : currentStep === "consensus"
                  ? "60%"
                  : currentStep === "pricing"
                  ? "80%"
                  : "100%",
            }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        {/* Rotating fashion tips — keeps the user engaged while AI works */}
        {currentStep !== "done" && (
          <div className="mt-4 rounded-xl bg-warm-50 border border-warm-200 px-3 py-3 min-h-[64px] flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[10px] font-medium text-teal-700 mb-0.5">เกร็ดแฟชั่นระหว่างรอ</p>
              <AnimatePresence mode="wait">
                <motion.p
                  key={tipIdx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35 }}
                  className="text-xs text-foreground leading-relaxed"
                >
                  {FASHION_TIPS[tipIdx]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        )}

        <p className="text-center text-[11px] text-muted-foreground mt-3">
          {currentStep === "done" ? "เสร็จแล้ว!" : "กำลังประมวลผล ใช้เวลาสักครู่"}
        </p>

        {/* Edit profile without cancelling the in-progress analysis (opens a new tab) */}
        {currentStep !== "done" && (
          <button
            type="button"
            onClick={() => window.open("/profile", "_blank", "noopener")}
            className="mx-auto mt-2 flex items-center gap-1.5 text-[11px] text-teal-700 hover:underline"
          >
            <UserCircle className="w-3.5 h-3.5" />
            แก้โปรไฟล์ระหว่างรอ (เปิดแท็บใหม่ ไม่ยกเลิกการประเมิน)
          </button>
        )}

        {footerNote && currentStep !== "done" && (
          <div className="mt-3">{footerNote}</div>
        )}
      </motion.div>
    </motion.div>
  );
}
