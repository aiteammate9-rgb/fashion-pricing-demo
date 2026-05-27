/**
 * Shop Page — ช็อปเสื้อผ้า (เสื้อผ้าที่คนอื่นลงขาย)
 * กริด 2 คอลัมน์ ภาพใหญ่ ราคาชัด กด "สนใจซื้อ" → จองผ่าน orders.create
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, LogIn, ArrowLeft, Home as HomeIcon, Package, Check } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import Logo from "@/components/Logo";

export default function ShopPage() {
  const { user, loading: authLoading } = useAuth();
  const shop = trpc.wardrobe.shopList.useQuery({ limit: 40, offset: 0 }, { enabled: !!user });

  const placeOrder = trpc.orders.create.useMutation({
    onSuccess: () => {
      toast.success("จองแล้ว — ชิ้นนี้ถูกกันไว้ให้คุณ รอผู้ขายยืนยัน");
      shop.refetch();
    },
    onError: (e) => toast.error(`สั่งซื้อไม่สำเร็จ: ${e.message}`),
  });

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
          <h1 className="text-xl font-bold text-foreground">เข้าสู่ระบบเพื่อช็อปเสื้อผ้า</h1>
          <Button asChild className="bg-teal-600 hover:bg-teal-700">
            <a href={getLoginUrl()}><LogIn className="w-4 h-4 mr-1.5" />เข้าสู่ระบบ</a>
          </Button>
        </div>
      </div>
    );
  }

  const items = shop.data?.items ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-teal-600" />
            <h1 className="text-sm font-bold text-foreground">ช็อปเสื้อผ้า</h1>
          </div>
          <Logo size="sm" />
        </div>
      </header>

      <main className="px-4 py-5">
        {shop.isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] rounded-2xl bg-warm-100 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">ยังไม่มีสินค้าลงขาย</h2>
            <p className="text-sm text-muted-foreground mb-4">กลับมาใหม่เมื่อมีคนลงขายเพิ่ม</p>
            <Button asChild className="bg-teal-600 hover:bg-teal-700">
              <Link href="/">ไปลงขายของคุณ</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((it: any) => (
              <div key={it.id} className="bg-card rounded-2xl overflow-hidden border border-border">
                <div className="aspect-[4/5] bg-warm-100 relative">
                  {it.imageUrl ? (
                    <img src={it.imageUrl} alt={it.brand} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  {typeof it.sellabilityScore === "number" && it.sellabilityScore >= 80 && (
                    <Badge className="absolute top-2 left-2 text-[9px] px-1.5 py-0 bg-teal-600/90 text-white border-0">
                      ขายดี
                    </Badge>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-bold text-foreground truncate">{it.brand}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {it.category} · {it.size || "ไม่ระบุไซซ์"} · {it.condition}
                  </p>
                  <p className="text-lg font-bold text-coral-500 mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    ฿{(it.listedPrice ?? 0).toLocaleString()}
                  </p>
                  <Button
                    size="sm"
                    className="w-full mt-2 bg-teal-600 hover:bg-teal-700"
                    disabled={placeOrder.isPending}
                    onClick={() => placeOrder.mutate({ itemId: it.id })}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    สนใจซื้อ
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
