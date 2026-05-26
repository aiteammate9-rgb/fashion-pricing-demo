/**
 * History Page – ประวัติการประเมินราคา
 * แสดงรายการประเมินทั้งหมดของ user ในรูปแบบ card grid
 * กดเข้าไปดูรายละเอียด + สร้าง listing ได้
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  History as HistoryIcon,
  Trash2,
  ExternalLink,
  LogIn,
  Package,
  TrendingUp,
  Calendar,
  ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Link } from "wouter";

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data, isLoading, refetch } = trpc.history.list.useQuery(
    { limit: 50, offset: 0 },
    { enabled: !!user }
  );

  const deleteMutation = trpc.history.delete.useMutation({
    onSuccess: () => {
      toast.success("ลบประวัติเรียบร้อย");
      refetch();
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
          <h1 className="text-xl font-bold text-foreground">เข้าสู่ระบบเพื่อดูประวัติ</h1>
          <p className="text-sm text-muted-foreground">
            ระบบจะบันทึกประวัติการประเมินราคาให้อัตโนมัติเมื่อคุณเข้าสู่ระบบ
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
              <HistoryIcon className="w-5 h-5 text-teal-600" />
              <h1 className="text-sm font-bold text-foreground">ประวัติการประเมิน</h1>
            </div>
          </div>
          {data && (
            <span className="text-xs text-muted-foreground">
              {data.total} รายการ
            </span>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="container py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 rounded-2xl bg-warm-100 animate-pulse" />
            ))}
          </div>
        ) : !data?.items?.length ? (
          <div className="text-center py-20">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">ยังไม่มีประวัติ</h2>
            <p className="text-sm text-muted-foreground mb-4">
              เริ่มประเมินราคาสินค้าเพื่อบันทึกประวัติ
            </p>
            <Button asChild className="bg-teal-600 hover:bg-teal-700">
              <Link href="/">ไปประเมินราคา</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {data.items.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-200 border-border">
                    <CardContent className="p-4 space-y-3">
                      {/* Top row: image + info */}
                      <div className="flex gap-3">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.brand}
                            className="w-16 h-16 rounded-xl object-cover bg-warm-100"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-warm-100 flex items-center justify-center">
                            <Package className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-foreground truncate">
                            {item.brand}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {item.category} • {item.size} • {item.condition}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {item.color || "ไม่ระบุสี"}
                            </Badge>
                            {item.consensusLevel && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-200 text-purple-600">
                                ตรวจ {item.agentCount} รอบ
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Price info */}
                      <div className="flex items-center justify-between bg-warm-50 rounded-xl px-3 py-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground">ราคาแนะนำ</p>
                          <p className="text-lg font-bold text-teal-700" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            ฿{item.recommendedPrice.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground">ช่วงราคา</p>
                          <p className="text-xs font-medium text-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            ฿{item.marketMin.toLocaleString()} - ฿{item.marketMax.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Scores */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-teal-600" />
                          <span className="text-[10px] text-muted-foreground">
                            ขายออก {item.sellabilityScore}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(item.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                        {item.intlPriceUSD && (
                          <span className="text-[10px] text-emerald-600 font-medium ml-auto">
                            ${item.intlPriceUSD} USD
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1 border-t border-border">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          {deletingId === item.id ? "กำลังลบ..." : "ลบ"}
                        </Button>
                        {item.listingData && (
                          <Badge variant="outline" className="text-[10px] ml-auto border-blue-200 text-blue-600">
                            <ExternalLink className="w-2.5 h-2.5 mr-0.5" />
                            มี Listing
                          </Badge>
                        )}
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
