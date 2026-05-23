import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
const mockedInvokeLLM = vi.mocked(invokeLLM);

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("ai.analyzeImage", () => {
  it("returns analysis from Vision AI for valid image input", async () => {
    const mockAnalysis = {
      category: "tshirt",
      brand: "Uniqlo",
      primaryColor: "ขาว",
      secondaryColor: "",
      condition: "good",
      defects: [],
      defectLevel: "none",
      material: "ผ้าฝ้าย",
      style: "casual",
      pattern: "สีพื้น",
      confidence: 85,
    };

    mockedInvokeLLM.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(mockAnalysis),
            role: "assistant",
          },
          index: 0,
          finish_reason: "stop",
        },
      ],
    } as any);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.analyzeImage({
      images: [
        {
          base64: "iVBORw0KGgoAAAANSUhEUg==",
          mimeType: "image/png",
          label: "ด้านหน้า",
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.analysis).toEqual(mockAnalysis);
    expect(mockedInvokeLLM).toHaveBeenCalledOnce();

    // Verify the LLM was called with image content
    const callArgs = mockedInvokeLLM.mock.calls[0][0];
    expect(callArgs.messages).toHaveLength(2);
    expect(callArgs.messages[0].role).toBe("system");
    expect(callArgs.messages[1].role).toBe("user");
    // Check that image_url content is included
    const userContent = callArgs.messages[1].content;
    expect(Array.isArray(userContent)).toBe(true);
    if (Array.isArray(userContent)) {
      const imageContent = userContent.find((c: any) => c.type === "image_url");
      expect(imageContent).toBeDefined();
    }
  });

  it("throws error when LLM returns empty content", async () => {
    mockedInvokeLLM.mockResolvedValueOnce({
      choices: [
        {
          message: { content: null, role: "assistant" },
          index: 0,
          finish_reason: "stop",
        },
      ],
    } as any);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.ai.analyzeImage({
        images: [
          {
            base64: "iVBORw0KGgoAAAANSUhEUg==",
            mimeType: "image/png",
            label: "ด้านหน้า",
          },
        ],
      })
    ).rejects.toThrow();
  });

  it("validates input requires at least 1 image", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.ai.analyzeImage({ images: [] })
    ).rejects.toThrow();
  });
});

describe("ai.generateCaption", () => {
  it("returns captions from LLM for valid product info", async () => {
    const mockCaptions = {
      shortCaption: "ขาย Uniqlo เสื้อยืดสีขาว ไซซ์ M สภาพดี ราคา 250 บาท",
      mediumCaption:
        "ขายเสื้อยืด Uniqlo สีขาว ไซซ์ M\nสภาพดีมาก ใส่ไม่กี่ครั้ง\nราคาเบาๆ 250 บาท รีบจัดด่วน!",
      longCaption:
        "ขายเสื้อยืด Uniqlo สีขาว ไซซ์ M\nสภาพดีมาก ใส่ไม่กี่ครั้ง ไม่มีตำหนิ\nผ้านุ่มมาก ใส่สบาย\nราคาเดิม 590 บาท ขายเพียง 250 บาท\nส่งฟรี! DM มาเลยค่ะ",
      hashtags: [
        "#เสื้อผ้ามือสอง",
        "#Uniqlo",
        "#ขายเสื้อผ้า",
        "#มือสองสภาพดี",
        "#เสื้อยืด",
      ],
    };

    mockedInvokeLLM.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(mockCaptions),
            role: "assistant",
          },
          index: 0,
          finish_reason: "stop",
        },
      ],
    } as any);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.generateCaption({
      category: "t_shirt",
      brand: "Uniqlo",
      size: "M",
      condition: "good",
      color: "ขาว",
      recommendedPrice: 250,
      originalPrice: 590,
      style: "casual",
    });

    expect(result.success).toBe(true);
    expect(result.captions).toEqual(mockCaptions);
    expect(result.captions.shortCaption).toBeTruthy();
    expect(result.captions.mediumCaption).toBeTruthy();
    expect(result.captions.longCaption).toBeTruthy();
    expect(result.captions.hashtags).toHaveLength(5);
  });

  it("works without optional fields", async () => {
    const mockCaptions = {
      shortCaption: "ขายเสื้อยืด ไซซ์ M ราคา 200 บาท",
      mediumCaption: "ขายเสื้อยืด ไซซ์ M\nราคา 200 บาท\nสภาพดี",
      longCaption: "ขายเสื้อยืด ไซซ์ M\nราคา 200 บาท\nสภาพดี พร้อมส่ง",
      hashtags: ["#เสื้อผ้ามือสอง", "#ขายเสื้อผ้า"],
    };

    mockedInvokeLLM.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(mockCaptions),
            role: "assistant",
          },
          index: 0,
          finish_reason: "stop",
        },
      ],
    } as any);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.generateCaption({
      category: "t_shirt",
      brand: "no_brand",
      size: "M",
      condition: "good",
      recommendedPrice: 200,
    });

    expect(result.success).toBe(true);
    expect(result.captions.shortCaption).toBeTruthy();
  });
});
