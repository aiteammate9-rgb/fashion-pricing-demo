/**
 * ThaiDateSelect — birthdate picker using 3 native <select> (day / month / year-BE).
 * Works on every mobile browser incl. the LINE in-app browser, where the native
 * <input type="date"> is sometimes untappable.
 *
 * Keeps its OWN state for each dropdown so a partial pick (e.g. day only) stays
 * visible — it only calls onChange with an ISO yyyy-mm-dd once all three are set.
 * The year dropdown shows Buddhist era (พ.ศ. = +543); value/onChange use Gregorian.
 */
import { useEffect, useState } from "react";

interface Props {
  value: string; // "yyyy-mm-dd" or ""
  onChange: (iso: string) => void;
  className?: string;
}

const TH_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

function parse(v: string) {
  const [y, m, d] = (v || "").split("-");
  return { y: y ? Number(y) : 0, m: m ? Number(m) : 0, d: d ? Number(d) : 0 };
}

export default function ThaiDateSelect({ value, onChange, className }: Props) {
  const init = parse(value);
  const [day, setDay] = useState(init.d);
  const [month, setMonth] = useState(init.m);
  const [year, setYear] = useState(init.y);

  // Re-sync if the parent value changes externally (e.g. profile prefill arrives).
  useEffect(() => {
    const p = parse(value);
    setDay(p.d);
    setMonth(p.m);
    setYear(p.y);
  }, [value]);

  const nowYear = new Date().getFullYear();
  const years: number[] = [];
  for (let yy = nowYear; yy >= nowYear - 90; yy--) years.push(yy);

  const update = (d: number, m: number, y: number) => {
    setDay(d);
    setMonth(m);
    setYear(y);
    if (d && m && y) {
      onChange(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
  };

  const sel = "border border-input rounded-md px-2 py-2 text-sm bg-card text-foreground";

  return (
    <div className={`flex gap-2 ${className ?? ""}`}>
      <select className={sel} value={day || ""} onChange={e => update(Number(e.target.value), month, year)}>
        <option value="">วัน</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <select className={sel} value={month || ""} onChange={e => update(day, Number(e.target.value), year)}>
        <option value="">เดือน</option>
        {TH_MONTHS.map((mn, i) => (
          <option key={i} value={i + 1}>{mn}</option>
        ))}
      </select>
      <select className={sel} value={year || ""} onChange={e => update(day, month, Number(e.target.value))}>
        <option value="">ปี (พ.ศ.)</option>
        {years.map(yy => (
          <option key={yy} value={yy}>{yy + 543}</option>
        ))}
      </select>
    </div>
  );
}
