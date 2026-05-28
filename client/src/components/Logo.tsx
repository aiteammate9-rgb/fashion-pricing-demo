/**
 * Logo — SHEOWA brand mark (uploaded logo: curved S + sparkle + wordmark).
 * Uses the real PNG logo served from /public.
 *  - variant "dark"  → dark logo for light surfaces (default; eggshell top bars)
 *  - variant "cream" → light logo for dark/photo surfaces
 * Height scales with the `size` prop.
 */
type Size = "sm" | "md" | "lg";
type Variant = "dark" | "cream";

const HEIGHTS: Record<Size, number> = { sm: 22, md: 28, lg: 38 };

export default function Logo({
  size = "md",
  variant = "dark",
  className = "",
}: {
  size?: Size;
  variant?: Variant;
  className?: string;
}) {
  const h = HEIGHTS[size];
  const src = variant === "cream" ? "/sheowa-logo-cream.png" : "/sheowa-logo.png";
  return (
    <img
      src={src}
      alt="SHEOWA"
      height={h}
      style={{ height: h, width: "auto" }}
      className={`inline-block select-none ${className}`}
      draggable={false}
    />
  );
}
