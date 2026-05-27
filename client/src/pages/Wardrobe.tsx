/**
 * Wardrobe Page – ตู้เสื้อผ้า
 * แสดงเสื้อผ้าทั้งหมดที่ user สแกนและบันทึกไว้
 * รองรับ filter ตามหมวดสินค้า + ลบรายการ
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shirt,
  Trash2,
  LogIn,
  Package,
  TrendingUp,
  Calendar,
  ArrowLeft,
  Filter,
  ScanLine,
  Tag,
  RotateCw,
  Check,
  Trash,
  Home,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Link } from "wouter";
import { CATEGORIES, CATEGORY_GROUPS } from "@/lib/pricing-engine";

export default function WardrobePage() {
  const { user, loading: authLoading } = useAuth();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  // List-for-sale dialog state
  const [listingItem, setListingItem] = useState<any | null>(null);
  const [listPrice, setListPrice] = useState<string>("");
  // Multi-select delete
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data, isLoading, refetch } = trpc.wardrobe.list.useQuery(
    { limit: 100, offset: 0, category: filterCategory === "all" ? undefined : filterCategory },
    { enabled: !!user }
  );

  const stats = trpc.wardrobe.stats.useQuery(undefined, { enabled: !!user });

  const deleteMutation = trpc.wardrobe.delete.useMutation({
    onSuccess: () => {
      toast.success("ลบเสื้อผ้าออกจากตู้แล้ว");
      refetch();
      stats.refetch();
      setDeletingId(null);
    },
    onError: (err) => {
      toast.error(`ลบไม่สำเร็จ: ${err.message}`);
      setDeletingId(null);
    },
  });

  const handleDelete = (id: number) => {
    setDeletingId(id);
    deleteMutation.mutate({ id });
  };

  const listMutation = trpc.wardrobe.markAsListed.useMutation({
    onSuccess: () => {
      toast.success("ลงขายแล้ว — ชิ้นนี้จะไปโผล่ในการจับคู่ข้ามตู้ของคนอื่น");
      setListingItem(null);
      setListPrice("");
      refetch();
    },
    onError: (err) => toast.error(`ลงขายไม่สำเร็จ: ${err.message}`),
  });

  const openListDialog = (item: any) => {
    setListingItem(item);
    setListPrice(String(item.listedPrice ?? item.recommendedPrice ?? ""));
  };

  const confirmList = () => {
    const price = Math.round(Number(listPrice));
    if (!listingItem || !Number.isFinite(price) || price <= 0) {
      toast.error("กรุณาใส่ราคาที่ถูกต้อง");
      return;
    }
    listMutation.mutate({ id: listingItem.id, listedPrice: price, salesChannel: "sheowa" });
  };

  // ── Seller side: incoming reservation orders ──
  const incoming = trpc.orders.incoming.useQuery(undefined, { enabled: !!user });
  const pendingOrders = (incoming.data ?? []).filter((o: any) => o.status === "pending");

  const sellerAction = trpc.orders.sellerAction.useMutation({
    onSuccess: (res) => {
      toast.success(res.status === "confirmed" ? "ยืนยันการขายแล้ว" : "ปฏิเสธออเดอร์แล้ว");
      incoming.refetch();
      refetch();
      stats.refetch();
    },
    onError: (err) => toast.error(`ทำรายการไม่สำเร็จ: ${err.message}`),
  });

  const deleteManyMutation = trpc.wardrobe.deleteMany.useMutation({
    onSuccess: (res) => {
      toast.success(`ลบแล้ว ${res.deleted} ชิ้น`);
      setSelectedIds(new Set());
      setSelectMode(false);
      refetch();
      stats.refetch();
    },
    onError: (err) => toast.error(`ลบไม่สำเร็จ: ${err.message}`),
  });

  const toggleSelect = (id: number) =>
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const selectAllItems = () =>
    setSelectedIds(new Set((data?.items ?? []).map((i: any) => i.id)));
  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  // Get category label helper
  const getCategoryLabel = (value: string) => {
    return CATEGORIES.find((c) => c.value === value)?.label || value;
  };

  // Auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-teal-300 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto">
            <LogIn className="w-8 h-8 text-teal-600" />
          </div>
          <h1 className="text-xl font-bold text-foreground">เข้าสู่ระบบเพื่อดูตู้เสื้อผ้า</h1>
          <p className="text-sm text-muted-foreground">
            เข้าสู่ระบบเพื่อบันทึกและจัดการเสื้อผ้าในตู้ของคุณ
          </p>
          <div className="flex gap-3 justify-center">
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                กลับหน้าหลัก
              </Link>
            </Button>
            <Button asChild className="bg-teal-600 hover:bg-teal-700">
              <a href={getLoginUrl()}>
                <LogIn className="w-4 h-4 mr-1.5" />
                เข้าสู่ระบบ
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ArrowLeft className="w-4 h-4" />
                กลับ
              </Button>
            </Link>
            <a href="https://sheowa.com" aria-label="หน้าร้าน">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Home className="w-4 h-4" />
              </Button>
            </a>
            <div className="flex items-center gap-2">
              <Shirt className="w-5 h-5 text-teal-600" />
              <h1 className="text-sm font-bold text-foreground">ตู้เสื้อผ้า</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stats.data && (
              <span className="text-xs text-muted-foreground">
                {stats.data.total} ชิ้น
              </span>
            )}
            <Link href="/">
              <Button size="sm" className="gap-1.5 text-xs bg-teal-600 hover:bg-teal-700">
                <ScanLine className="w-3.5 h-3.5" />
                สแกนเพิ่ม
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      {stats.data && stats.data.byCategory.length > 0 && (
        <div className="border-b border-border bg-warm-50/50">
          <div className="container py-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <button
                type="button"
                onClick={() => setFilterCategory("all")}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  filterCategory === "all"
                    ? "bg-teal-600 text-white"
                    : "bg-white border border-warm-200 text-warm-800 hover:border-teal-300"
                }`}
              >
                ทั้งหมด ({stats.data.total})
              </button>
              {stats.data.byCategory.map((cat: { category: string; count: number }) => (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() => setFilterCategory(cat.category)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    filterCategory === cat.category
                      ? "bg-teal-600 text-white"
                      : "bg-white border border-warm-200 text-warm-800 hover:border-teal-300"
                  }`}
                >
                  {getCategoryLabel(cat.category)} ({cat.count})
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="container py-6">
        {/* Incoming reservation orders (seller side) */}
        {pendingOrders.length > 0 && (
          <div className="mb-6 rounded-2xl border border-emerald-600/30 bg-emerald-50 p-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-3">
              <Tag className="w-4 h-4 text-emerald-700" />
              มีคนสนใจซื้อ ({pendingOrders.length})
            </h2>
            <div className="space-y-2">
              {pendingOrders.map((o: any) => (
                <div
                  key={o.id}
                  className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground">ออเดอร์ #{o.id}</p>
                    <p className="text-sm font-semibold text-emerald-700">
                      ฿{Number(o.priceBaht).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-teal-600 hover:bg-teal-700"
                    disabled={sellerAction.isPending}
                    onClick={() => sellerAction.mutate({ id: o.id, action: "confirm" })}
                  >
                    ยืนยันขาย
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={sellerAction.isPending}
                    onClick={() => sellerAction.mutate({ id: o.id, action: "cancel" })}
                  >
                    ปฏิเสธ
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-warm-100 animate-pulse" />
            ))}
          </div>
        ) : !data?.items?.length ? (
          <div className="text-center py-20">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">ตู้เสื้อผ้าว่างเปล่า</h2>
            <p className="text-sm text-muted-foreground mb-4">
              เริ่มสแกนเสื้อผ้าเพื่อเพิ่มเข้าตู้ของคุณ
            </p>
            <Button asChild className="bg-teal-600 hover:bg-teal-700">
              <Link href="/">
                <ScanLine className="w-4 h-4 mr-1.5" />
                ไปสแกนเสื้อผ้า
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Multi-select toolbar */}
            <div className="flex items-center justify-between gap-2 mb-4">
              {!selectMode ? (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSelectMode(true)}>
                  <Check className="w-4 h-4" /> เลือกหลายชิ้น
                </Button>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={selectAllItems}>
                    เลือกทั้งหมด
                  </Button>
                  <Button variant="ghost" size="sm" onClick={exitSelectMode}>
                    ยกเลิก
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-red-500 hover:bg-red-600 text-white"
                    disabled={selectedIds.size === 0 || deleteManyMutation.isPending}
                    onClick={() => deleteManyMutation.mutate({ ids: Array.from(selectedIds) })}
                  >
                    <Trash className="w-4 h-4" /> ลบที่เลือก ({selectedIds.size})
                  </Button>
                </div>
              )}
            </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <AnimatePresence>
              {data.items.map((item: any, idx: number) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-200 border-border group">
                    <CardContent className="p-0">
                      {/* Image */}
                      <div className="aspect-[3/4] relative bg-warm-100">
                        {selectMode && (
                          <button
                            type="button"
                            onClick={() => toggleSelect(item.id)}
                            className="absolute inset-0 z-30 bg-black/10 flex items-start justify-end p-2"
                            aria-label="เลือกชิ้นนี้"
                          >
                            <span
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                selectedIds.has(item.id)
                                  ? "bg-teal-600 border-teal-600"
                                  : "bg-white/85 border-white"
                              }`}
                            >
                              {selectedIds.has(item.id) && <Check className="w-4 h-4 text-white" />}
                            </span>
                          </button>
                        )}
                        {item.imageUrl ? (
                          <>
                            {/* Front image (default) */}
                            <img
                              src={item.imageUrl}
                              alt={item.brand}
                              className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${
                                item.imageUrl2 ? "group-hover:opacity-0" : ""
                              }`}
                            />
                            {/* Back image — fades in on hover */}
                            {item.imageUrl2 && (
                              <img
                                src={item.imageUrl2}
                                alt={`${item.brand} (หลัง)`}
                                loading="lazy"
                                className="w-full h-full object-cover absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                              />
                            )}
                            {item.imageUrl2 && (
                              <Badge className="absolute bottom-2 left-2 z-10 text-[9px] px-1.5 py-0 bg-black/55 text-white border-0">
                                <RotateCw className="w-2.5 h-2.5 mr-0.5" />
                                หน้า · หลัง
                              </Badge>
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Shirt className="w-10 h-10 text-warm-200" />
                          </div>
                        )}

                        {/* Overlay badges */}
                        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                          <Badge className="text-[9px] px-1.5 py-0 bg-white/90 text-foreground border-0 shadow-sm">
                            {getCategoryLabel(item.category)}
                          </Badge>
                          {item.sellabilityScore && item.sellabilityScore >= 70 && (
                            <Badge className="text-[9px] px-1.5 py-0 bg-teal-500/90 text-white border-0">
                              <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                              ขายง่าย
                            </Badge>
                          )}
                          {item.status === "listed" && (
                            <Badge className="text-[9px] px-1.5 py-0 bg-emerald-600/90 text-white border-0">
                              <Tag className="w-2.5 h-2.5 mr-0.5" />
                              กำลังขาย
                            </Badge>
                          )}
                          {item.status === "reserved" && (
                            <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/90 text-white border-0">
                              มีคนจอง
                            </Badge>
                          )}
                          {item.status === "sold" && (
                            <Badge className="text-[9px] px-1.5 py-0 bg-warm-800/90 text-white border-0">
                              ขายแล้ว
                            </Badge>
                          )}
                          {item.matchingStatus === "matched" && item.matchingGroup && (
                            <Badge className="text-[9px] px-1.5 py-0 bg-purple-600/90 text-white border-0">
                              แมตช์ {item.matchingGroup}
                            </Badge>
                          )}
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </button>

                        {/* Price tag */}
                        {item.recommendedPrice && (
                          <div className="absolute bottom-2 right-2 z-10 bg-white/95 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm">
                            <p className="text-xs font-bold font-mono" style={{ color: "#0C7355" }}>
                              ฿{item.recommendedPrice.toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-3 space-y-1">
                        <h3 className="text-xs font-bold text-foreground truncate">
                          {item.brand || "No Brand"}
                        </h3>
                        <div className="flex items-center gap-1.5">
                          {item.size && (
                            <span className="text-[10px] text-muted-foreground bg-warm-50 px-1.5 py-0.5 rounded">
                              {item.size}
                            </span>
                          )}
                          {item.color && (
                            <span className="text-[10px] text-muted-foreground truncate">
                              {item.color}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 pt-0.5">
                          <Calendar className="w-2.5 h-2.5 text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground">
                            {new Date(item.createdAt).toLocaleDateString("th-TH", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        </div>
                        {item.status === "sold" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled
                            className="w-full h-7 mt-1 text-[11px] gap-1"
                          >
                            <Tag className="w-3 h-3" />
                            ขายแล้ว ฿{(item.soldPrice ?? item.listedPrice ?? 0).toLocaleString()}
                          </Button>
                        ) : item.status === "reserved" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled
                            className="w-full h-7 mt-1 text-[11px] gap-1"
                          >
                            <Tag className="w-3 h-3" />
                            มีคนจอง ฿{(item.listedPrice ?? 0).toLocaleString()}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant={item.status === "listed" ? "secondary" : "outline"}
                            className="w-full h-7 mt-1 text-[11px] gap-1"
                            onClick={() => openListDialog(item)}
                          >
                            <Tag className="w-3 h-3" />
                            {item.status === "listed"
                              ? `กำลังขาย ฿${(item.listedPrice ?? 0).toLocaleString()}`
                              : "ลงขาย"}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          </>
        )}
      </main>

      {/* List-for-sale dialog */}
      <Dialog open={!!listingItem} onOpenChange={(o) => !o && setListingItem(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Tag className="w-4 h-4 text-emerald-600" />
              ลงขายเสื้อผ้า
            </DialogTitle>
          </DialogHeader>
          {listingItem && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {listingItem.brand || "No Brand"} · {getCategoryLabel(listingItem.category)}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="listPrice" className="text-xs">
                  ราคาขาย (บาท)
                </Label>
                <Input
                  id="listPrice"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={listPrice}
                  onChange={(e) => setListPrice(e.target.value)}
                  placeholder="เช่น 350"
                />
                {listingItem.recommendedPrice && (
                  <p className="text-[11px] text-muted-foreground">
                    AI แนะนำ: ฿{listingItem.recommendedPrice.toLocaleString()}
                  </p>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                เมื่อลงขาย ชิ้นนี้จะปรากฏให้ผู้ใช้คนอื่นเห็นใน "จับคู่ข้ามตู้" และซื้อได้
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setListingItem(null)}>
              ยกเลิก
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              disabled={listMutation.isPending}
              onClick={confirmList}
            >
              {listMutation.isPending ? "กำลังลงขาย..." : "ยืนยันลงขาย"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
