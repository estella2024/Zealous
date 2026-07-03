import express from "express";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_CARDS, normalizeCards, type Card } from "./cards-data.js";

type CustomBgmMeta = {
  extension: string;
  mimeType?: string;
  updatedAt: string;
};

const app = express();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "zealous";
const ADMIN_ACCESS_KEY = (process.env.ADMIN_ACCESS_KEY || "21877273126080").replace(/^"(.*)"$/, "$1");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Supabase environment variables are missing. Vercel API storage is not configured.");
}

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

const CARDS_KEY = "data/cards.json";
const CARD_IMAGE_PREFIX = "cards/images/";
const CARD_ASSET_ROUTE = "/api/card-assets/";
const BGM_META_KEY = "audio/bgm-meta.json";
const BGM_PREFIX = "audio/bgm";
const DEFAULT_BGM_URL = "/seed-assets/BGM.m4a";
const AUDIO_MIME_BY_EXTENSION: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
};

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

function hasAdminAccess(req: express.Request) {
  return req.header("x-admin-key") === ADMIN_ACCESS_KEY;
}

function requireAdmin(req: express.Request, res: express.Response) {
  if (hasAdminAccess(req)) return true;
  res.status(401).json({ error: "Admin access is required." });
  return false;
}

function slugifyFilenamePart(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "card"
  );
}

function getExtensionFromFilename(filename: string) {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? `.${match[1]}` : "";
}

function getExtensionFromContentType(contentType: string) {
  if (contentType === "image/jpeg") return ".jpg";
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  if (contentType === "image/gif") return ".gif";
  if (contentType === "image/svg+xml") return ".svg";
  return "";
}

function getMimeTypeFromKey(key: string) {
  const extension = getExtensionFromFilename(key);
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function buildCardAssetKey(filename: string, contentType: string) {
  const extension = getExtensionFromFilename(filename) || getExtensionFromContentType(contentType) || ".bin";
  const stem = slugifyFilenamePart(filename.replace(/\.[^.]+$/, ""));
  return `${CARD_IMAGE_PREFIX}${Date.now()}-${stem}${extension}`;
}

function getCardAssetUrl(blobKey: string) {
  return `${CARD_ASSET_ROUTE}${encodeURIComponent(blobKey)}`;
}

function getCardAssetKeyFromUrl(image?: string) {
  if (!image || !image.startsWith(CARD_ASSET_ROUTE)) return null;
  return decodeURIComponent(image.slice(CARD_ASSET_ROUTE.length));
}

function normalizeExtension(extension?: string) {
  if (!extension) return ".mp3";
  return extension.startsWith(".") ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
}

function getMimeTypeForAudio(extension: string) {
  return AUDIO_MIME_BY_EXTENSION[extension.toLowerCase()] || "application/octet-stream";
}

function getBgmBlobKey(extension: string) {
  return `${BGM_PREFIX}${extension}`;
}

function parseDataUrl(value: string) {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;

  return {
    contentType: match[1],
    base64: match[2],
  };
}

async function downloadBuffer(key: string) {
  const client = requireSupabase();
  const { data, error } = await client.storage.from(SUPABASE_BUCKET).download(key);
  if (error) {
    if (error.message.toLowerCase().includes("not found")) return null;
    throw error;
  }

  return Buffer.from(await data.arrayBuffer());
}

async function uploadBuffer(key: string, buffer: Buffer, contentType?: string, cacheControl?: string) {
  const client = requireSupabase();
  const { error } = await client.storage.from(SUPABASE_BUCKET).upload(key, buffer, {
    contentType,
    cacheControl,
    upsert: true,
  });

  if (error) throw error;
}

async function deleteObject(key: string) {
  const client = requireSupabase();
  const { error } = await client.storage.from(SUPABASE_BUCKET).remove([key]);
  if (error) throw error;
}

async function readJSON<T>(key: string) {
  const buffer = await downloadBuffer(key);
  if (!buffer) return null;
  return JSON.parse(buffer.toString("utf-8")) as T;
}

async function writeJSON(key: string, value: unknown) {
  await uploadBuffer(key, Buffer.from(JSON.stringify(value, null, 2), "utf-8"), "application/json", "no-cache");
}

async function persistLegacyCardImage(image: string) {
  const parsed = parseDataUrl(image);
  if (!parsed) return image;

  const blobKey = buildCardAssetKey("uploaded-image", parsed.contentType);
  const buffer = Buffer.from(parsed.base64, "base64");
  await uploadBuffer(blobKey, buffer, parsed.contentType, "31536000");
  return getCardAssetUrl(blobKey);
}

async function readCards() {
  const cards = await readJSON<Card[]>(CARDS_KEY);
  if (Array.isArray(cards)) {
    const normalized = normalizeCards(cards);
    if (normalized.changed) {
      await writeJSON(CARDS_KEY, normalized.cards);
    }
    return normalized.cards;
  }

  await writeJSON(CARDS_KEY, DEFAULT_CARDS);
  return DEFAULT_CARDS;
}

async function writeCards(cards: Card[]) {
  await writeJSON(CARDS_KEY, cards);
}

async function deleteCardAssets(cards: Card[]) {
  const keys = cards
    .map((card) => getCardAssetKeyFromUrl(card.image))
    .filter((key): key is string => Boolean(key));

  await Promise.allSettled(keys.map((key) => deleteObject(key)));
}

async function readCustomBgmMeta() {
  const meta = await readJSON<Partial<CustomBgmMeta>>(BGM_META_KEY);
  if (!meta || typeof meta !== "object" || !meta.extension) {
    return null;
  }

  return {
    extension: normalizeExtension(meta.extension),
    mimeType:
      typeof meta.mimeType === "string"
        ? meta.mimeType
        : getMimeTypeForAudio(normalizeExtension(meta.extension)),
    updatedAt: typeof meta.updatedAt === "string" ? meta.updatedAt : new Date().toISOString(),
  } satisfies CustomBgmMeta;
}

async function deleteCustomBgm(meta: CustomBgmMeta | null) {
  if (!meta) return;
  await Promise.allSettled([deleteObject(getBgmBlobKey(meta.extension)), deleteObject(BGM_META_KEY)]);
}

async function getActiveBgmSource() {
  const meta = await readCustomBgmMeta();
  if (!meta) {
    return {
      hasCustom: false,
      url: DEFAULT_BGM_URL,
      mimeType: getMimeTypeForAudio(".m4a"),
      blobKey: null,
    };
  }

  return {
    hasCustom: true,
    url: `/api/bgm/active?v=${encodeURIComponent(meta.updatedAt)}`,
    mimeType: meta.mimeType || getMimeTypeForAudio(meta.extension),
    blobKey: getBgmBlobKey(meta.extension),
  };
}

app.post("/api/cards/upload-url", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { filename, contentType } = req.body ?? {};
  if (typeof filename !== "string" || filename.trim().length === 0) {
    res.status(400).json({ error: "Image filename is required." });
    return;
  }

  if (typeof contentType !== "string" || !contentType.startsWith("image/")) {
    res.status(400).json({ error: "Only image uploads are supported for gallery cards." });
    return;
  }

  const key = buildCardAssetKey(filename, contentType);
  res.json({
    url: `/api/card-assets-upload/${encodeURIComponent(key)}`,
    key,
    imageUrl: getCardAssetUrl(key),
  });
});

app.put("/api/card-assets-upload/*", express.raw({ type: "*/*", limit: "10mb" }), async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const rawKey = req.params[0];
  const blobKey = typeof rawKey === "string" ? decodeURIComponent(rawKey) : "";
  if (!blobKey.startsWith(CARD_IMAGE_PREFIX)) {
    res.status(400).json({ error: "Invalid card image target." });
    return;
  }

  try {
    await uploadBuffer(
      blobKey,
      Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body),
      req.header("content-type") || "application/octet-stream",
      "31536000",
    );
    res.status(200).end();
  } catch (error) {
    console.error("Image upload error", error);
    res.status(500).json({ error: "Could not persist card image asset." });
  }
});

app.get("/api/card-assets/*", async (req, res) => {
  const rawKey = req.params[0];
  const blobKey = typeof rawKey === "string" ? decodeURIComponent(rawKey) : "";
  if (!blobKey.startsWith(CARD_IMAGE_PREFIX)) {
    res.status(404).json({ error: "Card image not found." });
    return;
  }

  try {
    const buffer = await downloadBuffer(blobKey);
    if (!buffer) {
      res.status(404).json({ error: "Card image not found." });
      return;
    }

    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Type", getMimeTypeFromKey(blobKey));
    res.send(buffer);
  } catch (error) {
    console.error("Failed to read card image", error);
    res.status(500).json({ error: "Unable to load card image." });
  }
});

app.get("/api/cards", async (_req, res) => {
  try {
    const cards = await readCards();
    res.json(cards);
  } catch (error) {
    console.error("Failed to read cards", error);
    res.status(500).json({ error: "Failed to load gallery cards." });
  }
});

app.post("/api/cards", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { image, imageKey, text, quote } = req.body;
  if (!text) {
    res.status(400).json({ error: "Text is required for a valid card flipside." });
    return;
  }

  try {
    const cards = await readCards();
    const nextNumber = cards.length > 0 ? Math.max(...cards.map((card) => card.number || 0)) + 1 : 1;

    const newCard: Card = {
      id: Date.now().toString(),
      number: nextNumber,
      image:
        typeof imageKey === "string" && imageKey.startsWith(CARD_IMAGE_PREFIX)
          ? getCardAssetUrl(imageKey)
          : typeof image === "string" && image.length > 0
            ? await persistLegacyCardImage(image)
            : "",
      text,
      quote: typeof quote === "string" ? quote : "",
    };

    cards.push(newCard);
    await writeCards(cards);
    res.status(201).json(newCard);
  } catch (error) {
    console.error("Failed to create card", error);
    res.status(500).json({ error: "Failed to save the new card." });
  }
});

app.post("/api/cards/reset", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const existingCards = await readCards();
    await deleteCardAssets(existingCards);
    await writeCards(DEFAULT_CARDS);
    res.json({ message: "Default cards reset successfully.", cards: DEFAULT_CARDS });
  } catch (error) {
    console.error("Failed to reset cards", error);
    res.status(500).json({ error: "Failed to reset cards." });
  }
});

app.delete("/api/cards/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { id } = req.params;
    let cards = await readCards();
    const index = cards.findIndex((card) => card.id === id);

    if (index === -1) {
      res.status(404).json({ error: "Card not found." });
      return;
    }

    const [removedCard] = cards.splice(index, 1);
    cards = cards.map((card, cardIndex) => ({
      ...card,
      number: cardIndex + 1,
    }));

    await writeCards(cards);
    const assetKey = getCardAssetKeyFromUrl(removedCard?.image);
    if (assetKey) {
      await deleteObject(assetKey);
    }
    res.json({ message: "Card deleted, subsequent cards renumbered." });
  } catch (error) {
    console.error("Failed to delete card", error);
    res.status(500).json({ error: "Failed to delete card." });
  }
});

app.get("/api/bgm/status", async (_req, res) => {
  try {
    const activeBgm = await getActiveBgmSource();
    res.json({
      hasCustom: activeBgm.hasCustom,
      url: activeBgm.url,
    });
  } catch (error) {
    console.error("Failed to read background music status", error);
    res.status(500).json({ error: "Failed to read background music status." });
  }
});

app.get("/api/bgm/active", async (_req, res) => {
  try {
    const activeBgm = await getActiveBgmSource();
    if (!activeBgm.hasCustom || !activeBgm.blobKey) {
      res.redirect(302, DEFAULT_BGM_URL);
      return;
    }

    const data = await downloadBuffer(activeBgm.blobKey);
    if (!data) {
      res.redirect(302, DEFAULT_BGM_URL);
      return;
    }

    res.setHeader("Content-Type", activeBgm.mimeType);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.send(data);
  } catch (error) {
    console.error("Failed to stream background music", error);
    res.status(500).json({ error: "Failed to stream background music." });
  }
});

app.post("/api/bgm", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { audio, mimeType, extension } = req.body;
  if (!audio) {
    res.status(400).json({ error: "Audio binary file base64 data required in matching parameter." });
    return;
  }

  try {
    const normalizedExtension = normalizeExtension(typeof extension === "string" ? extension : undefined);
    const base64Data =
      typeof audio === "string" && audio.includes(",") ? audio.split(",").slice(1).join(",") : audio;
    const buffer = Buffer.from(base64Data, "base64");
    const previousMeta = await readCustomBgmMeta();

    if (previousMeta && previousMeta.extension !== normalizedExtension) {
      await deleteObject(getBgmBlobKey(previousMeta.extension));
    }

    await uploadBuffer(getBgmBlobKey(normalizedExtension), buffer, getMimeTypeForAudio(normalizedExtension), "no-cache");

    const nextMeta: CustomBgmMeta = {
      extension: normalizedExtension,
      mimeType: typeof mimeType === "string" && mimeType.length > 0 ? mimeType : getMimeTypeForAudio(normalizedExtension),
      updatedAt: new Date().toISOString(),
    };
    await writeJSON(BGM_META_KEY, nextMeta);

    res.json({ success: true, url: `/api/bgm/active?v=${encodeURIComponent(nextMeta.updatedAt)}` });
  } catch (error) {
    console.error("Audio upload error", error);
    res.status(500).json({ error: "Could not write background music to persistent storage." });
  }
});

app.post("/api/bgm/reset", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const meta = await readCustomBgmMeta();
    await deleteCustomBgm(meta);
    res.json({ success: true, url: DEFAULT_BGM_URL });
  } catch (error) {
    console.error("Audio reset error", error);
    res.status(500).json({ error: "Could not reset background music." });
  }
});

export default app;
