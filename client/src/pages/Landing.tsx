/**
 * Landing — หน้าแรกแอป (แนวแฟชั่นแม็กกาซีน, เน้นพัฒนาสไตล์ก่อนการขาย)
 * โครง: ทักทาย → ลุควันนี้ (editorial) → สไตลิสต์จัดลุค (พระเอก) → ไอเดียลุค → สำรวจ
 * เน้นภาพลักษณ์แบรนด์ + แรงบันดาลใจ ไม่ให้ดูเหมือนร้านขายของ (ขาย = แค่ tile เดียว)
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
  Shirt,
  Sparkles,
  ArrowRight,
  LogIn,
} from "lucide-react";

const EXPLORE = [
  { to: "/shop", icon: ShoppingBag, label: "ช็อป" },
  { to: "/wardrobe", icon: Shirt, label: "ตู้เสื้อผ้า" },
  { to: "/calendar", icon: CalendarDays, label: "ปฏิทินลุค" },
  { to: "/sell", icon: Camera, label: "ขายเสื้อผ้า" },
  { to: "/knowledge", icon: BookOpen, label: "คลังความรู้" },
  { to: "/profile", icon: UserCircle, label: "บัญชี" },
];

const ROSE = "#B76E79";
const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.18em]";

export default function Landing() {
  const { user } = useAuth();
  const today = trpc.calendar.today.useQuery(undefined, { enabled: !!user });
  const shop = trpc.wardrobe.shopList.useQuery({ limit: 10, offset: 0 }, { enabled: !!user });

  const todayLook = today.data;
  const ideas = (shop.data?.items ?? []).filter((it: any) => it.imageUrl);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-40 h-14 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-md mx-auto h-full flex items-center justify-between px-4">
          <Logo size="md" />
          <a href="https://sheowa.com" aria-label="หน้าร้าน">
            <Button variant="outline" size="sm" className="text-xs rounded-full px-4">หน้าร้าน</Button>
          </a>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 pt-5 pb-6 space-y-7">
        {/* Greeting */}
        <div>
          <p className={eyebrow} style={{ color: ROSE }}>Your daily style</p>
          <h1 className="text-2xl font-bold text-foreground mt-1.5 leading-tight">
            สวัสดีค่ะ<br />วันนี้แต่งตัวให้ปังกัน
          </h1>
        </div>

        {/* ลุควันนี้ — editorial hero */}
        {user && todayLook && todayLook.imageUrl && (
          <Link href="/calendar">
            <div className="relative rounded-3xl overflow-hidden shadow-sm active:scale-[0.99] transition-transform">
              <img src={todayLook.imageUrl} alt="" className="w-full aspect-[4/5] object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
              <div className="absolute left-5 right-5 bottom-5 text-white">
                <p className={eyebrow} style={{ color: "#FCE7C8" }}>ลุควันนี้</p>
                <p className="text-xl font-bold leading-snug mt-1.5">{todayLook.title}</p>
                {todayLook.luckyNote && (
                  <p className="text-xs text-white/90 mt-2 flex items-start gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: ROSE }} />
                    {todayLook.luckyNote}
                  </p>
                )}
              </div>
            </div>
          </Link>
        )}

        {/* พระเอก — ให้สไตลิสต์จัดลุค */}
        <Link href="/lookbook">
          <div className="relative overflow-hidden rounded-3xl bg-teal-600 p-6 active:scale-[0.99] transition-transform">
            <div className="absolute -right-6 -top-6 opacity-15">
              <Wand2 className="w-32 h-32 text-white" />
            </div>
            <p className={eyebrow} style={{ color: "#FCE7C8" }}>สไตลิสต์ส่วนตัว</p>
            <p className="text-lg font-bold text-white mt-1.5 leading-snug">
              ให้สไตลิสต์จัดลุคที่ใช่ให้คุณ
            </p>
            <p className="text-xs text-teal-50/90 mt-1">ถ่ายรูปตัวเอง รับลุคพร้อมสีที่เข้ากับคุณทันที</p>
            <span className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-white bg-white/15 rounded-full px-4 py-2">
              เริ่มแมตช์ลุค <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </Link>

        {/* ไอเดียลุค — แรงบันดาลใจ (ไม่โชว์ราคา = ไม่ให้รู้สึกเป็นร้านขาย) */}
        {user && ideas.length > 0 && (
          <div>
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className={eyebrow} style={{ color: ROSE }}>Inspiration</p>
                <h2 className="text-base font-bold text-foreground mt-0.5">ไอเดียลุคจากคอมมูนิตี้</h2>
              </div>
              <Link href="/shop"><span className="text-xs font-medium text-teal-700">ดูเพิ่ม ›</span></Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
              {ideas.map((it: any) => (
                <Link key={it.id} href="/shop">
                  <div className="shrink-0 w-32">
                    <div className="w-32 h-44 rounded-2xl overflow-hidden bg-warm-100">
                      <img src={it.imageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                    {it.brand && (
                      <p className="text-[11px] text-muted-foreground truncate mt-1.5 text-center">{it.brand}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* สำรวจ */}
        <div>
          <p className={`${eyebrow} text-muted-foreground mb-3`}>สำรวจ</p>
          <div className="grid grid-cols-3 gap-2.5">
            {EXPLORE.map((s) => {
              const Icon = s.icon;
              return (
                <Link key={s.to} href={s.to}>
                  <div className="bg-card border border-border rounded-2xl py-4 text-center active:scale-[0.98] transition-transform">
                    <Icon className="w-5 h-5 text-teal-700 mx-auto" />
                    <p className="text-xs text-foreground mt-1.5 font-medium">{s.label}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* not logged in */}
        {!user && (
          <Button asChild className="w-full h-12 rounded-2xl bg-teal-600 hover:bg-teal-700">
            <a href={getLoginUrl()}><LogIn className="w-4 h-4 mr-1.5" />เข้าสู่ระบบด้วย LINE</a>
          </Button>
        )}
      </main>
    </div>
  );
}
