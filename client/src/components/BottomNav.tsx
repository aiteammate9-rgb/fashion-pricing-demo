/**
 * BottomNav — แถบนำทางล่าง 5 ปุ่ม (ตามผลวิจัย UX: Rule of 5 + ปุ่มกลางเด่น)
 * ปุ่มกลาง "ขาย" ยกเด่นเป็นวงกลมเขียวมรกต กดง่ายด้วยนิ้วโป้ง
 * โชว์เฉพาะหน้าหลักที่ผู้ใช้ล็อกอินแล้ว (ซ่อนบนหน้า login/404)
 */
import { Link, useLocation } from "wouter";
import { Sparkles, ShoppingBag, Camera, Shirt, UserCircle } from "lucide-react";

const ITEMS = [
  { to: "/lookbook", label: "แมตช์ลุค", icon: Sparkles },
  { to: "/shop", label: "ช็อป", icon: ShoppingBag },
  { to: "/sell", label: "ขาย", icon: Camera, center: true },
  { to: "/wardrobe", label: "ตู้เสื้อผ้า", icon: Shirt },
  { to: "/profile", label: "บัญชี", icon: UserCircle },
] as const;

// Routes where the bar should NOT show.
const HIDE_ON = ["/404"];

export default function BottomNav() {
  const [location] = useLocation();
  if (HIDE_ON.includes(location)) return null;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-md border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-md mx-auto flex items-end justify-around h-16 px-2">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          const active = location === it.to;
          if ((it as any).center) {
            return (
              <Link key={it.to} href={it.to} className="flex flex-col items-center -mt-6">
                <span className="w-14 h-14 rounded-full bg-teal-600 flex items-center justify-center shadow-lg ring-4 ring-card">
                  <Icon className="w-6 h-6 text-white" />
                </span>
                <span className="text-[10px] mt-0.5 font-medium text-teal-700">{it.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={it.to}
              href={it.to}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
            >
              <Icon className={`w-5 h-5 ${active ? "text-teal-600" : "text-muted-foreground"}`} />
              <span className={`text-[10px] ${active ? "text-teal-700 font-medium" : "text-muted-foreground"}`}>
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
