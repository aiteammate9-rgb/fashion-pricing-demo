/**
 * ThaiDateSelect — birthdate picker using 3 native <select> (day / month / year-BE).
 * Works reliably on every mobile browser incl. the LINE in-app browser, where the
 * native <input type="date"> is sometimes untappable. Value/onChange use ISO
 * yyyy-mm-dd (Gregorian); the year dropdown displays Buddhist era (พ.ศ. = +543).
 */
interface Props {
  value: string; // "yyyy-mm-dd" or ""
  onChange: (iso: string) => void;
  className?: string;
}

const TH_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export default function ThaiDateSelect({ value, onChange, className }: Props) {
  const [yStr, mStr, dStr] = (value || "").split("-");
  const year = yStr ? Number(yStr) : 0;
  const month = mStr ? Number(mStr) : 0;
  const day = dStr ? Number(dStr) : 0;

  const nowYear = new Date().getFullYear();
  const years: number[] = [];
  for (let yy = nowYear; yy >= nowYear - 90; yy--) years.push(yy);

  const emit = (d: number, m: number, y: number) => {
    if (d && m && y) {
      onChange(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
  };

  const sel = "border border-input rounded-md px-2 py-2 text-sm bg-card text-foreground";

  return (
    <div className={`flex gap-2 ${className ?? ""}`}>
      <select className={sel} value={day || ""} onChange={e => emit(Number(e.target.value), month, year)}>
        <option value="">วัน</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <select className={sel} value={month || ""} onChange={e => emit(day, Number(e.target.value), year)}>
        <option value="">เดือน</option>
        {TH_MONTHS.map((mn, i) => (
          <option key={i} value={i + 1}>{mn}</option>
        ))}
      </select>
      <select className={sel} value={year || ""} onChange={e => emit(day, month, Number(e.target.value))}>
        <option value="">ปี (พ.ศ.)</option>
        {years.map(yy => (
          <option key={yy} value={yy}>{yy + 543}</option>
        ))}
      </select>
    </div>
  );
}
