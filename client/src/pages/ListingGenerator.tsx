/**
 * Listing Generator Page
 * สร้าง listing สำหรับ eBay/Amazon จากข้อมูลสินค้าที่ประเมินแล้ว
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Copy,
  Check,
  Loader2,
  ShoppingBag,
  Store,
  Tag,
  DollarSign,
  Package,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Link, useSearch } from "wouter";

interface ListingInput {
  category: string;
  brand: string;
  size: string;
  condition: string;
  color?: string;
  style?: string;
  material?: string;
  defectDescription?: string;
  recommendedPriceUSD: number;
  originalPriceTHB?: number;
}

export default function ListingGenerator() {
  const searchParams = new URLSearchParams(useSearch());
  
  // Parse input from URL params
  const [input, setInput] = useState<ListingInput>({
    category: searchParams.get("category") || "",
    brand: searchParams.get("brand") || "",
    size: searchParams.get("size") || "",
    condition: searchParams.get("condition") || "",
    color: searchParams.get("color") || undefined,
    style: searchParams.get("style") || undefined,
    material: searchParams.get("material") || undefined,
    defectDescription: searchParams.get("defects") || undefined,
    recommendedPriceUSD: Number(searchParams.get("priceUSD")) || 25,
    originalPriceTHB: searchParams.get("originalPrice") ? Number(searchParams.get("originalPrice")) : undefined,
  });

  const [activeTab, setActiveTab] = useState<"ebay" | "amazon">("ebay");
  const [copied, setCopied] = useState<string | null>(null);

  const ebayMutation = trpc.listing.generateEbay.useMutation();
  const amazonMutation = trpc.listing.generateAmazon.useMutation();

  // Auto-generate on mount if we have data
  useEffect(() => {
    if (input.brand && input.category) {
      handleGenerate("ebay");
      handleGenerate("amazon");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = (platform: "ebay" | "amazon") => {
    if (platform === "ebay") {
      ebayMutation.mutate(input);
    } else {
      amazonMutation.mutate(input);
    }
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      toast.success("คัดลอกแล้ว");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("คัดลอกไม่สำเร็จ");
    }
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2 text-[10px]"
      onClick={() => handleCopy(text, field)}
    >
      {copied === field ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
    </Button>
  );

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
              <Store className="w-5 h-5 text-blue-600" />
              <h1 className="text-sm font-bold text-foreground">สร้าง Listing</h1>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {input.brand} • ${input.recommendedPriceUSD}
          </Badge>
        </div>
      </header>

      <main className="container py-6 max-w-4xl">
        {/* Product Summary */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-200 mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-blue-800">{input.brand} {input.category}</p>
              <p className="text-xs text-blue-600">
                Size {input.size} • {input.condition} • {input.color || ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-blue-500">ราคาแนะนำ</p>
              <p className="text-lg font-bold text-blue-800" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                ${input.recommendedPriceUSD}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Platform Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "ebay" | "amazon")}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="ebay" className="gap-1.5">
              <ShoppingBag className="w-4 h-4" />
              eBay
            </TabsTrigger>
            <TabsTrigger value="amazon" className="gap-1.5">
              <Store className="w-4 h-4" />
              Amazon
            </TabsTrigger>
          </TabsList>

          {/* eBay Tab */}
          <TabsContent value="ebay">
            {ebayMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                <p className="text-sm text-muted-foreground">กำลังสร้าง eBay listing...</p>
              </div>
            ) : ebayMutation.data?.listing ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                {/* Title */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Title</CardTitle>
                      <CopyButton text={ebayMutation.data.listing.title} field="ebay-title" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-medium text-foreground">{ebayMutation.data.listing.title}</p>
                    {ebayMutation.data.listing.subtitle && (
                      <p className="text-xs text-muted-foreground mt-1">{ebayMutation.data.listing.subtitle}</p>
                    )}
                  </CardContent>
                </Card>

                {/* Description */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Description</CardTitle>
                      <CopyButton text={ebayMutation.data.listing.description} field="ebay-desc" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={ebayMutation.data.listing.description}
                      readOnly
                      className="min-h-[120px] text-xs resize-none"
                    />
                  </CardContent>
                </Card>

                {/* Item Specifics */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Item Specifics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(ebayMutation.data.listing.itemSpecifics || {}).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground capitalize">{key}:</span>
                          <span className="font-medium">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Pricing */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4" />
                      Pricing Strategy
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-green-50 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-green-600">Buy It Now</p>
                        <p className="text-lg font-bold text-green-700" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          ${ebayMutation.data.listing.suggestedPrice?.buyItNow}
                        </p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-amber-600">Auction Start</p>
                        <p className="text-lg font-bold text-amber-700" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          ${ebayMutation.data.listing.suggestedPrice?.auctionStart}
                        </p>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-blue-600">Best Offer</p>
                        <p className="text-sm font-bold text-blue-700">
                          {ebayMutation.data.listing.suggestedPrice?.bestOffer ? "✓ เปิด" : "✗ ปิด"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tags */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-1.5">
                        <Tag className="w-4 h-4" />
                        Tags
                      </CardTitle>
                      <CopyButton
                        text={(ebayMutation.data.listing.tags || []).join(", ")}
                        field="ebay-tags"
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {(ebayMutation.data.listing.tags || []).map((tag: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Copy All */}
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    const listing = ebayMutation.data!.listing;
                    const fullText = `Title: ${listing.title}\n\nDescription:\n${listing.description}\n\nCondition: ${listing.conditionDescription}\n\nPrice: $${listing.suggestedPrice?.buyItNow}\n\nTags: ${(listing.tags || []).join(", ")}`;
                    handleCopy(fullText, "ebay-all");
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  คัดลอกทั้งหมด
                </Button>
              </motion.div>
            ) : (
              <div className="text-center py-12">
                <Sparkles className="w-10 h-10 text-blue-400 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">กดปุ่มเพื่อสร้าง eBay listing</p>
                <Button
                  onClick={() => handleGenerate("ebay")}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  สร้าง eBay Listing
                </Button>
                {ebayMutation.error && (
                  <p className="text-xs text-red-500 mt-3">{ebayMutation.error.message}</p>
                )}
              </div>
            )}
          </TabsContent>

          {/* Amazon Tab */}
          <TabsContent value="amazon">
            {amazonMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-orange-600 animate-spin mb-3" />
                <p className="text-sm text-muted-foreground">กำลังสร้าง Amazon listing...</p>
              </div>
            ) : amazonMutation.data?.listing ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                {/* Title */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Product Title</CardTitle>
                      <CopyButton text={amazonMutation.data.listing.title} field="amazon-title" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-medium text-foreground">{amazonMutation.data.listing.title}</p>
                  </CardContent>
                </Card>

                {/* Bullet Points */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Bullet Points</CardTitle>
                      <CopyButton
                        text={(amazonMutation.data.listing.bulletPoints || []).join("\n")}
                        field="amazon-bullets"
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {(amazonMutation.data.listing.bulletPoints || []).map((bp: string, i: number) => (
                        <li key={i} className="text-xs text-foreground flex items-start gap-2">
                          <span className="text-orange-500 font-bold mt-0.5">•</span>
                          {bp}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Description */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Description</CardTitle>
                      <CopyButton text={amazonMutation.data.listing.description} field="amazon-desc" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={amazonMutation.data.listing.description}
                      readOnly
                      className="min-h-[120px] text-xs resize-none"
                    />
                  </CardContent>
                </Card>

                {/* Condition & Category */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-[10px] text-muted-foreground">Condition Grade</p>
                      <p className="text-sm font-bold text-foreground">{amazonMutation.data.listing.conditionGrade}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{amazonMutation.data.listing.conditionNote}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-[10px] text-muted-foreground">Suggested Price</p>
                      <p className="text-lg font-bold text-orange-700" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        ${amazonMutation.data.listing.suggestedPrice}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">{amazonMutation.data.listing.category}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Backend Keywords */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Backend Keywords</CardTitle>
                      <CopyButton
                        text={(amazonMutation.data.listing.backendKeywords || []).join(", ")}
                        field="amazon-keywords"
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {(amazonMutation.data.listing.backendKeywords || []).map((kw: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px]">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Copy All */}
                <Button
                  className="w-full bg-orange-600 hover:bg-orange-700"
                  onClick={() => {
                    const listing = amazonMutation.data!.listing;
                    const fullText = `Title: ${listing.title}\n\nBullet Points:\n${(listing.bulletPoints || []).map((b: string) => `• ${b}`).join("\n")}\n\nDescription:\n${listing.description}\n\nCondition: ${listing.conditionGrade} - ${listing.conditionNote}\n\nPrice: $${listing.suggestedPrice}\n\nKeywords: ${(listing.backendKeywords || []).join(", ")}`;
                    handleCopy(fullText, "amazon-all");
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  คัดลอกทั้งหมด
                </Button>
              </motion.div>
            ) : (
              <div className="text-center py-12">
                <Sparkles className="w-10 h-10 text-orange-400 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">กดปุ่มเพื่อสร้าง Amazon listing</p>
                <Button
                  onClick={() => handleGenerate("amazon")}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  สร้าง Amazon Listing
                </Button>
                {amazonMutation.error && (
                  <p className="text-xs text-red-500 mt-3">{amazonMutation.error.message}</p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Regenerate */}
        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            onClick={() => handleGenerate(activeTab)}
            disabled={activeTab === "ebay" ? ebayMutation.isPending : amazonMutation.isPending}
            className="flex-1"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            สร้างใหม่ ({activeTab === "ebay" ? "eBay" : "Amazon"})
          </Button>
        </div>
      </main>
    </div>
  );
}
