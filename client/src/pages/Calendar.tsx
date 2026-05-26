/**
 * Calendar Page – ปฏิทินแต่งตัว
 * แสดงปฏิทินรายเดือน: แต่ละวันมีลุคที่ระบบจัดให้ (หมุนจากลุคที่แมตช์ไว้) +
 * สีมงคลประจำวัน + สภาพอากาศ กด "จัดชุดทั้งเดือน" เพื่อเติมอัตโนมัติ และระบบ
 * จะส่งลุคของวันนั้นเข้า LINE ให้ทุกเช้า
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Wand2,
  LogIn,
  ArrowLeft,
  Home as HomeIcon,
  Sparkles,
  CloudSun,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const TH_DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function bkkToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}
function ymOf(d: string) {
  return d.slice(0, 7);
}
function addMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

interface DayPlan {
  date: string;
  outfitId: number | null;
  luckyNote: string | null;
  weatherNote: string | null;
  title: string | null;
  occasion: string | null;
  imageUrl: string | null;
}

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const [month, setMonth] = useState<string>(ymOf(bkkToday()));
  const [openDate, setOpenDate] = useState<string | null>(null);

  const { data, isLoading, refetch } = trpc.calendar.month.useQuery(
    { month },
    { enabled: !!user },
  );
  const outfitsQ = trpc.outfits.list.useQuery(undefined, { enabled: !!user });

  const generate = trpc.calendar.generateMonth.useMutation({
    onSuccess: (r) => {
      toast.success(`จัดชุดให้ ${r.assigned} วันแล้ว (ใช้ ${r.looksUsed} ลุค)`);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const assign = trpc.calendar.assignDay.useMutation({
    onSuccess: () => {
      toast.success("เปลี่ยนลุคของวันนี้แล้ว");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const clearDay = trpc.calendar.clearDay.useMutation({
    onSuccess: () => {
      toast.success("ล้างวันนี้แล้ว");
      refetch();
      setOpenDate(null);
    },
    onError: (e) => toast.error(e.message),
  });

  // Map date → plan for quick lookup.
  const planByDate = useMemo(() => {
    const m = new Map<string, DayPlan>();
    (data?.days as DayPlan[] | undefined)?.forEach((d) => m.set(d.date, d));
    return m;
  }, [data]);

  // Build the calendar grid (leading blanks + days).
  const cells = useMemo(() => {
    const [y, mo] = month.split("-").map(Number);
    const firstDow = new Date(y, mo - 1, 1).getDay();
    const daysInMonth = new Date(y, mo, 0).getDate();
    const arr: (string | null)[] = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push(`${month}-${String(d).padStart(2, "0")}`);
    }
    return arr;
  }, [month]);

  const today = bkkToday();
  const openPlan = openDate ? planByDate.get(openDate) : undefined;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-teal-300 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto">
            <LogIn className="w-8 h-8 text-teal-600" />
          </div>
          <h1 className="text-xl font-bold text-foreground">เข้าสู่ระบบเพื่อดูปฏิทินแต่งตัว</h1>
          <div className="flex gap-3 justify-center">
            <Button asChild variant="outline">
              <Link href="/"><ArrowLeft className="w-4 h-4 mr-1.5" />กลับหน้าหลัก</Link>
            </Button>
            <Button asChild className="bg-teal-600 hover:bg-teal-700">
              <a href={getLoginUrl()}><LogIn className="w-4 h-4 mr-1.5" />เข้าสู่ระบบ</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const [yy, mm] = month.split("-").map(Number);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/lookbook">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ArrowLeft className="w-4 h-4" />กลับ
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-teal-600" />
              <h1 className="text-sm font-bold text-foreground">ปฏิทินแต่งตัว</h1>
            </div>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <HomeIcon className="w-4 h-4" />หน้าหลัก
            </Button>
          </Link>
        </div>
      </header>

      <main className="container py-5 space-y-4">
        {/* Month nav + generate */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setMonth(addMonth(month, -1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="px-3 text-sm font-bold text-foreground min-w-[120px] text-center">
              {TH_MONTHS[mm - 1]} {yy + 543}
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setMonth(addMonth(month, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button
            className="bg-teal-600 hover:bg-teal-700 gap-1.5"
            disabled={generate.isPending}
            onClick={() => generate.mutate({ month })}
          >
            <Wand2 className="w-4 h-4" />
            {generate.isPending ? "กำลังจัด..." : "จัดชุดทั้งเดือน"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          ระบบจะหมุนลุคที่คุณแมตช์ไว้ลงแต่ละวัน พร้อมสีมงคลและสภาพอากาศ และส่งลุคของวันนั้นเข้า LINE ให้ทุกเช้า
        </p>

        {/* Calendar grid */}
        <div className="rounded-2xl border border-border bg-card p-2 sm:p-3">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {TH_DOW.map((d) => (
              <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          {isLoading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-warm-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {cells.map((date, i) => {
                if (!date) return <div key={`b${i}`} />;
                const plan = planByDate.get(date);
                const dayNum = Number(date.slice(-2));
                const isToday = date === today;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setOpenDate(date)}
                    className={`relative aspect-square rounded-lg overflow-hidden border text-left transition-all ${
                      isToday ? "border-teal-500 ring-1 ring-teal-400" : "border-border"
                    } ${plan?.imageUrl ? "" : "bg-warm-50 hover:bg-warm-100"}`}
                  >
                    {plan?.imageUrl ? (
                      <img src={plan.imageUrl} alt={plan.title ?? ""} className="absolute inset-0 w-full h-full object-cover" />
                    ) : null}
                    <span
                      className={`absolute top-0.5 left-1 text-[10px] font-bold z-10 ${
                        plan?.imageUrl ? "text-white drop-shadow" : "text-foreground"
                      }`}
                    >
                      {dayNum}
                    </span>
                    {plan?.luckyNote && (
                      <span className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-400 ring-1 ring-white z-10" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Day detail dialog */}
      <Dialog open={!!openDate} onOpenChange={(o) => !o && setOpenDate(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {openDate
                ? `${Number(openDate.slice(-2))} ${TH_MONTHS[Number(openDate.slice(5, 7)) - 1]}`
                : ""}
            </DialogTitle>
          </DialogHeader>

          {openPlan?.imageUrl ? (
            <div className="space-y-3">
              <img src={openPlan.imageUrl} alt={openPlan.title ?? ""} className="w-full rounded-xl object-cover" />
              <div>
                <h3 className="text-sm font-bold text-foreground">{openPlan.title}</h3>
                {openPlan.occasion && <p className="text-xs text-muted-foreground">{openPlan.occasion}</p>}
              </div>
              {openPlan.luckyNote && (
                <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-2">
                  <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{openPlan.luckyNote}</span>
                </div>
              )}
              {openPlan.weatherNote && (
                <div className="flex items-start gap-1.5 text-xs text-sky-700 bg-sky-50 rounded-lg px-2.5 py-2">
                  <CloudSun className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{openPlan.weatherNote}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">ยังไม่มีลุคสำหรับวันนี้</p>
          )}

          {/* Pick a different look */}
          {(outfitsQ.data?.length ?? 0) > 0 && openDate && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-medium text-muted-foreground">เลือกลุคสำหรับวันนี้</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {outfitsQ.data!.map((o: any) => (
                  <button
                    key={o.id}
                    type="button"
                    disabled={assign.isPending}
                    onClick={() => assign.mutate({ date: openDate, outfitId: o.id })}
                    className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 ${
                      openPlan?.outfitId === o.id ? "border-teal-500" : "border-transparent"
                    }`}
                  >
                    {o.tryOnImageUrl ? (
                      <img src={o.tryOnImageUrl} alt={o.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-warm-100" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {openPlan?.outfitId && openDate && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1.5"
              disabled={clearDay.isPending}
              onClick={() => clearDay.mutate({ date: openDate })}
            >
              <Trash2 className="w-3.5 h-3.5" />ล้างวันนี้
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
