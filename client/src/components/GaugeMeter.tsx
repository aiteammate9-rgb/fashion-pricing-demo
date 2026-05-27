/**
 * GaugeMeter – Soft Utility Design
 * แสดง Sellability Score เป็น semi-circle gauge
 */
import { useEffect, useState } from "react";

interface Props {
  score: number; // 0-100
  label: string;
  size?: number;
}

export default function GaugeMeter({ score, label, size = 160 }: Props) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  const radius = (size - 20) / 2;
  const cx = size / 2;
  const cy = size / 2 + 10;
  const circumference = Math.PI * radius;
  const progress = (animatedScore / 100) * circumference;

  // Color based on score
  const getColor = (s: number) => {
    if (s >= 80) return { stroke: "#0C7355", text: "ขายง่ายมาก", bg: "bg-teal-50", textColor: "text-teal-700" };
    if (s >= 65) return { stroke: "#0C7355", text: "ขายง่าย", bg: "bg-teal-50", textColor: "text-teal-600" };
    if (s >= 50) return { stroke: "#f59e0b", text: "พอขายได้", bg: "bg-amber-50", textColor: "text-amber-600" };
    return { stroke: "#f97066", text: "ขายยาก", bg: "bg-red-50", textColor: "text-red-500" };
  };

  const config = getColor(animatedScore);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
        {/* Background arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="#e8e4df"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={config.stroke}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          style={{
            transition: "stroke-dasharray 1s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
        {/* Score text */}
        <text
          x={cx}
          y={cy - 12}
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: "28px", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}
        >
          {animatedScore}
        </text>
        <text
          x={cx}
          y={cy + 8}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: "11px", fontWeight: 500 }}
        >
          / 100
        </text>
      </svg>
      <div className={`mt-1 px-3 py-1 rounded-full ${config.bg}`}>
        <span className={`text-xs font-semibold ${config.textColor}`}>{config.text}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
    </div>
  );
}
