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
import { Sparkles, Wand2, LogIn, ArrowLeft, Trash2, Shirt, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Link } from "wouter";

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

  const deleteOutfit = trpc.outfits.delete.useMutation({
    onSuccess: () => {
      toast.success("ลบลุคแล้ว");
      outfits.refetch();
    },
    onError: e => toast.error(`ลบไม่สำเร็จ: ${e.message}`),
  });

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
    <div className="min-h-screen bg-[#f7f4ef] px-4 py-8">
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
                onClick={() =>
                  generate.mutate({
                    maxLooks,
                    occasion: occasion.trim() || undefined,
                  })
                }
              >
                <Wand2 className="w-4 h-4 mr-2" />
                {generate.isPending ? "กำลังจัดลุค..." : "ให้ AI จัดลุค"}
              </Button>
              <Button
                variant="outline"
                disabled={crossMatch.isPending}
                onClick={() =>
                  crossMatch.mutate({
                    maxLooks,
                    occasion: occasion.trim() || undefined,
                  })
                }
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                {crossMatch.isPending ? "กำลังจับคู่ข้ามตู้..." : "จับคู่ข้ามตู้ (ช้อปเพิ่ม)"}
              </Button>
            </div>
            <p className="text-xs text-gray-400">
              ต้องมีเสื้อผ้าอย่างน้อย 2 ชิ้นในตู้ + ตั้งค่า OPENAI_API_KEY (จัดลุค) และ GOOGLE_AI_API_KEY (รูป try-on)
            </p>
            <p className="text-xs text-gray-400">
              "จับคู่ข้ามตู้" จะนำเสื้อผ้าที่คนอื่นลงขายมาแมตช์กับตู้ของคุณ พร้อมปุ่มช้อปชิ้นที่ต้องซื้อเพิ่ม
            </p>
          </CardContent>
        </Card>

        {/* Saved looks */}
        <h2 className="text-sm font-medium text-gray-700 mb-3">ลุคที่บันทึกไว้</h2>
        {outfits.isLoading ? (
          <p className="text-sm text-gray-400">กำลังโหลด...</p>
        ) : !outfits.data || outfits.data.length === 0 ? (
          <p className="text-sm text-gray-400">ยังไม่มีลุค — กด "ให้ AI จัดลุค" ด้านบน</p>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {outfits.data.map(o => {
                const look: any = o.analysis ?? {};
                const lucky: any = o.luckyColors ?? null;
                const itemIds: number[] = Array.isArray(o.itemIds) ? (o.itemIds as number[]) : [];
                return (
                  <motion.div
                    key={o.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <Card>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-gray-800">{o.title}</p>
                            {o.occasion && (
                              <p className="text-xs text-gray-500">{o.occasion}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={deleteOutfit.isPending}
                            onClick={() => deleteOutfit.mutate({ id: o.id })}
                          >
                            <Trash2 className="w-4 h-4 text-gray-400" />
                          </Button>
                        </div>

                        {o.tryOnImageUrl && (
                          <img
                            src={o.tryOnImageUrl}
                            alt={o.title}
                            loading="lazy"
                            className="w-full rounded-lg mt-3 border border-black/5"
                          />
                        )}

                        {look.stylistCommentary && (
                          <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                            {look.stylistCommentary}
                          </p>
                        )}

                        <ColorSwatches palette={look.colorPalette || []} />

                        {look.luckyColorNote && (
                          <p className="text-xs text-amber-700 mt-3 bg-amber-50 rounded-md px-3 py-2">
                            <Sparkles className="w-3 h-3 inline mr-1" />
                            {look.luckyColorNote}
                          </p>
                        )}

                        {Array.isArray(look.buyItems) && look.buyItems.length > 0 && (
                          <div className="mt-3 border-t border-dashed border-gray-200 pt-3">
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
                                    {b.color && (
                                      <p className="text-[11px] text-gray-500">{b.color}</p>
                                    )}
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
                                      onClick={() =>
                                        toast.info("สนใจซื้อชิ้นนี้ — ระบบติดต่อผู้ขายกำลังจะมา")
                                      }
                                    >
                                      สนใจซื้อ
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 mt-3">
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
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
