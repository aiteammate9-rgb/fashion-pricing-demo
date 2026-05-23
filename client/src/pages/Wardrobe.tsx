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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Link } from "wouter";
import { CATEGORIES, CATEGORY_GROUPS } from "@/lib/pricing-engine";

export default function WardrobePage() {
  const { user, loading: authLoading } = useAuth();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

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
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.brand}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Shirt className="w-10 h-10 text-warm-200" />
                          </div>
                        )}

                        {/* Overlay badges */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          <Badge className="text-[9px] px-1.5 py-0 bg-white/90 text-foreground border-0 shadow-sm">
                            {getCategoryLabel(item.category)}
                          </Badge>
                          {item.sellabilityScore && item.sellabilityScore >= 70 && (
                            <Badge className="text-[9px] px-1.5 py-0 bg-teal-500/90 text-white border-0">
                              <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                              ขายง่าย
                            </Badge>
                          )}
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </button>

                        {/* Price tag */}
                        {item.recommendedPrice && (
                          <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm">
                            <p className="text-xs font-bold font-mono" style={{ color: "#a08b7a" }}>
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
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
