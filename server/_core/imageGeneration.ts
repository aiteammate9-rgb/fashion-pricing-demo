/**
 * Image generation via Google Gemini (image-capable model), replacing Manus Forge.
 * Requires GOOGLE_AI_API_KEY. The generated image is uploaded to storage
 * (Cloudinary) and a public URL is returned.
 *
 *   const { url } = await generateImage({
 *     prompt: "editorial photo ...",
 *     originalImages: [{ url: "https://res.cloudinary.com/.../item.jpg" }],
 *   });
 */
import { storagePut } from "server/storage";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
};

// Image-capable Gemini model. Override with GEMINI_IMAGE_MODEL if Google renames it.
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

async function toInlineData(img: {
  url?: string;
  b64Json?: string;
  mimeType?: string;
}): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  let data = img.b64Json || null;
  let mime = img.mimeType || "image/jpeg";
  if (!data && img.url) {
    try {
      const r = await fetch(img.url);
      if (!r.ok) return null;
      const ct = r.headers.get("content-type");
      if (ct && ct.startsWith("image/")) mime = ct;
      data = Buffer.from(await r.arrayBuffer()).toString("base64");
    } catch {
      return null;
    }
  }
  if (!data) return null;
  return { inlineData: { mimeType: mime, data } };
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  if (!ENV.googleAiApiKey) {
    throw new Error("GOOGLE_AI_API_KEY is not configured (required for image generation)");
  }

  const parts: Array<Record<string, unknown>> = [{ text: options.prompt }];
  for (const img of options.originalImages || []) {
    const part = await toInlineData(img);
    if (part) parts.push(part);
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent` +
    `?key=${encodeURIComponent(ENV.googleAiApiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Gemini image generation failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const json = (await response.json()) as any;
  const respParts = json?.candidates?.[0]?.content?.parts || [];
  const imgPart = respParts.find(
    (p: any) => p?.inlineData?.data || p?.inline_data?.data
  );
  const b64: string | undefined =
    imgPart?.inlineData?.data || imgPart?.inline_data?.data;
  if (!b64) {
    throw new Error("Gemini returned no image data");
  }
  const mime: string =
    imgPart?.inlineData?.mimeType || imgPart?.inline_data?.mime_type || "image/png";
  const buffer = Buffer.from(b64, "base64");
  const ext = mime.includes("png") ? "png" : "jpg";

  const { url: outUrl } = await storagePut(
    `generated/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`,
    buffer,
    mime
  );
  return { url: outUrl };
}
