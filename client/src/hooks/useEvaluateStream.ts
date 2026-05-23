/**
 * useEvaluateStream – SSE-based evaluation hook
 * 
 * Connects to /api/evaluate-stream-batch endpoint and receives
 * progressive results via Server-Sent Events:
 * - phase1: Vision AI + Rule-based price (2-3s)
 * - market: Market data enrichment
 * - phase2: Multi-Agent consensus refined price (8-12s)
 * - done: All processing complete
 */
import { useState, useCallback, useRef } from "react";

export interface StreamDetection {
  category: string;
  brand: string;
  primaryColor: string;
  secondaryColor: string;
  condition: string;
  defects: string[];
  defectLevel: string;
  material: string;
  style: string;
  pattern: string;
  confidence: number;
}

export interface StreamThaiMarketInfo {
  internationalPrice: number;
  thaiPrice: number;
  thaiMarketTier: string;
  thaiMarketLabel: string;
  discountPercent: number;
  explanation: string;
}

export interface StreamRuleBasedPrice {
  recommendedPrice: number;
  fastSalePrice: number;
  highValuePrice: number;
  marketMin: number;
  marketMax: number;
  sellabilityScore: number;
  thaiMarketInfo?: StreamThaiMarketInfo;
}

export interface StreamConsensus {
  confidence: number;
  consensusLevel: string;
  estimatedResaleThaiPrice: number;
  estimatedResaleIntlPriceUSD: number;
  agentCount: number;
  debateLog?: string;
  agentResults?: Array<{
    agent: string;
    category: string;
    brand: string;
    condition: string;
    estimatedResalePrice: number;
    estimatedResalePriceUSD: number;
    confidence: number;
    reasoning: string;
  }>;
}

export interface StreamRefinedPrice {
  recommendedPrice: number;
  fastSalePrice: number;
  highValuePrice: number;
  marketMin: number;
  marketMax: number;
}

export interface StreamItemResult {
  itemIndex: number;
  phase: "pending" | "phase1" | "phase2" | "done" | "error";
  detection?: StreamDetection;
  ruleBasedPrice?: StreamRuleBasedPrice;
  marketData?: any;
  consensus?: StreamConsensus;
  refinedPrice?: StreamRefinedPrice;
  error?: string;
}

interface StreamState {
  isStreaming: boolean;
  phase1Complete: boolean;
  allComplete: boolean;
  items: StreamItemResult[];
  totalItems: number;
}

export function useEvaluateStream() {
  const [state, setState] = useState<StreamState>({
    isStreaming: false,
    phase1Complete: false,
    allComplete: false,
    items: [],
    totalItems: 0,
  });

  const abortRef = useRef<AbortController | null>(null);

  const startEvaluation = useCallback(async (
    items: Array<{
      images: Array<{ base64: string; mimeType: string; label: string }>;
    }>
  ) => {
    // Abort any previous stream
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // Initialize state
    const initialItems: StreamItemResult[] = items.map((_, i) => ({
      itemIndex: i,
      phase: "pending" as const,
    }));

    setState({
      isStreaming: true,
      phase1Complete: false,
      allComplete: false,
      items: initialItems,
      totalItems: items.length,
    });

    try {
      const response = await fetch("/api/evaluate-stream-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

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
                handleEvent(eventType, data);
              } catch {
                // Invalid JSON, skip
              }
            }
            eventType = "";
            eventData = "";
          } else if (line === "") {
            // Empty line = end of event
            eventType = "";
            eventData = "";
          }
        }
      }

      // Stream ended
      setState((prev) => ({ ...prev, isStreaming: false, allComplete: true }));
    } catch (error: any) {
      if (error.name === "AbortError") return;
      console.error("[Stream Error]", error);
      setState((prev) => ({ ...prev, isStreaming: false }));
    }
  }, []);

  const handleEvent = useCallback((event: string, data: any) => {
    switch (event) {
      case "start":
        setState((prev) => ({ ...prev, totalItems: data.totalItems }));
        break;

      case "phase1":
        setState((prev) => ({
          ...prev,
          items: prev.items.map((item) =>
            item.itemIndex === data.itemIndex
              ? {
                  ...item,
                  phase: "phase1" as const,
                  detection: data.detection,
                  ruleBasedPrice: data.ruleBasedPrice,
                }
              : item
          ),
        }));
        break;

      case "phase1_complete":
        setState((prev) => ({ ...prev, phase1Complete: true }));
        break;

      case "market":
        setState((prev) => ({
          ...prev,
          items: prev.items.map((item) =>
            item.itemIndex === data.itemIndex
              ? { ...item, marketData: data.marketData }
              : item
          ),
        }));
        break;

      case "phase2":
        setState((prev) => ({
          ...prev,
          items: prev.items.map((item) =>
            item.itemIndex === data.itemIndex
              ? {
                  ...item,
                  phase: "phase2" as const,
                  consensus: data.consensus,
                  refinedPrice: data.refinedPrice,
                }
              : item
          ),
        }));
        break;

      case "error":
        setState((prev) => ({
          ...prev,
          items: prev.items.map((item) =>
            item.itemIndex === data.itemIndex
              ? { ...item, phase: "error" as const, error: data.message }
              : item
          ),
        }));
        break;

      case "done":
        setState((prev) => ({ ...prev, allComplete: true, isStreaming: false }));
        break;
    }
  }, []);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  return {
    ...state,
    startEvaluation,
    abort,
  };
}
