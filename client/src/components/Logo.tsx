/**
 * Logo — SHEOWA wordmark "Star Aura" direction
 * ตัวอักษรเขียวมรกต + ดาว 4 แฉกสีโรสโกลด์มุมขวาบน (เป็นมิตร สดใส มีคลาส)
 * ใช้ฟอนต์ Anuphan (ผ่าน --font-sans) ขนาดปรับด้วย prop size
 */
type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { text: string; star: number }> = {
  sm: { text: "text-lg", star: 12 },
  md: { text: "text-2xl", star: 16 },
  lg: { text: "text-4xl", star: 22 },
};

export default function Logo({
  size = "md",
  className = "",
}: {
  size?: Size;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span className={`relative inline-flex items-start font-bold tracking-wide text-teal-600 ${s.text} ${className}`}>
      SHEOWA
      <svg
        width={s.star}
        height={s.star}
        viewBox="0 0 24 24"
        className="ml-0.5 -mt-0.5 shrink-0"
        aria-hidden="true"
      >
        {/* 4-point sparkle (rose gold) */}
        <path
          d="M12 0 C13 7 17 11 24 12 C17 13 13 17 12 24 C11 17 7 13 0 12 C7 11 11 7 12 0 Z"
          fill="#B76E79"
        />
      </svg>
    </span>
  );
}
