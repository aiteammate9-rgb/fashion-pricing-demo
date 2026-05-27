/**
 * Landing — หน้าแรกใหม่ (หน้าต้อนรับ/เลือกเมนู)
 * โครง: ทักทาย → ลุควันนี้ (จากปฏิทิน) → 3 การ์ดหลัก → ของแนะนำ (จาก shop) → แถวรอง
 * เบา ไม่มี logic หนัก — การสแกนอยู่ที่ /sell
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import Logo from "@/components/Logo";
import {
  Wand2,
  Camera,
  ShoppingBag,
  CalendarDays,
  BookOpen,
  UserCircle,
  ChevronRight,
  Sparkles,
  LogIn,
  Package,
} from "lucide-react";

const PRIMARY = [
  { to: "/lookbook", icon: Wand2, title: "ให้สไตลิสต์จัดชุดให้", sub: "ถ่ายรูปตัวเอง รับลุคที่ใช่" },
  { to: "/sell", icon: Camera, title: "ขายเสื้อผ้า", sub: "ถ่ายรูป รู้ราคาที่ขายได้จริง" },
  { to: "/shop", icon: ShoppingBag, title: "ช็อปเสื้อผ้า", sub: "เลือกซื้อจากคนอื่น" },
];
const SECONDARY = [
  { to: "/calendar", icon: CalendarDays, label: "ปฏิทิน" },
  { to: "/knowledge", icon: BookOpen, label: "คลังความรู้" },
  { to: "/profile", icon: UserCircle, label: "บัญชี" },
];

export default function Landing() {
  const { user } = useAuth();
  const today = trpc.calendar.today.useQuery(undefined, { enabled: !!user });
  const shop = trpc.wardrobe.shopList.useQuery({ limit: 8, offset: 0 }, { enabled: !!user });

  const todayLook = today.data;
  const recommended = shop.data?.items ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-40 h-14 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-md mx-auto h-full flex items-center justify-between px-4">
          <Logo size="md" />
          <a href="https://sheowa.com" aria-label="หน้าร้าน">
            <Button variant="outline" size="sm" className="text-xs">หน้าร้าน</Button>
          </a>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 py-4 space-y-5">
        {/* Greeting */}
        <div>
          <h1 className="text-xl font-bold text-foreground">สวัสดีค่ะ 👋</h1>
          <p className="text-sm text-muted-foreground">วันนี้อยากทำอะไรดี?</p>
        </div>

        {/* ลุควันนี้ */}
        {user && todayLook && todayLook.imageUrl && (
          <Link href="/calendar">
            <div className="flex gap-3 bg-card rounded-2xl border border-border overflow-hidden">
              <img src={todayLook.imageUrl} alt="" className="w-24 h-28 object-cover" />
              <div className="flex-1 py-3 pr-3">
                <p className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide">ลุควันนี้</p>
                <p className="text-sm font-bold text-foreground mt-0.5 leading-snug">{todayLook.title}</p>
                {todayLook.luckyNote && (
                  <p className="text-[11px] text-coral-500 mt-1 flex items-start gap-1">
                    <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />{todayLook.luckyNote}
                  </p>
                )}
              </div>
            </div>
          </Link>
        )}

        {/* 3 การ์ดหลัก */}
        <div className="space-y-2.5">
          {PRIMARY.map((p) => {
            const Icon = p.icon;
            return (
              <Link key={p.to} href={p.to}>
                <div className="flex items-center gap-3 bg-teal-600 border border-teal-700 rounded-2xl p-4 shadow-sm active:scale-[0.99] transition-transform">
                  <Icon className="w-7 h-7 text-amber-200 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-white">{p.title}</p>
                    <p className="text-xs text-teal-100/90">{p.sub}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-teal-100/70" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* ของแนะนำ */}
        {user && recommended.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-foreground">ของแนะนำ</h2>
              <Link href="/shop"><span className="text-xs text-teal-700">ดูทั้งหมด ›</span></Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
              {recommended.map((it: any) => (
                <Link key={it.id} href="/shop">
                  <div className="shrink-0 w-28">
                    <div className="w-28 h-32 rounded-xl overflow-hidden bg-warm-100">
                      {it.imageUrl ? (
                        <img src={it.imageUrl} alt={it.brand} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] font-medium text-foreground truncate mt-1">{it.brand}</p>
                    <p className="text-xs font-bold text-coral-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      ฿{(it.listedPrice ?? 0).toLocaleString()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* แถวรอง */}
        <div className="grid grid-cols-3 gap-2.5">
          {SECONDARY.map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.to} href={s.to}>
                <div className="bg-card border-2 border-teal-100 rounded-2xl py-4 text-center shadow-sm active:scale-[0.98] transition-transform">
                  <Icon className="w-6 h-6 text-teal-700 mx-auto" />
                  <p className="text-xs text-foreground mt-1.5 font-medium">{s.label}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* not logged in */}
        {!user && (
          <Button asChild className="w-full bg-teal-600 hover:bg-teal-700">
            <a href={getLoginUrl()}><LogIn className="w-4 h-4 mr-1.5" />เข้าสู่ระบบด้วย LINE</a>
          </Button>
        )}
      </main>
    </div>
  );
}
