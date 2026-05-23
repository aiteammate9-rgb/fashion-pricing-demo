/**
 * AnalysisLoadingOverlay – แสดงสถานะ step-by-step ระหว่าง AI ประมวลผล
 * มี 4 ขั้นตอน: อัปโหลดรูป → วิเคราะห์ AI → คำนวณราคา → สร้างผลลัพธ์
 */
import { motion } from "framer-motion";
import { Camera, Brain, Calculator, CheckCircle2, Loader2 } from "lucide-react";

export type AnalysisStep = "uploading" | "analyzing" | "consensus" | "pricing" | "done";

interface Props {
  currentStep: AnalysisStep;
  visible: boolean;
}

const STEPS = [
  { key: "uploading", label: "กำลังอัปโหลดรูปภาพ...", icon: Camera },
  { key: "analyzing", label: "AI กำลังวิเคราะห์เสื้อผ้า...", icon: Brain },
  { key: "consensus", label: "AI 3 ตัวกำลังถกกัน...", icon: Brain },
  { key: "pricing", label: "กำลังคำนวณราคาประเมิน...", icon: Calculator },
  { key: "done", label: "เสร็จสิ้น!", icon: CheckCircle2 },
];

function getStepIndex(step: AnalysisStep): number {
  return STEPS.findIndex((s) => s.key === step);
}

export default function AnalysisLoadingOverlay({ currentStep, visible }: Props) {
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
        className="bg-card rounded-2xl p-6 sm:p-8 border border-border shadow-xl max-w-sm w-full mx-4"
      >
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

        <p className="text-center text-[11px] text-muted-foreground mt-3">
          กรุณารอสักครู่ ระบบกำลังประมวลผล
        </p>
      </motion.div>
    </motion.div>
  );
}
