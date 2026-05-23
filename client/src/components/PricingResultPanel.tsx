/**
 * PricingResultPanel – Soft Utility Design
 * แสดงผลประเมินราคา: ราคาตลาด, ราคาแนะนำ 3 ระดับ (เลือกเปลี่ยนได้), Sellability Score, ช่วงวันที่ขายออก
 * + Per-Agent Breakdown: แสดงผลประเมินรายตัวจาก AI แต่ละตัว
 */
import { Calendar, ChevronDown, ChevronUp, TrendingUp, Zap, Gem, Info, Globe, Bot, SlidersHorizontal } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import type { PricingResult } from "@/lib/pricing-engine";
import { Slider } from "@/components/ui/slider";
import GaugeMeter from "./GaugeMeter";
import { motion, AnimatePresence } from "framer-motion";

type SellGoalKey = "fast" | "recommended" | "high";

interface Props {
  result: PricingResult;
  selectedGoal?: SellGoalKey;
  onGoalChange?: (goal: SellGoalKey) => void;
  manualPrice?: number | null;
  onManualPriceChange?: (price: number | null) => void;
}

function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  return (
    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {prefix}{value.toLocaleString()}{suffix}
    </span>
  );
}

// Recalculate sellability score based on selected price vs recommended price
function recalcSellability(
  result: PricingResult,
  selectedPrice: number
): { sellabilityScore: number; estimatedDays: string } {
  // Price score component
  const ratio = result.recommendedPrice > 0 ? selectedPrice / result.recommendedPrice : 1;
  let pScore: number;
  if (ratio <= 0.85) pScore = 94;
  else if (ratio <= 1.0) pScore = 84;
  else if (ratio <= 1.15) pScore = 70;
  else if (ratio <= 1.3) pScore = 56;
  else pScore = 40;

  // We keep other factor scores from the original result's sellabilityScore
  // Original formula: priceScore*0.30 + brandScore*0.20 + conditionScore*0.20 + catDemand*0.10 + sizeDemand*0.10 + imgQuality*0.10
  // We can back-calculate the non-price portion: original = origPriceScore*0.30 + rest*0.70
  // rest = (original - origPriceScore*0.30) / 0.70
  const origRatio = result.selectedPrice / result.recommendedPrice;
  let origPScore: number;
  if (origRatio <= 0.85) origPScore = 94;
  else if (origRatio <= 1.0) origPScore = 84;
  else if (origRatio <= 1.15) origPScore = 70;
  else if (origRatio <= 1.3) origPScore = 56;
  else origPScore = 40;

  const restPortion = (result.sellabilityScore - origPScore * 0.30) / 0.70;
  const newScore = Math.round(pScore * 0.30 + restPortion * 0.70);

  let days: string;
  if (newScore >= 85) days = "3–7 วัน";
  else if (newScore >= 70) days = "7–14 วัน";
  else if (newScore >= 50) days = "15–30 วัน";
  else days = "มากกว่า 30 วัน";

  return { sellabilityScore: Math.max(0, Math.min(100, newScore)), estimatedDays: days };
}

export default function PricingResultPanel({ result, selectedGoal: externalGoal, onGoalChange, manualPrice, onManualPriceChange }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const [internalGoal, setInternalGoal] = useState<SellGoalKey>("recommended");

  const activeGoal = externalGoal ?? internalGoal;

  const handleGoalChange = (goal: SellGoalKey) => {
    if (onGoalChange) {
      onGoalChange(goal);
    } else {
      setInternalGoal(goal);
    }
  };

  const priceOptions = [
    {
      key: "fast" as SellGoalKey,
      label: "ขายเร็ว",
      price: result.fastSalePrice,
      icon: <Zap className="w-4 h-4" />,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-300",
      borderInactive: "border-border",
      desc: "ราคาต่ำ ขายออกไว",
    },
    {
      key: "recommended" as SellGoalKey,
      label: "แนะนำ",
      price: result.recommendedPrice,
      icon: <TrendingUp className="w-4 h-4" />,
      color: "text-teal-700",
      bg: "bg-teal-50",
      border: "border-teal-300",
      borderInactive: "border-border",
      desc: "ราคาสมดุล ขายง่าย",
    },
    {
      key: "high" as SellGoalKey,
      label: "ขายคุ้ม",
      price: result.highValuePrice,
      icon: <Gem className="w-4 h-4" />,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-indigo-300",
      borderInactive: "border-border",
      desc: "ราคาสูง รอนานหน่อย",
    },
  ];

  // Get the selected price based on active goal or manual override
  const selectedPrice = useMemo(() => {
    if (manualPrice != null) return manualPrice;
    if (activeGoal === "fast") return result.fastSalePrice;
    if (activeGoal === "high") return result.highValuePrice;
    return result.recommendedPrice;
  }, [activeGoal, result, manualPrice]);

  // Recalculate sellability based on selected goal
  const { sellabilityScore, estimatedDays } = useMemo(
    () => recalcSellability(result, selectedPrice),
    [result, selectedPrice]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="space-y-5"
    >
      {/* Multi-Agent Consensus Badge */}
      {result.consensusData && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl p-3 border border-purple-200"
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center">
              <span className="text-[10px]">🤖</span>
            </div>
            <span className="text-xs font-semibold text-purple-700">
              AI {result.consensusData.agentCount} ตัวประเมินร่วมกัน
            </span>
            <span className={`text-[10px] ml-auto px-2 py-0.5 rounded-full font-medium ${
              result.consensusData.consensusLevel === "unanimous"
                ? "bg-green-100 text-green-700"
                : result.consensusData.consensusLevel === "majority"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-orange-100 text-orange-700"
            }`}>
              {result.consensusData.consensusLevel === "unanimous" ? "เห็นตรงกัน 100%" :
               result.consensusData.consensusLevel === "majority" ? "เสียงส่วนใหญ่ตรงกัน" :
               "ถกกันแล้วสรุป"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <p className="text-[10px] text-purple-600">
              ความมั่นใจรวม: <span className="font-bold">{result.consensusData.confidence}%</span>
            </p>
            {result.consensusData.debateLog && (
              <p className="text-[10px] text-purple-500 truncate flex-1">
                {result.consensusData.debateLog.slice(0, 80)}...
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Per-Agent Breakdown */}
      {result.consensusData?.agentResults && result.consensusData.agentResults.length > 0 && (
        <AgentBreakdown agentResults={result.consensusData.agentResults} />
      )}

      {/* Market Data Source Badge */}
      {result.marketData?.found && result.marketData.bestEstimate && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-200"
        >
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-blue-700">
              อ้างอิงราคาตลาดจริง
            </span>
            <span className="text-[10px] text-blue-500 ml-auto">
              {result.marketData.sources.map(s => s.source.toUpperCase()).join(" + ")} • ความมั่นใจ {result.marketData.bestEstimate.confidence}%
            </span>
          </div>
          <p className="text-[10px] text-blue-600 mt-1">
            ปรับราคาให้เหมาะกับตลาดมือสองไทยแล้ว: ฿{result.marketData.bestEstimate.min.toLocaleString()} - ฿{result.marketData.bestEstimate.max.toLocaleString()}
          </p>
        </motion.div>
      )}

      {/* International Price (for eBay/Amazon) */}
      {result.marketData?.internationalEstimate && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-3 border border-emerald-200"
        >
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">
              ราคาขายต่างประเทศ (eBay/Amazon)
            </span>
          </div>
          <p className="text-sm font-bold text-emerald-700 mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            ${result.marketData.internationalEstimate.min.toFixed(0)} - ${result.marketData.internationalEstimate.max.toFixed(0)} USD
            <span className="text-xs font-normal text-emerald-600 ml-2">
              (แนะนำ ${result.marketData.internationalEstimate.recommended.toFixed(0)} USD)
            </span>
          </p>
          <div className="flex items-center gap-2 mt-2">
            <a
              href={`/listing?brand=${encodeURIComponent(result.brand || "")}&category=${encodeURIComponent(result.category || "")}&size=${encodeURIComponent(result.size || "")}&condition=${encodeURIComponent(result.condition || "")}&priceUSD=${result.marketData?.internationalEstimate?.recommended?.toFixed(0) || "25"}&color=${encodeURIComponent(result.color || "")}&style=${encodeURIComponent(result.style || "")}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M12 3v6"/></svg>
              สร้าง Listing ขายต่างประเทศ
            </a>
          </div>
        </motion.div>
      )}

      {/* Market Range */}
      <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">ช่วงราคาตลาด</h3>
          <span className="text-xs text-muted-foreground">
            {result.marketData?.found ? "อ้างอิงตลาดจริง" : "ราคาประเมิน"}
          </span>
        </div>
        <div className="relative h-3 bg-warm-100 rounded-full overflow-hidden mb-3">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-teal-300 to-teal-500 rounded-full"
          />
        </div>
        <div className="flex justify-between text-sm">
          <div>
            <span className="text-muted-foreground text-xs">ต่ำสุด</span>
            <p className="font-bold text-foreground">
              <AnimatedNumber value={result.marketMin} prefix="฿" />
            </p>
          </div>
          <div className="text-center">
            <span className="text-muted-foreground text-xs">แนะนำ</span>
            <p className="font-bold text-teal-700 text-lg">
              <AnimatedNumber value={result.recommendedPrice} prefix="฿" />
            </p>
          </div>
          <div className="text-right">
            <span className="text-muted-foreground text-xs">สูงสุด</span>
            <p className="font-bold text-foreground">
              <AnimatedNumber value={result.marketMax} prefix="฿" />
            </p>
          </div>
        </div>
      </div>

      {/* 3 Price Options - Clickable */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground">เลือกเป้าหมายการขาย</h3>
          <span className="text-[10px] text-teal-600 font-medium">กดเลือกเปลี่ยนได้</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {priceOptions.map((opt, i) => {
            const isActive = activeGoal === opt.key;
            return (
              <motion.button
                key={opt.key}
                type="button"
                onClick={() => handleGoalChange(opt.key)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
                className={`rounded-xl p-3 border-2 text-center transition-all duration-200 cursor-pointer ${
                  isActive
                    ? `${opt.border} ${opt.bg} shadow-md ring-1 ring-offset-1 ${opt.border.replace("border-", "ring-")}`
                    : `${opt.borderInactive} bg-card hover:shadow-md hover:${opt.bg}`
                }`}
              >
                <div className={`inline-flex items-center gap-1 mb-1.5 ${isActive ? opt.color : "text-muted-foreground"}`}>
                  {opt.icon}
                  <span className="text-[11px] font-semibold">{opt.label}</span>
                </div>
                <p className={`text-xl font-bold ${isActive ? opt.color : "text-foreground"}`}>
                  <AnimatedNumber value={opt.price} prefix="฿" />
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">{opt.desc}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Blend Info Badge */}
      {result.blendInfo && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl p-3 border border-slate-200"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full bg-teal-100 flex items-center justify-center">
                <span className="text-[8px]">📊</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-700">ที่มาของราคา</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-2">
            {/* Weight bar */}
            <div className="flex-1 h-4 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-teal-400 flex items-center justify-center"
                style={{ width: `${Math.round(result.blendInfo.ruleWeight * 100)}%` }}
              >
                {result.blendInfo.ruleWeight >= 0.25 && (
                  <span className="text-[9px] font-bold text-white">
                    Rule {Math.round(result.blendInfo.ruleWeight * 100)}%
                  </span>
                )}
              </div>
              <div
                className="h-full bg-purple-400 flex items-center justify-center"
                style={{ width: `${Math.round(result.blendInfo.aiWeight * 100)}%` }}
              >
                {result.blendInfo.aiWeight >= 0.15 && (
                  <span className="text-[9px] font-bold text-white">
                    AI {Math.round(result.blendInfo.aiWeight * 100)}%
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>Rule-based: ฿{result.blendInfo.ruleBasedPrice.toLocaleString()}</span>
            <span>AI: ฿{result.blendInfo.aiPrice.toLocaleString()}</span>
          </div>
          <p className="text-[10px] text-slate-600 mt-1">{result.blendInfo.reason}</p>
        </motion.div>
      )}

      {/* Manual Price Override */}
      <ManualOverrideSlider result={result} selectedPrice={selectedPrice} onManualPriceChange={onManualPriceChange} />

      {/* Sellability Score + Estimated Days */}
      <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
        <div className="grid grid-cols-2 gap-4 items-center">
          <GaugeMeter
            score={sellabilityScore}
            label="โอกาสขายออก"
            size={140}
          />
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-teal-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">คาดว่าขายออกใน</p>
                <p className="text-sm font-bold text-foreground">{estimatedDays}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-warm-100 flex items-center justify-center">
                <Info className="w-4 h-4 text-warm-800" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ความมั่นใจ</p>
                <p className="text-sm font-bold text-foreground">{result.confidenceScore}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Factors Breakdown */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-warm-50 transition-colors duration-200"
        >
          <span className="text-sm font-semibold text-foreground">ปัจจัยที่มีผลต่อราคา</span>
          {showDetails ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-4 space-y-2.5">
                {result.factors.map((f) => (
                  <div key={f.name} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          f.impact === "positive"
                            ? "bg-teal-500"
                            : f.impact === "negative"
                            ? "bg-red-400"
                            : "bg-warm-200"
                        }`}
                      />
                      <span className="text-xs text-muted-foreground">{f.label}</span>
                    </div>
                    <span className="text-xs font-medium text-foreground">{f.value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {result.explanation}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Manual Override Slider Component ───

function ManualOverrideSlider({ result, selectedPrice, onManualPriceChange }: { result: PricingResult; selectedPrice: number; onManualPriceChange?: (price: number | null) => void }) {
  const [isOverriding, setIsOverriding] = useState(false);
  const [manualPrice, setManualPrice] = useState(result.recommendedPrice);

  const sliderMin = Math.max(29, Math.round(result.marketMin * 0.5));
  const sliderMax = Math.round(result.marketMax * 1.5);

  const handleSliderChange = useCallback((values: number[]) => {
    setManualPrice(values[0]);
    onManualPriceChange?.(values[0]);
  }, [onManualPriceChange]);

  const { sellabilityScore: manualSellScore, estimatedDays: manualDays } = useMemo(
    () => recalcSellability(result, manualPrice),
    [result, manualPrice]
  );

  if (!isOverriding) {
    return (
      <button
        type="button"
        onClick={() => { setIsOverriding(true); setManualPrice(selectedPrice); }}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 hover:bg-slate-50 hover:border-slate-400 transition-colors"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        ปรับราคาเอง
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="bg-card rounded-2xl p-4 border border-teal-200 shadow-sm"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-teal-600" />
          <span className="text-xs font-semibold text-foreground">ปรับราคาเอง</span>
        </div>
        <button
          type="button"
          onClick={() => { setIsOverriding(false); onManualPriceChange?.(null); }}
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          ปิด
        </button>
      </div>

      <div className="mb-2">
        <Slider
          value={[manualPrice]}
          min={sliderMin}
          max={sliderMax}
          step={10}
          onValueChange={handleSliderChange}
          className="w-full"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">฿{sliderMin.toLocaleString()}</span>
        <div className="text-center">
          <p className="text-lg font-bold text-teal-700" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            ฿{manualPrice.toLocaleString()}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>โอกาสขาย: <span className="font-bold text-foreground">{manualSellScore}/100</span></span>
            <span>•</span>
            <span>คาดขายใน <span className="font-bold text-foreground">{manualDays}</span></span>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground">฿{sliderMax.toLocaleString()}</span>
      </div>
    </motion.div>
  );
}

// ─── Per-Agent Breakdown Component ───

const AGENT_DISPLAY: Record<string, { name: string; color: string; bg: string; border: string; icon: string }> = {
  gemini: { name: "Gemini", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", icon: "🔵" },
  gpt4o: { name: "GPT-4o", color: "text-green-700", bg: "bg-green-50", border: "border-green-200", icon: "🟢" },
  claude: { name: "Claude", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", icon: "🟠" },
};

interface AgentResult {
  agent: "gemini" | "gpt4o" | "claude";
  category: string;
  brand: string;
  condition: string;
  estimatedResalePrice: number;
  estimatedResalePriceUSD: number;
  confidence: number;
  reasoning: string;
}

function AgentBreakdown({ agentResults }: { agentResults: AgentResult[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-warm-50 transition-colors duration-200"
      >
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-semibold text-foreground">ผลประเมินรายตัว AI</span>
          <span className="text-[10px] text-muted-foreground ml-1">({agentResults.length} ตัว)</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {agentResults.map((ar, idx) => {
                const display = AGENT_DISPLAY[ar.agent] || AGENT_DISPLAY.gemini;
                return (
                  <motion.div
                    key={ar.agent}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`rounded-xl p-3 border ${display.border} ${display.bg}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{display.icon}</span>
                        <span className={`text-xs font-bold ${display.color}`}>{display.name}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        ar.confidence >= 80 ? "bg-green-100 text-green-700" :
                        ar.confidence >= 60 ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        มั่นใจ {ar.confidence}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div>
                        <span className="text-muted-foreground">ประเภท:</span>{" "}
                        <span className="font-medium text-foreground">{ar.category || "-"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">แบรนด์:</span>{" "}
                        <span className="font-medium text-foreground">{ar.brand || "-"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">สภาพ:</span>{" "}
                        <span className="font-medium text-foreground">{ar.condition || "-"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">ราคาไทย:</span>{" "}
                        <span className="font-bold text-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          ฿{ar.estimatedResalePrice.toLocaleString()}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">ราคาต่างประเทศ:</span>{" "}
                        <span className="font-medium text-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          ${ar.estimatedResalePriceUSD}
                        </span>
                      </div>
                    </div>
                    {ar.reasoning && (
                      <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed border-t border-border/50 pt-1.5">
                        {ar.reasoning}
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
