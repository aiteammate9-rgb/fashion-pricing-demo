/**
 * Lookbook Page — ลุคบุ๊ค / AI สไตลิสต์
 * --------------------------------------------------------------------------
 * - ตั้งค่าโปรไฟล์สไตล์ (วันเกิด → สีนำโชค, undertone)
 * - กดให้ AI จัดลุคจากเสื้อผ้าในตู้ (matching.generate)
 * - แสดงลุคที่บันทึกไว้ (outfits.list) พร้อมคำวิจารณ์สไตลิสต์ + สีนำโชค
 *
 * Route: เพิ่ม <Route path="/lookbook"> ใน App.tsx (ดูไฟล์ App.tsx ที่ให้มาคู่กัน)
 * Place at: client/src/pages/Lookbook.tsx
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Wand2, LogIn, ArrowLeft, Trash2, Shirt, ShoppingBag, Check, Trash } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Link } from "wouter";
import AnalysisLoadingOverlay from "@/components/AnalysisLoadingOverlay";

function ColorSwatches({ palette }: { palette: Array<{ name: string; hex: string }> }) {
  if (!Array.isArray(palette) || palette.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {palette.map((c, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
          <span
            className="inline-block w-4 h-4 rounded-full border border-black/10"
            style={{ backgroundColor: c.hex }}
            title={`${c.name} ${c.hex}`}
          />
          {c.name}
        </div>
      ))}
    </div>
  );
}

export default function LookbookPage() {
  const { user, loading: authLoading } = useAuth();
  const [maxLooks, setMaxLooks] = useState(3);
  const [occasion, setOccasion] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [selectedOutfit, setSelectedOutfit] = useState<any | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [overlayDismissed, setOverlayDismissed] = useState(false);

  const profile = trpc.profile.me.useQuery(undefined, { enabled: !!user });
  const outfits = trpc.outfits.list.useQuery(undefined, { enabled: !!user });

  const upsertProfile = trpc.profile.upsert.useMutation({
    onSuccess: () => {
      toast.success("บันทึกโปรไฟล์แล้ว");
      profile.refetch();
    },
    onError: e => toast.error(`บันทึกไม่สำเร็จ: ${e.message}`),
  });

  const generate = trpc.matching.generate.useMutation({
    onSuccess: res => {
      toast.success(`จัดลุคสำเร็จ ${res.looks?.length ?? 0} ลุค`);
      outfits.refetch();
    },
    onError: e => toast.error(`จัดลุคไม่สำเร็จ: ${e.message}`),
  });

  const crossMatch = trpc.matching.crossUserMatch.useMutation({
    onSuccess: res => {
      toast.success(`จัดลุคข้ามตู้สำเร็จ ${res.looks?.length ?? 0} ลุค`);
      outfits.refetch();
    },
    onError: e => toast.error(`จับคู่ข้ามตู้ไม่สำเร็จ: ${e.message}`),
  });

  const placeOrder = trpc.orders.create.useMutation({
    onSuccess: () => {
      toast.success("จองแล้ว — ชิ้นนี้ถูกกันไว้ให้คุณ รอผู้ขายยืนยัน");
      outfits.refetch();
    },
    onError: e => toast.error(`สั่งซื้อไม่สำเร็จ: ${e.message}`),
  });

  const deleteOutfit = trpc.outfits.delete.useMutation({
    onSuccess: () => {
      toast.success("ลบลุคแล้ว");
      outfits.refetch();
    },
    onError: e => toast.error(`ลบไม่สำเร็จ: ${e.message}`),
  });

  const deleteManyOutfits = trpc.outfits.deleteMany.useMutation({
    onSuccess: res => {
      toast.success(`ลบแล้ว ${res.deleted} ลุค`);
      setSelectedIds(new Set());
      setSelectMode(false);
      outfits.refetch();
    },
    onError: e => toast.error(`ลบไม่สำเร็จ: ${e.message}`),
  });

  const toggleSelect = (id: number) =>
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const selectAllLooks = () =>
    setSelectedIds(new Set((outfits.data ?? []).map((o: any) => o.id)));
  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const migrateImages = trpc.wardrobe.migrateImages.useMutation({
    onSuccess: res => toast.success(`อัปเกรดรูปแล้ว ${res.migrated}/${res.total} ชิ้น`),
    onError: e => toast.error(`อัปเกรดไม่สำเร็จ: ${e.message}`),
  });

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-gray-600">เข้าสู่ระบบเพื่อใช้ AI สไตลิสต์</p>
        <a href={getLoginUrl()}>
          <Button>
            <LogIn className="w-4 h-4 mr-2" /> เข้าสู่ระบบ
          </Button>
        </a>
      </div>
    );
  }

  const savedBirthDate = profile.data?.birthDate ?? "";

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <AnalysisLoadingOverlay
        visible={(generate.isPending || crossMatch.isPending) && !overlayDismissed}
        currentStep="analyzing"
        onClose={() => setOverlayDismissed(true)}
        footerNote={
          <div className="text-center rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              ปิดหน้านี้แล้วใช้งานต่อได้เลย — เมื่อรูปลุคเสร็จ เราจะส่งการ์ดเข้า LINE ให้อัตโนมัติ ไปดูในไลน์ได้โดยไม่ต้องรอตรงนี้
            </p>
            <button
              type="button"
              onClick={() => setOverlayDismissed(true)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-full px-4 py-1.5"
            >
              ปิดหน้านี้ ทำอย่างอื่นต่อ
            </button>
          </div>
        }
      />
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" /> หน้าหลัก
            </Button>
          </Link>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" /> ลุคบุ๊ค · AI สไตลิสต์
          </h1>
          <div className="w-16" />
        </div>

        {/* Profile / lucky color */}
        <Card className="mb-6">
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-medium text-gray-700">โปรไฟล์สไตล์ (วันเกิด → สีนำโชค)</p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-gray-500">
                วันเกิด
                <input
                  type="date"
                  className="block mt-1 border rounded-md px-2 py-1.5 text-sm"
                  value={birthDate || savedBirthDate}
                  onChange={e => setBirthDate(e.target.value)}
                />
              </label>
              <Button
                size="sm"
                variant="outline"
                disabled={upsertProfile.isPending}
                onClick={() =>
                  upsertProfile.mutate({ birthDate: (birthDate || savedBirthDate) || null })
                }
              >
                บันทึกโปรไฟล์
              </Button>
            </div>
            {profile.data?.birthDate && (
              <p className="text-xs text-gray-500">
                วันเกิดที่บันทึก: {profile.data.birthDate}
              </p>
            )}
            <button
              type="button"
              disabled={migrateImages.isPending}
              onClick={() => migrateImages.mutate()}
              className="block text-xs text-gray-400 underline mt-1"
            >
              {migrateImages.isPending
                ? "กำลังอัปเกรดรูปเก่า..."
                : "อัปเกรดรูปเก่าในตู้ → คลาวด์ (เพื่อให้มี try-on)"}
            </button>
          </CardContent>
        </Card>

        {/* Generate */}
        <Card className="mb-8">
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-medium text-gray-700">ให้ AI จัดลุคจากตู้เสื้อผ้า</p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-gray-500 flex-1 min-w-[180px]">
                โอกาส (ไม่บังคับ)
                <input
                  type="text"
                  placeholder="เช่น ออกงานเย็น, คาเฟ่วันหยุด"
                  className="block mt-1 w-full border rounded-md px-2 py-1.5 text-sm"
                  value={occasion}
                  onChange={e => setOccasion(e.target.value)}
                />
              </label>
              <label className="text-xs text-gray-500">
                จำนวนลุค
                <select
                  className="block mt-1 border rounded-md px-2 py-1.5 text-sm"
                  value={maxLooks}
                  onChange={e => setMaxLooks(Number(e.target.value))}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </label>
              <Button
                disabled={generate.isPending}
                onClick={() => {
                  setOverlayDismissed(false);
                  generate.mutate({ maxLooks, occasion: occasion.trim() || undefined });
                }}
              >
                <Wand2 className="w-4 h-4 mr-2" />
                {generate.isPending ? "กำลังจัดลุค..." : "ให้ AI จัดลุค"}
              </Button>
              <Button
                variant="outline"
                disabled={crossMatch.isPending}
                onClick={() => {
                  setOverlayDismissed(false);
                  crossMatch.mutate({ maxLooks, occasion: occasion.trim() || undefined });
                }}
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                {crossMatch.isPending ? "กำลังจับคู่ข้ามตู้..." : "จับคู่ข้ามตู้ (ช้อปเพิ่ม)"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              เพิ่มเสื้อผ้าอย่างน้อย 2 ชิ้นในตู้ แล้วกด "ให้ AI จัดลุค" — ระบบจะเลือกชุดที่เข้ากับสีผิวและสไตล์ของคุณให้อัตโนมัติ
            </p>
            <p className="text-xs text-muted-foreground">
              "จับคู่ข้ามตู้" จะนำเสื้อผ้าที่คนอื่นลงขายมาแมตช์กับตู้ของคุณ พร้อมปุ่มช้อปชิ้นที่ต้องซื้อเพิ่ม
            </p>
          </CardContent>
        </Card>

        {/* Saved looks */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-medium text-gray-700">ลุคที่บันทึกไว้</h2>
          {outfits.data && outfits.data.length > 0 &&
            (!selectMode ? (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSelectMode(true)}>
                <Check className="w-4 h-4" /> เลือก
              </Button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={selectAllLooks}>
                  ทั้งหมด
                </Button>
                <Button variant="ghost" size="sm" onClick={exitSelectMode}>
                  ยกเลิก
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 bg-red-500 hover:bg-red-600 text-white"
                  disabled={selectedIds.size === 0 || deleteManyOutfits.isPending}
                  onClick={() => deleteManyOutfits.mutate({ ids: Array.from(selectedIds) })}
                >
                  <Trash className="w-4 h-4" /> ลบ ({selectedIds.size})
                </Button>
              </div>
            ))}
        </div>
        {outfits.isLoading ? (
          <p className="text-sm text-gray-400">กำลังโหลด...</p>
        ) : !outfits.data || outfits.data.length === 0 ? (
          <p className="text-sm text-gray-400">ยังไม่มีลุค — กด "ให้ AI จัดลุค" ด้านบน</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <AnimatePresence>
              {outfits.data.map(o => {
                const itemIds: number[] = Array.isArray(o.itemIds) ? (o.itemIds as number[]) : [];
                return (
                  <motion.button
                    key={o.id}
                    type="button"
                    onClick={() => (selectMode ? toggleSelect(o.id) : setSelectedOutfit(o))}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-left group"
                  >
                    <Card className="overflow-hidden hover:shadow-lg transition-shadow border-border">
                      <CardContent className="p-0">
                        <div className="aspect-[3/4] bg-warm-100 relative">
                          {selectMode && (
                            <span
                              className={`absolute top-2 right-2 z-20 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                selectedIds.has(o.id)
                                  ? "bg-teal-600 border-teal-600"
                                  : "bg-white/85 border-white"
                              }`}
                            >
                              {selectedIds.has(o.id) && <Check className="w-4 h-4 text-white" />}
                            </span>
                          )}
                          {o.tryOnImageUrl ? (
                            <img
                              src={o.tryOnImageUrl}
                              alt={o.title}
                              loading="lazy"
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Shirt className="w-10 h-10 text-warm-200" />
                            </div>
                          )}
                          {o.source === "cross_user" && (
                            <Badge className="absolute top-2 left-2 text-[9px] px-1.5 py-0 bg-emerald-600 text-white border-0">
                              <ShoppingBag className="w-2.5 h-2.5 mr-0.5" />
                              ข้ามตู้
                            </Badge>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-semibold text-foreground truncate">{o.title}</p>
                          {o.occasion && (
                            <p className="text-[11px] text-muted-foreground truncate">{o.occasion}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">{itemIds.length} ชิ้น</p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Look detail */}
      <Dialog open={!!selectedOutfit} onOpenChange={(o) => !o && setSelectedOutfit(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedOutfit && (() => {
            const o = selectedOutfit;
            const look: any = o.analysis ?? {};
            const lucky: any = o.luckyColors ?? null;
            const itemIds: number[] = Array.isArray(o.itemIds) ? (o.itemIds as number[]) : [];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base">{o.title}</DialogTitle>
                  {o.occasion && (
                    <p className="text-xs text-muted-foreground">{o.occasion}</p>
                  )}
                </DialogHeader>

                {o.tryOnImageUrl && (
                  <img
                    src={o.tryOnImageUrl}
                    alt={o.title}
                    loading="lazy"
                    className="w-full rounded-lg border border-black/5"
                  />
                )}

                {look.stylistCommentary && (
                  <div className="rounded-xl bg-warm-50 border border-warm-200 px-4 py-3">
                    <p className="text-[11px] font-medium text-teal-700 mb-1.5 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> คำวิจารณ์โดยสไตลิสต์
                    </p>
                    <p className="text-sm text-foreground leading-7">{look.stylistCommentary}</p>
                  </div>
                )}

                <ColorSwatches palette={look.colorPalette || []} />

                {/* Garments used in this look — clickable to view */}
                {Array.isArray(look.usedItems) && look.usedItems.length > 0 && (
                  <div className="border-t border-dashed border-gray-200 pt-3">
                    <p className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                      <Shirt className="w-3.5 h-3.5" /> เสื้อผ้าในลุคนี้ ({look.usedItems.length})
                    </p>
                    <div className="space-y-2.5">
                      {look.usedItems.map((u: any) => {
                        const bd = Array.isArray(look.outfitBreakdown)
                          ? look.outfitBreakdown.find((b: any) => b.itemId === u.id)
                          : null;
                        const clickable = u.imageUrl && /^https?:\/\//i.test(u.imageUrl);
                        return (
                          <div key={u.id} className="flex items-start gap-3">
                            {clickable ? (
                              <button
                                type="button"
                                onClick={() => window.open(u.imageUrl, "_blank", "noopener")}
                                className="shrink-0"
                                aria-label={`ดูรูป ${u.name}`}
                              >
                                <img
                                  src={u.imageUrl}
                                  alt={u.name}
                                  loading="lazy"
                                  className="w-14 h-14 rounded-lg object-cover border border-black/5 hover:opacity-80 transition-opacity"
                                />
                              </button>
                            ) : (
                              <div className="w-14 h-14 rounded-lg bg-warm-100 flex items-center justify-center shrink-0">
                                <Shirt className="w-5 h-5 text-warm-200" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground">
                                {u.name}
                                {bd?.role ? <span className="text-muted-foreground"> · {bd.role}</span> : null}
                              </p>
                              {bd?.why && (
                                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                                  {bd.why}
                                </p>
                              )}
                              {u.owned === false && u.priceBaht != null && (
                                <p className="text-[11px] text-emerald-700 mt-0.5">
                                  ฿{Number(u.priceBaht).toLocaleString()} · ซื้อเพิ่ม
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {look.luckyColorNote && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2">
                    <Sparkles className="w-3 h-3 inline mr-1" />
                    {look.luckyColorNote}
                  </p>
                )}

                {Array.isArray(look.buyItems) && look.buyItems.length > 0 && (
                  <div className="border-t border-dashed border-gray-200 pt-3">
                    <p className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-2">
                      <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                      ช้อปเพิ่มให้ลุคนี้สมบูรณ์
                    </p>
                    <div className="space-y-2">
                      {look.buyItems.map((b: any) => (
                        <div
                          key={b.id}
                          className="flex items-center gap-3 bg-emerald-50/60 rounded-md px-2 py-2"
                        >
                          {b.imageUrl && /^https?:\/\//i.test(b.imageUrl) && (
                            <img
                              src={b.imageUrl}
                              alt={b.name}
                              loading="lazy"
                              className="w-12 h-12 rounded object-cover border border-black/5"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-800 truncate">{b.name}</p>
                            {b.color && <p className="text-[11px] text-gray-500">{b.color}</p>}
                          </div>
                          <div className="text-right">
                            {b.priceBaht != null && (
                              <p className="text-sm font-semibold text-emerald-700">
                                ฿{Number(b.priceBaht).toLocaleString()}
                              </p>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 mt-1 text-xs"
                              disabled={placeOrder.isPending}
                              onClick={() => placeOrder.mutate({ itemId: b.id, outfitId: o.id })}
                            >
                              {placeOrder.isPending ? "กำลังจอง..." : "สนใจซื้อ"}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="secondary" className="text-xs">
                    <Shirt className="w-3 h-3 mr-1" />
                    {itemIds.length} ชิ้น
                  </Badge>
                  {o.source === "cross_user" && (
                    <Badge className="text-xs bg-emerald-600 hover:bg-emerald-600">
                      <ShoppingBag className="w-3 h-3 mr-1" />
                      ข้ามตู้
                    </Badge>
                  )}
                  {lucky?.primary?.name && (
                    <Badge variant="outline" className="text-xs">
                      สีนำโชค: {lucky.primary.name}
                    </Badge>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600 mt-1"
                  disabled={deleteOutfit.isPending}
                  onClick={() => {
                    deleteOutfit.mutate({ id: o.id });
                    setSelectedOutfit(null);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  ลบลุคนี้
                </Button>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
