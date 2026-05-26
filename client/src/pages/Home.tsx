/**
 * Home Page – Multi-Item Scan Flow with SSE Streaming
 *
 * Screen 1: Upload images for multiple items (up to 5) → press "วิเคราะห์ราคา"
 * Screen 2: Show progressive results:
 *   - Phase 1 (2-3s): Vision AI detection + rule-based price → instant display
 *   - Phase 2 (8-12s): Multi-Agent consensus → refined price update with animation
 *
 * All backend APIs run automatically via SSE streaming endpoint.
 */
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Plus, Check, ChevronLeft, ChevronRight, Shirt, Loader2, Sparkles, RotateCcw, UserCircle } from "lucide-react";
import FashionTips from "@/components/FashionTips";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import GaugeMeter from "@/components/GaugeMeter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import {
  CATEGORIES,
  CATEGORY_GROUPS,
  BRANDS,
  SIZES,
  CONDITIONS,
} from "@/lib/pricing-engine";
import BrandCombobox from "@/components/BrandCombobox";
import {
  useEvaluateStream,
  type StreamItemResult,
} from "@/hooks/useEvaluateStream";

// ─── Types ───

interface ImageSlot {
  label: string;
  required: boolean;
  file: File | null;
  preview: string | null;
}

interface ScanItem {
  id: number;
  imageSlots: ImageSlot[];
}

interface ResultItem {
  id: number;
  // AI-detected (from Phase 1)
  category: string;
  brand: string;
  color: string;
  condition: string;
  defectLevel: string;
  confidence: number;
  material: string;
  // Editable
  editCategory: string;
  editBrand: string;
  editSize: string;
  height: string;
  weight: string;
  waist: string;
  hip: string;
  bust: string;
  shoulder: string;
  // Pricing
  recommendedPrice: number;
  fastSalePrice: number;
  highValuePrice: number;
  marketMin: number;
  marketMax: number;
  sellabilityScore: number;
  // Thai Market Factor
  thaiMarketInfo?: {
    internationalPrice: number;
    thaiPrice: number;
    thaiMarketTier: string;
    thaiMarketLabel: string;
    discountPercent: number;
    explanation: string;
  };
  // Phase 2 refinement
  isRefining: boolean;
  isRefined: boolean;
  consensusLevel?: string;
  consensusConfidence?: number;
  agentCount?: number;
  // Images
  imagePreview: string | null;
  imageFile: File | null;
  imageFile2: File | null;
  imageFile3: File | null;
  // Saved to wardrobe
  savedToWardrobe: boolean;
  // Selection for batch save
  selectedForWardrobe: boolean;
}

// ─── Helpers ───

const MAX_ITEMS = 5;

function createScanItem(id: number): ScanItem {
  return {
    id,
    imageSlots: [
      { label: "ด้านหน้า *", required: true, file: null, preview: null },
      { label: "ด้านหลัง *", required: true, file: null, preview: null },
      { label: "ตำหนิ", required: false, file: null, preview: null },
    ],
  };
}

function mapAICategory(aiCategory: string): string {
  const mapping: Record<string, string> = {
    tshirt: "t_shirt", t_shirt: "t_shirt", shirt: "shirt", blouse: "blouse",
    crop_top: "crop_top", camisole: "camisole", tank_top: "tank_top",
    jeans: "jeans", pants: "pants", shorts: "shorts", skirt: "skirt", leggings: "leggings",
    dress: "dress", jumpsuit: "jumpsuit", romper: "romper",
    blazer: "blazer", jacket: "jacket", cardigan: "cardigan", sweater: "sweater",
    hoodie: "hoodie", coat: "coat",
    bra: "bra", underwear: "underwear", shapewear: "shapewear", sleepwear: "sleepwear",
    sports_bra: "sports_bra", yoga_pants: "yoga_pants", running_set: "running_set",
    bikini: "bikini", one_piece_swim: "one_piece_swim", two_piece_swim: "two_piece_swim",
    beachwear: "beachwear", bag: "bag",
  };
  return mapping[aiCategory?.toLowerCase()] || "t_shirt";
}

function mapAICondition(aiCondition: string): string {
  const mapping: Record<string, string> = {
    new_with_tag: "new_with_tag", like_new: "like_new",
    good: "good", fair: "fair", poor: "defective",
  };
  return mapping[aiCondition?.toLowerCase()] || "good";
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getSellabilityInfo(score: number) {
  if (score >= 80) return { label: "ขายง่ายมาก", days: "3-7 วัน" };
  if (score >= 65) return { label: "ขายง่าย", days: "7-14 วัน" };
  if (score >= 50) return { label: "พอขายได้", days: "14-30 วัน" };
  return { label: "ขายยาก", days: "30+ วัน" };
}

function needsWaistHip(category: string) {
  return ["jeans", "pants", "shorts", "skirt", "leggings", "yoga_pants"].includes(category);
}

function needsBustShoulder(category: string) {
  return ["t_shirt", "shirt", "blouse", "crop_top", "camisole", "tank_top", "dress", "jumpsuit", "romper", "blazer", "jacket", "cardigan", "sweater", "hoodie", "coat", "bra", "sports_bra"].includes(category);
}

// ─── Main Component ───

export default function Home() {
  const { user } = useAuth();
  const [screen, setScreen] = useState<"upload" | "results">("upload");

  // Multi-item scan queue
  const [scanItems, setScanItems] = useState<ScanItem[]>([createScanItem(1)]);
  const [nextId, setNextId] = useState(2);

  // Results
  const [resultItems, setResultItems] = useState<ResultItem[]>([]);
  const [activeResultIndex, setActiveResultIndex] = useState(0);

  // SSE Streaming
  const stream = useEvaluateStream();

  // Rescan abort controller + snapshot for cancel
  const rescanAbortRef = useRef<AbortController | null>(null);
  const rescanSnapshotRef = useRef<{ index: number; item: ResultItem } | null>(null);

  // tRPC mutations (for saving only)
  const saveHistory = trpc.history.save.useMutation();
  const saveWardrobe = trpc.wardrobe.save.useMutation();

  // ─── Upload Screen Handlers ───

  const addScanItem = useCallback(() => {
    if (scanItems.length >= MAX_ITEMS) {
      toast.info(`สูงสุด ${MAX_ITEMS} ชุดต่อครั้ง`);
      return;
    }
    setScanItems((prev) => [...prev, createScanItem(nextId)]);
    setNextId((n) => n + 1);
  }, [scanItems.length, nextId]);

  const removeScanItem = useCallback((itemId: number) => {
    setScanItems((prev) => {
      if (prev.length <= 1) return prev;
      const item = prev.find((i) => i.id === itemId);
      if (item) {
        item.imageSlots.forEach((s) => {
          if (s.preview) URL.revokeObjectURL(s.preview);
        });
      }
      return prev.filter((i) => i.id !== itemId);
    });
  }, []);

  const handleImageUpdate = useCallback((itemId: number, slotIndex: number, file: File | null) => {
    setScanItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const newSlots = [...item.imageSlots];
        if (file) {
          newSlots[slotIndex] = {
            ...newSlots[slotIndex],
            file,
            preview: URL.createObjectURL(file),
          };
        } else {
          if (newSlots[slotIndex].preview) URL.revokeObjectURL(newSlots[slotIndex].preview!);
          newSlots[slotIndex] = { ...newSlots[slotIndex], file: null, preview: null };
        }
        return { ...item, imageSlots: newSlots };
      })
    );
  }, []);

  const hasAnyImages = useMemo(
    () => scanItems.some((item) => item.imageSlots.some((s) => s.file !== null)),
    [scanItems]
  );

  // ─── SSE Streaming Evaluate ───

  const handleEvaluate = useCallback(async () => {
    const itemsWithImages = scanItems.filter((item) =>
      item.imageSlots.some((s) => s.file !== null)
    );

    if (itemsWithImages.length === 0) {
      toast.error("กรุณาอัปโหลดรูปอย่างน้อย 1 รูป");
      return;
    }

    // Switch to results screen immediately
    setScreen("results");
    setActiveResultIndex(0);

    // Initialize result items as "pending"
    const initialResults: ResultItem[] = itemsWithImages.map((scanItem) => ({
      id: scanItem.id,
      category: "",
      brand: "",
      color: "",
      condition: "",
      defectLevel: "",
      confidence: 0,
      material: "",
      editCategory: "",
      editBrand: "",
      editSize: "M",
      height: "", weight: "", waist: "", hip: "", bust: "", shoulder: "",
      recommendedPrice: 0,
      fastSalePrice: 0,
      highValuePrice: 0,
      marketMin: 0,
      marketMax: 0,
      sellabilityScore: 0,
      isRefining: true,
      isRefined: false,
      imagePreview: scanItem.imageSlots[0]?.preview || null,
      imageFile: scanItem.imageSlots[0]?.file || null,
      imageFile2: scanItem.imageSlots[1]?.file || null,
      imageFile3: scanItem.imageSlots[2]?.file || null,
      savedToWardrobe: false,
      selectedForWardrobe: true,
    }));
    setResultItems(initialResults);

    // Prepare images for streaming
    const streamItems = await Promise.all(
      itemsWithImages.map(async (scanItem) => {
        const images = await Promise.all(
          scanItem.imageSlots
            .filter((s) => s.file !== null)
            .map(async (s) => ({
              base64: await fileToBase64(s.file!),
              mimeType: s.file!.type || "image/jpeg",
              label: s.label,
            }))
        );
        return { images };
      })
    );

    // Start SSE stream
    stream.startEvaluation(streamItems);
  }, [scanItems, stream]);

  // ─── Process SSE events into ResultItems ───

  useEffect(() => {
    if (!stream.items || stream.items.length === 0) return;

    setResultItems((prev) => {
      const updated = [...prev];

      for (const streamItem of stream.items) {
        const idx = streamItem.itemIndex;
        if (idx >= updated.length) continue;

        // Phase 1: Vision + Rule-based
        if (streamItem.phase === "phase1" && streamItem.detection && streamItem.ruleBasedPrice) {
          const d = streamItem.detection;
          const p = streamItem.ruleBasedPrice;
          const mappedCategory = mapAICategory(d.category);
          const mappedCondition = mapAICondition(d.condition);

          const brandLower = (d.brand || "").toLowerCase();
          const matchedBrand = BRANDS.find((b) => b.value.toLowerCase() === brandLower);
          const detectedBrand = matchedBrand
            ? matchedBrand.value
            : d.brand && d.brand !== "ไม่ระบุ" && d.brand.toLowerCase() !== "no brand"
            ? d.brand
            : "No Brand";

          updated[idx] = {
            ...updated[idx],
            category: mappedCategory,
            brand: detectedBrand,
            color: d.primaryColor || "",
            condition: mappedCondition,
            defectLevel: d.defectLevel || "none",
            confidence: d.confidence || 0,
            material: d.material || "",
            editCategory: mappedCategory,
            editBrand: detectedBrand,
            recommendedPrice: p.recommendedPrice,
            fastSalePrice: p.fastSalePrice,
            highValuePrice: p.highValuePrice,
            marketMin: p.marketMin,
            marketMax: p.marketMax,
            sellabilityScore: p.sellabilityScore,
            thaiMarketInfo: p.thaiMarketInfo || undefined,
            isRefining: true,
            isRefined: false,
          };
        }

        // Phase 2: Consensus refinement
        if (streamItem.phase === "phase2" && streamItem.refinedPrice) {
          const rp = streamItem.refinedPrice;
          const c = streamItem.consensus;

          updated[idx] = {
            ...updated[idx],
            recommendedPrice: rp.recommendedPrice,
            fastSalePrice: rp.fastSalePrice,
            highValuePrice: rp.highValuePrice,
            marketMin: rp.marketMin,
            marketMax: rp.marketMax,
            isRefining: false,
            isRefined: true,
            consensusLevel: c?.consensusLevel,
            consensusConfidence: c?.confidence,
            agentCount: c?.agentCount,
          };
        }

        // Error
        if (streamItem.phase === "error") {
          updated[idx] = {
            ...updated[idx],
            isRefining: false,
          };
        }
      }

      return updated;
    });
  }, [stream.items]);

  // Auto-save to history when Phase 2 completes
  useEffect(() => {
    if (!stream.allComplete) return;

    resultItems.forEach((item) => {
      if (item.recommendedPrice > 0) {
        try {
          saveHistory.mutate({
            category: item.editCategory,
            brand: item.editBrand,
            size: item.editSize,
            condition: item.condition,
            defectLevel: item.defectLevel !== "none" ? item.defectLevel : undefined,
            color: item.color || undefined,
            recommendedPrice: item.recommendedPrice,
            fastSalePrice: item.fastSalePrice,
            highValuePrice: item.highValuePrice,
            marketMin: item.marketMin,
            marketMax: item.marketMax,
            sellabilityScore: item.sellabilityScore,
            confidenceScore: item.confidence,
            consensusLevel: item.consensusLevel,
            agentCount: item.agentCount,
          });
        } catch {}
      }
    });
  }, [stream.allComplete]);

  // ─── Result Screen Handlers ───

  const updateResultField = useCallback((index: number, field: string, value: string) => {
    setResultItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }, []);

  const handleSaveToWardrobe = useCallback(async (index: number) => {
    const item = resultItems[index];
    if (!item || !user) {
      toast.error("กรุณาเข้าสู่ระบบเพื่อบันทึกเข้าตู้เสื้อผ้า");
      return;
    }

    try {
      let imageBase64: string | undefined;
      let imageMimeType: string | undefined;
      let imageBase64_2: string | undefined;
      let imageMimeType_2: string | undefined;
      let imageBase64_3: string | undefined;
      let imageMimeType_3: string | undefined;

      if (item.imageFile) {
        imageBase64 = await fileToBase64(item.imageFile);
        imageMimeType = item.imageFile.type || "image/jpeg";
      }
      if (item.imageFile2) {
        imageBase64_2 = await fileToBase64(item.imageFile2);
        imageMimeType_2 = item.imageFile2.type || "image/jpeg";
      }
      if (item.imageFile3) {
        imageBase64_3 = await fileToBase64(item.imageFile3);
        imageMimeType_3 = item.imageFile3.type || "image/jpeg";
      }

      await saveWardrobe.mutateAsync({
        category: item.editCategory,
        brand: item.editBrand,
        color: item.color || undefined,
        material: item.material || undefined,
        condition: item.condition,
        conditionScore: Math.round(item.confidence / 10),
        defects: [],
        size: item.editSize || undefined,
        height: item.height ? parseInt(item.height) : undefined,
        weight: item.weight ? parseInt(item.weight) : undefined,
        bust: item.bust ? parseInt(item.bust) : undefined,
        shoulder: item.shoulder ? parseInt(item.shoulder) : undefined,
        waist: item.waist ? parseInt(item.waist) : undefined,
        hip: item.hip ? parseInt(item.hip) : undefined,
        recommendedPrice: item.recommendedPrice,
        marketMin: item.marketMin,
        marketMax: item.marketMax,
        sellabilityScore: item.sellabilityScore,
        confidenceScore: item.confidence,
        imageBase64,
        imageMimeType,
        imageBase64_2,
        imageMimeType_2,
        imageBase64_3,
        imageMimeType_3,
      });

      setResultItems((prev) =>
        prev.map((r, i) => (i === index ? { ...r, savedToWardrobe: true } : r))
      );
      toast.success("บันทึกเข้าตู้เสื้อผ้าแล้ว!");
    } catch (e: any) {
      toast.error("บันทึกไม่สำเร็จ: " + (e.message || ""));
    }
  }, [resultItems, user, saveWardrobe]);

  const handleSaveAllToWardrobe = useCallback(async () => {
    for (let i = 0; i < resultItems.length; i++) {
      if (!resultItems[i].savedToWardrobe) {
        await handleSaveToWardrobe(i);
      }
    }
  }, [resultItems, handleSaveToWardrobe]);

  // Save only selected items to wardrobe
  const handleSaveSelectedToWardrobe = useCallback(async () => {
    const toSave = resultItems
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.selectedForWardrobe && !item.savedToWardrobe && item.recommendedPrice > 0);

    for (const { idx } of toSave) {
      await handleSaveToWardrobe(idx);
    }
  }, [resultItems, handleSaveToWardrobe]);

  // Cancel rescan: abort network + restore previous state
  const handleCancelRescan = useCallback(() => {
    if (rescanAbortRef.current) {
      rescanAbortRef.current.abort();
      rescanAbortRef.current = null;
    }
    // Restore snapshot if available
    if (rescanSnapshotRef.current) {
      const { index, item } = rescanSnapshotRef.current;
      setResultItems((prev) =>
        prev.map((r, i) => (i === index ? item : r))
      );
      rescanSnapshotRef.current = null;
    }
  }, []);

  // Rescan single item: re-evaluate using the same original images
  const handleRescanItem = useCallback(async (index: number) => {
    const item = resultItems[index];
    if (!item) return;

    // Abort any previous rescan
    if (rescanAbortRef.current) {
      rescanAbortRef.current.abort();
    }
    const controller = new AbortController();
    rescanAbortRef.current = controller;

    // Snapshot current state for cancel/restore
    rescanSnapshotRef.current = { index, item: { ...item } };

    // Keep images and imagePreview but reset analysis results and set to loading
    setResultItems((prev) =>
      prev.map((r, i) =>
        i === index
          ? {
              ...r,
              category: "",
              brand: "",
              color: "",
              condition: "",
              defectLevel: "",
              confidence: 0,
              material: "",
              editCategory: "",
              editBrand: "",
              editSize: "M",
              height: "", weight: "", waist: "", hip: "", bust: "", shoulder: "",
              recommendedPrice: 0,
              fastSalePrice: 0,
              highValuePrice: 0,
              marketMin: 0,
              marketMax: 0,
              sellabilityScore: 0,
              isRefining: true,
              isRefined: false,
              consensusLevel: undefined,
              consensusConfidence: undefined,
              agentCount: undefined,
              // Keep original images + imagePreview!
              savedToWardrobe: false,
            }
          : r
      )
    );

    // Re-evaluate using original images
    const files: File[] = [item.imageFile, item.imageFile2, item.imageFile3].filter(Boolean) as File[];
    if (files.length === 0) {
      toast.error("ไม่พบรูปเดิม กรุณาอัปโหลดใหม่");
      setResultItems((prev) =>
        prev.map((r, i) => (i === index ? { ...r, isRefining: false } : r))
      );
      return;
    }

    // Call SSE for single item re-evaluation
    const images = await Promise.all(
      files.map(async (f) => ({
        base64: await fileToBase64(f),
        mimeType: f.type || "image/jpeg",
        label: "rescan",
      }))
    );

    try {
      const response = await fetch("/api/evaluate-stream-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ images }] }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        let eventData = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            eventData = line.slice(6);

            if (eventType && eventData) {
              try {
                const data = JSON.parse(eventData);

                if (eventType === "phase1" && data.itemIndex === 0) {
                  const d = data.detection;
                  const p = data.ruleBasedPrice;
                  const mappedCategory = mapAICategory(d.category);
                  const mappedCondition = mapAICondition(d.condition);
                  const brandLower = (d.brand || "").toLowerCase();
                  const matchedBrand = BRANDS.find((b) => b.value.toLowerCase() === brandLower);
                  const detectedBrand = matchedBrand
                    ? matchedBrand.value
                    : d.brand && d.brand !== "ไม่ระบุ" ? d.brand : "No Brand";

                  setResultItems((prev) =>
                    prev.map((r, i) =>
                      i === index
                        ? {
                            ...r,
                            category: d.category,
                            brand: d.brand,
                            color: d.primaryColor || "",
                            condition: mappedCondition,
                            defectLevel: d.defectLevel || "none",
                            confidence: d.confidence || 0,
                            material: d.material || "",
                            editCategory: mappedCategory,
                            editBrand: detectedBrand,
                            recommendedPrice: p.recommendedPrice,
                            fastSalePrice: p.fastSalePrice,
                            highValuePrice: p.highValuePrice,
                            marketMin: p.marketMin,
                            marketMax: p.marketMax,
                            sellabilityScore: p.sellabilityScore,
                            thaiMarketInfo: p.thaiMarketInfo || undefined,
                            isRefining: true,
                          }
                        : r
                    )
                  );
                } else if (eventType === "phase2" && data.itemIndex === 0) {
                  const rp = data.refinedPrice;
                  const c = data.consensus;
                  setResultItems((prev) =>
                    prev.map((r, i) =>
                      i === index
                        ? {
                            ...r,
                            recommendedPrice: rp?.recommendedPrice || r.recommendedPrice,
                            fastSalePrice: rp?.fastSalePrice || r.fastSalePrice,
                            highValuePrice: rp?.highValuePrice || r.highValuePrice,
                            marketMin: rp?.marketMin || r.marketMin,
                            marketMax: rp?.marketMax || r.marketMax,
                            consensusLevel: c?.consensusLevel,
                            consensusConfidence: c?.confidence,
                            agentCount: c?.agentCount,
                            isRefining: false,
                            isRefined: true,
                          }
                        : r
                    )
                  );
                } else if (eventType === "done") {
                  setResultItems((prev) =>
                    prev.map((r, i) =>
                      i === index ? { ...r, isRefining: false } : r
                    )
                  );
                }
              } catch {}
            }
            eventType = "";
            eventData = "";
          } else if (line === "") {
            eventType = "";
            eventData = "";
          }
        }
      }
    } catch (error: any) {
      if (error.name === "AbortError") return; // Cancelled by user
      console.error("[Rescan Error]", error);
      toast.error("สแกนใหม่ไม่สำเร็จ");
      setResultItems((prev) =>
        prev.map((r, i) => (i === index ? { ...r, isRefining: false } : r))
      );
    }
  }, [resultItems]);


  // Reset all (go back to upload screen)
  const handleReset = useCallback(() => {
    stream.abort();
    if (rescanAbortRef.current) {
      rescanAbortRef.current.abort();
      rescanAbortRef.current = null;
    }
    scanItems.forEach((item) => {
      item.imageSlots.forEach((s) => {
        if (s.preview) URL.revokeObjectURL(s.preview);
      });
    });
    setScanItems([createScanItem(nextId)]);
    setNextId((n) => n + 1);
    setScreen("upload");
    setResultItems([]);
    setActiveResultIndex(0);
  }, [scanItems, nextId, stream]);


  // Active result
  const activeResult = resultItems[activeResultIndex] || null;

  // ─── Render ───

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav links: matching (lookbook) + wardrobe */}
      <div className="fixed top-4 right-4 z-40 flex gap-2">
        <Link href="/lookbook">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs bg-white/90 backdrop-blur-sm shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            แมตช์ชุด
          </Button>
        </Link>
        <Link href="/wardrobe">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs bg-white/90 backdrop-blur-sm shadow-sm">
            <Shirt className="w-3.5 h-3.5" />
            ตู้เสื้อผ้า
          </Button>
        </Link>
        <Link href="/profile">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs bg-white/90 backdrop-blur-sm shadow-sm">
            <UserCircle className="w-3.5 h-3.5" />
            โปรไฟล์
          </Button>
        </Link>
      </div>

      <AnimatePresence mode="wait">
        {screen === "upload" ? (
          <motion.div
            key="upload-screen"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-lg mx-auto">
              {/* Main Upload Card */}
              <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-lg relative">
                {/* Header */}
                <div className="text-center mb-6">
                  <p className="text-xs font-semibold tracking-[0.2em] uppercase text-warm-800/60 mb-2">
                    AI Pricing
                  </p>
                  <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                    สแกนเสื้อผ้าเพื่อขาย
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    อัพรูป 3 ด้าน: หน้า (จำเป็น) · หลัง · ตำหนิ แล้วกดประเมิน
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    สแกนได้สูงสุด {MAX_ITEMS} ชุดต่อครั้ง
                  </p>
                </div>

                {/* Scan Items */}
                <div className="space-y-4 mb-4">
                  {scanItems.map((scanItem, itemIdx) => (
                    <div key={scanItem.id} className="relative">
                      {/* Item header */}
                      {scanItems.length > 1 && (
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-warm-800/70">
                            ชุดที่ {itemIdx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeScanItem(scanItem.id)}
                            className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
                          >
                            <X className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                      )}

                      {/* Image slots */}
                      <div className="grid grid-cols-3 gap-3">
                        {scanItem.imageSlots.map((slot, slotIdx) => (
                          <UploadSlot
                            key={slotIdx}
                            slot={slot}
                            itemId={scanItem.id}
                            slotIndex={slotIdx}
                            onUpdate={handleImageUpdate}
                          />
                        ))}
                      </div>

                      {/* Separator between items */}
                      {itemIdx < scanItems.length - 1 && (
                        <div className="border-b border-dashed border-warm-200 mt-4" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Item Button */}
                {scanItems.length < MAX_ITEMS && (
                  <button
                    type="button"
                    onClick={addScanItem}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-warm-200 hover:border-warm-300 transition-colors flex items-center justify-center gap-2 mb-4"
                  >
                    <Plus className="w-4 h-4 text-warm-800/50" />
                    <span className="text-xs font-medium text-warm-800/70">
                      เพิ่มชุด ({scanItems.length}/{MAX_ITEMS})
                    </span>
                  </button>
                )}

                {/* AI Ready Badge */}
                <div className="flex items-center justify-center gap-1.5 mb-4">
                  <Check className="w-3.5 h-3.5 text-teal-600" />
                  <span className="text-xs text-muted-foreground">
                    AI วิเคราะห์จริงพร้อมใช้งาน
                  </span>
                </div>

                {/* Evaluate Button */}
                <Button
                  onClick={handleEvaluate}
                  disabled={!hasAnyImages || stream.isStreaming}
                  className="w-full h-12 rounded-full text-sm font-semibold shadow-md transition-all duration-200"
                  style={{
                    backgroundColor: hasAnyImages ? "#a08b7a" : "#d4c8be",
                    color: "white",
                  }}
                >
                  {`วิเคราะห์ราคา${scanItems.filter((i) => i.imageSlots.some((s) => s.file)).length > 1 ? ` (${scanItems.filter((i) => i.imageSlots.some((s) => s.file)).length} ชุด)` : ""}`}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="result-screen"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md mx-auto">
              {/* Item Navigation (if multiple results) */}
              {resultItems.length > 1 && (
                <div className="flex items-center justify-between mb-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveResultIndex((i) => Math.max(0, i - 1))}
                    disabled={activeResultIndex === 0}
                    className="h-8 px-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-1.5">
                    {resultItems.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveResultIndex(idx)}
                        className={`w-2.5 h-2.5 rounded-full transition-all ${
                          idx === activeResultIndex
                            ? "bg-[#a08b7a] scale-125"
                            : item.savedToWardrobe
                            ? "bg-teal-400"
                            : item.recommendedPrice > 0
                            ? "bg-warm-300"
                            : "bg-warm-200 animate-pulse"
                        }`}
                      />
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveResultIndex((i) => Math.min(resultItems.length - 1, i + 1))}
                    disabled={activeResultIndex === resultItems.length - 1}
                    className="h-8 px-2"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Result Card */}
              {activeResult && (
                <div className="bg-card rounded-3xl p-5 sm:p-6 border border-border shadow-lg relative space-y-4">
                  {/* Close button: if rescanning, cancel and stay; otherwise go back to upload */}
                  <button
                    type="button"
                    onClick={() => {
                      if (activeResult.isRefining && rescanSnapshotRef.current) {
                        // Cancel rescan and restore previous result
                        handleCancelRescan();
                      } else {
                        handleReset();
                      }
                    }}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-warm-100 flex items-center justify-center hover:bg-warm-200 transition-colors z-10"
                  >
                    <X className="w-4 h-4 text-warm-800" />
                  </button>

                  {/* Item counter */}
                  {resultItems.length > 1 && (
                    <div className="text-center">
                      <span className="text-xs font-medium text-muted-foreground">
                        ชุดที่ {activeResultIndex + 1} / {resultItems.length}
                      </span>
                    </div>
                  )}

                  {/* Loading State (waiting for Phase 1 - initial scan) */}
                  {activeResult.recommendedPrice === 0 && !activeResult.isRefining && !activeResult.imagePreview && (
                    <div className="py-8 flex flex-col items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-warm-100 flex items-center justify-center">
                        <Loader2 className="w-7 h-7 text-warm-400 animate-spin" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground">รอการวิเคราะห์...</p>
                      </div>
                    </div>
                  )}

                  {/* Loading spinner during rescan */}
                  {activeResult.recommendedPrice === 0 && activeResult.isRefining && (
                    <div className="py-8 flex flex-col items-center gap-4">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center"
                      >
                        <Loader2 className="w-7 h-7 text-teal-600" />
                      </motion.div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground">กำลังวิเคราะห์...</p>
                        <p className="text-xs text-muted-foreground mt-1">AI กำลังดูเสื้อผ้าของคุณ</p>
                      </div>
                      <FashionTips className="w-full max-w-xs" />
                    </div>
                  )}

                  {/* Phase 1 Result (instant) */}
                  {activeResult.recommendedPrice > 0 && (
                    <>
                      {/* Product Header */}
                      <div className="flex gap-3">
                        <div className="w-20 h-20 rounded-xl overflow-hidden border border-warm-200 flex-shrink-0">
                          {activeResult.imagePreview ? (
                            <img src={activeResult.imagePreview} alt="Product" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-warm-100" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-2 mb-1">
                            {activeResult.isRefined ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white bg-teal-600">
                                <Sparkles className="w-2.5 h-2.5" />
                                AI verified
                              </span>
                            ) : activeResult.isRefining ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200">
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                กำลัง refine
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: "#a08b7a" }}>
                                ประเมินแล้ว
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground">
                              ความมั่นใจ {activeResult.consensusConfidence || activeResult.confidence}%
                            </span>
                          </div>
                          <h2 className="text-base font-bold text-foreground leading-tight truncate">
                            {CATEGORIES.find((c) => c.value === activeResult.editCategory)?.label || activeResult.editCategory}
                          </h2>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {activeResult.color && `${activeResult.color} · `}{activeResult.editBrand}
                          </p>
                          <p className="text-xs text-foreground mt-0.5">
                            สภาพ: <span className="font-semibold">{CONDITIONS.find((c) => c.value === activeResult.condition)?.label || activeResult.condition}</span>
                          </p>
                        </div>
                      </div>

                      {/* Category Selector */}
                      <div className="bg-warm-50 rounded-xl p-3.5 border border-warm-200">
                        <label className="text-xs text-muted-foreground mb-1.5 block">
                          หมวดสินค้า (แก้ได้ถ้า AI อ่านผิด)
                        </label>
                        <Select
                          value={activeResult.editCategory}
                          onValueChange={(v) => updateResultField(activeResultIndex, "editCategory", v)}
                        >
                          <SelectTrigger className="h-10 bg-white border-warm-200 text-sm font-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {CATEGORY_GROUPS.map((group) => (
                              <div key={group.group}>
                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-warm-50 sticky top-0">
                                  {group.group}
                                </div>
                                {group.items.map((c) => (
                                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Brand */}
                      <div className="bg-warm-50 rounded-xl p-3.5 border border-warm-200">
                        <label className="text-xs text-muted-foreground mb-1.5 block">
                          แบรนด์ (แก้ได้ถ้า AI อ่านผิด)
                        </label>
                        <BrandCombobox
                          value={activeResult.editBrand}
                          onValueChange={(v) => updateResultField(activeResultIndex, "editBrand", v)}
                          placeholder="ค้นหาแบรนด์..."
                        />
                      </div>

                      {/* Size + Height + Weight */}
                      <div className="bg-warm-50 rounded-xl p-3.5 border border-warm-200">
                        <div className="grid grid-cols-3 gap-2.5">
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">ไซส์</label>
                            <Select
                              value={activeResult.editSize}
                              onValueChange={(v) => updateResultField(activeResultIndex, "editSize", v)}
                            >
                              <SelectTrigger className="h-9 bg-white border-warm-200 text-xs font-medium">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SIZES.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">ส่วนสูง (cm)</label>
                            <Input
                              type="number"
                              placeholder="165"
                              value={activeResult.height}
                              onChange={(e) => updateResultField(activeResultIndex, "height", e.target.value)}
                              className="h-9 bg-white border-warm-200 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">น้ำหนัก (kg)</label>
                            <Input
                              type="number"
                              placeholder="52"
                              value={activeResult.weight}
                              onChange={(e) => updateResultField(activeResultIndex, "weight", e.target.value)}
                              className="h-9 bg-white border-warm-200 text-xs"
                            />
                          </div>
                        </div>

                        {/* Conditional Measurements */}
                        {needsWaistHip(activeResult.editCategory) && (
                          <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                            <div>
                              <label className="text-[10px] text-muted-foreground mb-1 block">เอว (นิ้ว)</label>
                              <Input type="number" placeholder="26" value={activeResult.waist}
                                onChange={(e) => updateResultField(activeResultIndex, "waist", e.target.value)}
                                className="h-9 bg-white border-warm-200 text-xs" />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground mb-1 block">สะโพก (นิ้ว)</label>
                              <Input type="number" placeholder="36" value={activeResult.hip}
                                onChange={(e) => updateResultField(activeResultIndex, "hip", e.target.value)}
                                className="h-9 bg-white border-warm-200 text-xs" />
                            </div>
                          </div>
                        )}
                        {needsBustShoulder(activeResult.editCategory) && (
                          <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                            <div>
                              <label className="text-[10px] text-muted-foreground mb-1 block">อก (นิ้ว)</label>
                              <Input type="number" placeholder="34" value={activeResult.bust}
                                onChange={(e) => updateResultField(activeResultIndex, "bust", e.target.value)}
                                className="h-9 bg-white border-warm-200 text-xs" />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground mb-1 block">ไหล่ (นิ้ว)</label>
                              <Input type="number" placeholder="15" value={activeResult.shoulder}
                                onChange={(e) => updateResultField(activeResultIndex, "shoulder", e.target.value)}
                                className="h-9 bg-white border-warm-200 text-xs" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Price Recommendation (with animation on refine) */}
                      <motion.div
                        key={`price-${activeResultIndex}-${activeResult.isRefined}`}
                        initial={activeResult.isRefined ? { scale: 1.02, borderColor: "#0d9488" } : {}}
                        animate={{ scale: 1, borderColor: "transparent" }}
                        transition={{ duration: 0.5 }}
                        className={`rounded-xl p-4 text-center ${
                          activeResult.isRefined ? "bg-teal-50 border-2 border-teal-200" : "bg-[#f8ebe5]"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <p className="text-xs text-warm-800/70">ราคาที่แนะนำ</p>
                          {activeResult.isRefining && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              กำลังคิดราคาที่ดีที่สุด...
                            </span>
                          )}
                        </div>
                        <motion.p
                          key={`amount-${activeResult.recommendedPrice}`}
                          initial={{ opacity: 0.5, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                          className="text-3xl font-bold font-mono"
                          style={{ color: activeResult.isRefined ? "#0d9488" : "#a08b7a" }}
                        >
                          ฿{activeResult.recommendedPrice.toLocaleString()}
                        </motion.p>
                        <p className="text-xs text-muted-foreground mt-1">
                          ราคาขายที่เหมาะ ฿{activeResult.marketMin.toLocaleString()} – ฿{activeResult.marketMax.toLocaleString()}
                        </p>
                      </motion.div>

                      {/* Sellability Gauge */}
                      <div className="bg-warm-50 rounded-xl p-4 border border-warm-200">
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0">
                            <GaugeMeter score={activeResult.sellabilityScore} label="" size={100} />
                          </div>
                          <div>
                            <p className="text-base font-bold" style={{ color: "#a08b7a" }}>
                              {getSellabilityInfo(activeResult.sellabilityScore).label}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              คาดขายออกใน {getSellabilityInfo(activeResult.sellabilityScore).days}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <Button
                          variant="outline"
                          onClick={() => handleRescanItem(activeResultIndex)}
                          className="h-11 rounded-full text-sm font-semibold border-warm-200 gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          สแกนใหม่
                        </Button>
                        {activeResult.savedToWardrobe ? (
                          <Button
                            disabled
                            className="h-11 rounded-full text-sm font-semibold text-white bg-teal-600"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            บันทึกแล้ว
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleSaveToWardrobe(activeResultIndex)}
                            className="h-11 rounded-full text-sm font-semibold text-white"
                            style={{ backgroundColor: "#a08b7a" }}
                            disabled={saveWardrobe.isPending || activeResult.recommendedPrice === 0 || activeResult.isRefining}
                          >
                            {saveWardrobe.isPending ? "กำลังบันทึก..." : activeResult.isRefining ? "กำลังวิเคราะห์..." : "บันทึกเข้าตู้"}
                          </Button>
                        )}
                      </div>

                      {/* Selective Save to Wardrobe (if multiple items) */}
                      {resultItems.length > 1 && !resultItems.every((r) => r.savedToWardrobe) && (
                        <div className="mt-3 border border-warm-200 rounded-xl p-3 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-foreground">เลือกชุดที่จะบันทึกเข้าตู้</p>
                            <button
                              type="button"
                              onClick={() => {
                                const allSelected = resultItems.every((r) => r.savedToWardrobe || r.selectedForWardrobe);
                                setResultItems((prev) =>
                                  prev.map((r) => r.savedToWardrobe ? r : { ...r, selectedForWardrobe: !allSelected })
                                );
                              }}
                              className="text-[10px] font-medium text-teal-600 hover:text-teal-700 transition-colors"
                            >
                              {resultItems.every((r) => r.savedToWardrobe || r.selectedForWardrobe) ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            {resultItems.map((item, idx) => (
                              <label
                                key={idx}
                                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                                  item.savedToWardrobe
                                    ? "bg-teal-50/50 opacity-60"
                                    : item.selectedForWardrobe
                                    ? "bg-warm-50 hover:bg-warm-100"
                                    : "hover:bg-warm-50"
                                }`}
                              >
                                <Checkbox
                                  checked={item.savedToWardrobe || item.selectedForWardrobe}
                                  disabled={item.savedToWardrobe || item.recommendedPrice === 0}
                                  onCheckedChange={(checked) => {
                                    setResultItems((prev) =>
                                      prev.map((r, i) =>
                                        i === idx ? { ...r, selectedForWardrobe: !!checked } : r
                                      )
                                    );
                                  }}
                                />
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {item.imagePreview && (
                                    <div className="w-8 h-8 rounded-md overflow-hidden border border-warm-200 flex-shrink-0">
                                      <img src={item.imagePreview} alt="" className="w-full h-full object-cover" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-foreground truncate">
                                      ชุดที่ {idx + 1}: {item.editBrand || item.brand || "กำลังวิเคราะห์"}
                                    </p>
                                    {item.savedToWardrobe && (
                                      <p className="text-[10px] text-teal-600">บันทึกแล้ว</p>
                                    )}
                                  </div>
                                  {item.recommendedPrice > 0 && (
                                    <span className="text-xs font-semibold text-warm-800">
                                      ฿{item.recommendedPrice.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                          <Button
                            onClick={handleSaveSelectedToWardrobe}
                            disabled={saveWardrobe.isPending || !resultItems.some((r) => r.selectedForWardrobe && !r.savedToWardrobe && r.recommendedPrice > 0)}
                            className="w-full h-10 rounded-full text-xs font-medium text-white"
                            style={{ backgroundColor: "#a08b7a" }}
                          >
                            <Shirt className="w-3.5 h-3.5 mr-1.5" />
                            {saveWardrobe.isPending
                              ? "กำลังบันทึก..."
                              : `บันทึกที่เลือกเข้าตู้ (${resultItems.filter((r) => r.selectedForWardrobe && !r.savedToWardrobe && r.recommendedPrice > 0).length} ชุด)`
                            }
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Upload Slot Component ───

interface UploadSlotProps {
  slot: ImageSlot;
  itemId: number;
  slotIndex: number;
  onUpdate: (itemId: number, slotIndex: number, file: File | null) => void;
}

function UploadSlot({ slot, itemId, slotIndex, onUpdate }: UploadSlotProps) {
  const inputId = `upload-${itemId}-${slotIndex}`;

  const handleClick = () => {
    const input = document.getElementById(inputId) as HTMLInputElement;
    input?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    onUpdate(itemId, slotIndex, file);
    e.target.value = "";
  };

  return (
    <div className="relative">
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      {slot.preview ? (
        <div className="aspect-[3/4] rounded-2xl overflow-hidden border-2 border-warm-200 relative group">
          <img src={slot.preview} alt={slot.label} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onUpdate(itemId, slotIndex, null)}
            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3 text-red-500" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1.5">
            <p className="text-[10px] font-medium text-white">{slot.label}</p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="aspect-[3/4] w-full rounded-2xl border-2 border-dashed border-warm-200 bg-[#fdf5f0] hover:border-warm-300 transition-all flex flex-col items-center justify-center gap-2"
        >
          <Plus className="w-6 h-6 text-warm-800/50" />
          <span className="text-[11px] font-medium text-warm-800/70">{slot.label}</span>
        </button>
      )}
    </div>
  );
}


