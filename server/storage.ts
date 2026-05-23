// Storage helpers backed by Cloudinary (signed upload via REST).
// Replaces the Manus Forge implementation so the app no longer depends on Manus.
//
// Required env (.env):
//   CLOUDINARY_CLOUD_NAME
//   CLOUDINARY_API_KEY
//   CLOUDINARY_API_SECRET
//
// storagePut uploads bytes/base64 and returns the public https secure_url.
// We store that secure_url directly in the DB (wardrobe.imageUrl), so
// storageGet / storageGetSignedUrl simply return the URL — Cloudinary delivery
// URLs are public and need no signing.

import crypto from "crypto";
import { ENV } from "./_core/env";

function getCloudinaryConfig() {
  const cloudName = ENV.cloudinaryCloudName;
  const apiKey = ENV.cloudinaryApiKey;
  const apiSecret = ENV.cloudinaryApiSecret;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Storage config missing: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET",
    );
  }
  return { cloudName, apiKey, apiSecret };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

// Build a collision-resistant public_id (Cloudinary overwrites on duplicate id).
function buildPublicId(relKey: string): string {
  const cleaned = normalizeKey(relKey).replace(/\.[^./]+$/, ""); // drop extension
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `${cleaned}_${hash}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "image/jpeg",
): Promise<{ key: string; url: string }> {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const publicId = buildPublicId(relKey);
  const timestamp = Math.floor(Date.now() / 1000);

  // Signature = sha1 of the alphabetically-sorted params to sign + api_secret.
  // We sign public_id and timestamp.
  const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash("sha1")
    .update(paramsToSign + apiSecret)
    .digest("hex");

  // Cloudinary accepts the file as a base64 data URI string.
  const base64 =
    typeof data === "string"
      ? Buffer.from(data).toString("base64")
      : Buffer.from(data).toString("base64");
  const fileField = `data:${contentType};base64,${base64}`;

  const form = new FormData();
  form.append("file", fileField);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("public_id", publicId);
  form.append("signature", signature);

  const resp = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: form },
  );

  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Cloudinary upload failed (${resp.status}): ${msg}`);
  }

  const json = (await resp.json()) as { secure_url?: string; public_id?: string };
  if (!json.secure_url) throw new Error("Cloudinary returned no secure_url");
  return { key: json.public_id ?? publicId, url: json.secure_url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  if (/^https?:\/\//i.test(relKey)) return { key: relKey, url: relKey };
  const { cloudName } = getCloudinaryConfig();
  return {
    key: relKey,
    url: `https://res.cloudinary.com/${cloudName}/image/upload/${normalizeKey(relKey)}`,
  };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  // Cloudinary delivery URLs are public — no signing needed.
  if (/^https?:\/\//i.test(relKey)) return relKey;
  const { cloudName } = getCloudinaryConfig();
  return `https://res.cloudinary.com/${cloudName}/image/upload/${normalizeKey(relKey)}`;
}
