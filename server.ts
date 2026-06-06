import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;
const AUDIO_MIME_BY_EXTENSION: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav"
};

// High-impact request size thresholds for Base64 image payload handling
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const DATA_DIR = path.join(process.cwd(), "data");
const CARDS_FILE = path.join(DATA_DIR, "cards.json");
const LOCAL_BLOB_DIR = path.join(DATA_DIR, "blobs");
const DEFAULT_BGM_FILE = path.join(process.cwd(), "public", "seed-assets", "BGM.m4a");
const BGM_META_FILE = path.join(DATA_DIR, "bgm.json");
const CARD_IMAGE_PREFIX = "cards/images/";
const CARD_ASSET_ROUTE = "/api/card-assets/";
const SEED_IMAGE_MIGRATIONS: Record<string, string> = {
  "/seed-assets/sketch/12-anti-vision.png": "/seed-assets/sketch/12-anti-vision.jpg",
  "/seed-assets/sketch/13-real-you.png": "/seed-assets/sketch/13-real-you.jpg"
};

// Ensure the data folder and JSON store exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(LOCAL_BLOB_DIR)) {
  fs.mkdirSync(LOCAL_BLOB_DIR, { recursive: true });
}

const DEFAULT_CARDS = [
  {
    id: "1",
    number: 1,
    image: "/seed-assets/sketch/01-boost-1-6x.png",
    text: "1.6 倍人效下，雇谁更划算？",
    quote: "使用 AI 的综合绩效提升至1.61 倍，我有一个基于单一数据的臆想……"
  },
  {
    id: "2",
    number: 2,
    image: "/seed-assets/sketch/02-ability-x-influence.png",
    text: "影响力是能力的放大器",
    quote: "如果你是一根成熟的香蕉，那么适量的果蝇很有必要。"
  },
  {
    id: "3",
    number: 3,
    image: "/seed-assets/sketch/03-ai-native.png",
    text: "AI-native的核心还是人",
    quote: "AI-native的设想很美好，但很长一段时间内，human依然是中心。"
  },
  {
    id: "4",
    number: 4,
    image: "/seed-assets/sketch/04-a-union-b.png",
    text: "Boolen之人生大义",
    quote: "如果得到交集C才算成功，那人生路很窄。如果转向A和B，成功的可能性瞬间高起来。"
  },
  {
    id: "5",
    number: 5,
    image: "/seed-assets/sketch/05-a-to-a4.png",
    text: "全链路不是一条线性路",
    quote: "我们的任务，不是修一条完美的高速公路，而是在这张网上布置足够多的节点和触点。"
  },
  {
    id: "6",
    number: 6,
    image: "/seed-assets/sketch/06-communication-circles.png",
    text: "Underdog要把钱花在刀刃上",
    quote: "Lulu 针对underdog 提出的framework，对国内环境而言，可能过于理想化。"
  },
  {
    id: "7",
    number: 7,
    image: "/seed-assets/sketch/07-motivation-matters.png",
    text: "没有驱动的人只是工具",
    quote: "大家处在同个 range 里时， motivation 才是赢的关键。"
  },
  {
    id: "8",
    number: 8,
    image: "/seed-assets/sketch/08-problem-solving-paradigm.png",
    text: "怎么才算真正解决了问题？",
    quote: "picky的个性让我轻松做到前两步，却刻意省略第三步。"
  },
  {
    id: "9",
    number: 9,
    image: "/seed-assets/sketch/09-the-golden-circle.png",
    text: "知易行难，是因为开始就错了",
    quote: "没有内核的东西，做得再好都不会有人买单。"
  },
  {
    id: "10",
    number: 10,
    image: "/seed-assets/sketch/10-vector-life.png",
    text: "向量思维是我乐观的底色",
    quote: "在人生结束前，每一个点都足以画出新意义。"
  },
  {
    id: "11",
    number: 11,
    image: "/seed-assets/sketch/11-z-dna.png",
    text: "不完美的Z-DNA也很棒",
    quote: "既然画不出流畅的双螺旋，做个韧性满满、随时代而变的Z型，也不错。"
  },
  {
    id: "12",
    number: 12,
    image: "/seed-assets/sketch/12-anti-vision.jpg",
    text: "反愿景是一种稀缺资源",
    quote: "如果 vision 是所有人都知道的方向，那么 anti-vision 就是那些还没有被说出口的反方向。"
  },
  {
    id: "13",
    number: 13,
    image: "/seed-assets/sketch/13-real-you.jpg",
    text: "离开公司或平台，你还是你吗？",
    quote: "是「你」的，却不是「公司/平台」的能力，是什么？\n你的身份，\n是一个 passenger、一个 stakeholder、一个 autonomist？"
  }
];

function getSeedImageForCardNumber(number?: number) {
  if (number === 12) return "/seed-assets/sketch/12-anti-vision.jpg";
  if (number === 13) return "/seed-assets/sketch/13-real-you.jpg";
  return null;
}

function migrateSeedImagePath(image?: string) {
  if (typeof image !== "string") return image;
  return SEED_IMAGE_MIGRATIONS[image] ?? image;
}

function normalizeCards(cards: any[]) {
  let changed = false;

  const normalized = cards.map((card) => {
    const nextSeedImage = getSeedImageForCardNumber(card?.number);
    let nextImage = migrateSeedImagePath(card?.image);

    if (nextSeedImage && typeof card?.image === "string" && card.image.startsWith("data:image/")) {
      nextImage = nextSeedImage;
    }

    if (nextImage !== card?.image) {
      changed = true;
      return {
        ...card,
        image: nextImage
      };
    }

    return card;
  });

  return { cards: normalized, changed };
}

function slugifyFilenamePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "card";
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

function getMimeTypeForImage(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
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

function resolveBlobPath(blobKey: string) {
  const normalizedKey = blobKey.replace(/^\/+/, "");
  return path.join(LOCAL_BLOB_DIR, normalizedKey);
}

function ensureBlobParent(blobKey: string) {
  const blobPath = resolveBlobPath(blobKey);
  fs.mkdirSync(path.dirname(blobPath), { recursive: true });
  return blobPath;
}

function parseDataUrl(value: string) {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  return {
    contentType: match[1],
    base64: match[2]
  };
}

function persistLegacyCardImage(image: string) {
  const parsed = parseDataUrl(image);
  if (!parsed) return image;

  const blobKey = buildCardAssetKey("uploaded-image", parsed.contentType);
  const blobPath = ensureBlobParent(blobKey);
  fs.writeFileSync(blobPath, Buffer.from(parsed.base64, "base64"));
  return getCardAssetUrl(blobKey);
}

function deleteCardAsset(image?: string) {
  const blobKey = getCardAssetKeyFromUrl(image);
  if (!blobKey) return;

  const blobPath = resolveBlobPath(blobKey);
  if (fs.existsSync(blobPath)) {
    fs.unlinkSync(blobPath);
  }
}

function readCards(): any[] {
  try {
    if (fs.existsSync(CARDS_FILE)) {
      const data = fs.readFileSync(CARDS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        const normalized = normalizeCards(parsed);
        if (normalized.changed) {
          writeCards(normalized.cards);
        }
        return normalized.cards;
      }
    }
  } catch (error) {
    console.error("Error reading cards list", error);
  }
  // Initialize with seed data
  writeCards(DEFAULT_CARDS);
  return DEFAULT_CARDS;
}

function writeCards(cards: any[]) {
  try {
    fs.writeFileSync(CARDS_FILE, JSON.stringify(cards, null, 2), "utf-8");
  } catch (error) {
    console.error("Error saving cards list", error);
  }
}

// REST Web API Endpoints
app.get("/api/cards", (req, res) => {
  const cards = readCards();
  res.json(cards);
});

app.post("/api/cards/upload-url", (req, res) => {
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
    imageUrl: getCardAssetUrl(key)
  });
});

app.put("/api/card-assets-upload/*", express.raw({ type: "*/*", limit: "50mb" }), (req, res) => {
  const rawKey = req.params[0];
  const blobKey = typeof rawKey === "string" ? decodeURIComponent(rawKey) : "";
  if (!blobKey.startsWith(CARD_IMAGE_PREFIX)) {
    res.status(400).json({ error: "Invalid card image target." });
    return;
  }

  try {
    const blobPath = ensureBlobParent(blobKey);
    fs.writeFileSync(blobPath, req.body);
    res.status(200).end();
  } catch (err: any) {
    console.error("Image upload error", err);
    res.status(500).json({ error: "Could not persist card image asset." });
  }
});

app.get("/api/card-assets/*", (req, res) => {
  const rawKey = req.params[0];
  const blobKey = typeof rawKey === "string" ? decodeURIComponent(rawKey) : "";
  if (!blobKey.startsWith(CARD_IMAGE_PREFIX)) {
    res.status(404).json({ error: "Card image not found." });
    return;
  }

  const blobPath = resolveBlobPath(blobKey);
  if (!fs.existsSync(blobPath)) {
    res.status(404).json({ error: "Card image not found." });
    return;
  }

  res.setHeader("Content-Type", getMimeTypeForImage(blobPath));
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.sendFile(blobPath);
});

// Sound / Audio BGM Management Endpoints
const LEGACY_BGM_FILE = path.join(DATA_DIR, "bgm.mp3");

function getMimeTypeForAudio(filePath: string) {
  return AUDIO_MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function readCustomBgmMeta() {
  try {
    if (!fs.existsSync(BGM_META_FILE)) return null;
    const raw = fs.readFileSync(BGM_META_FILE, "utf-8");
    const data = JSON.parse(raw) as { extension?: string; mimeType?: string };
    if (!data.extension) return null;

    return {
      extension: data.extension.startsWith(".") ? data.extension.toLowerCase() : `.${data.extension.toLowerCase()}`,
      mimeType: data.mimeType || undefined
    };
  } catch (error) {
    console.error("Error reading BGM metadata", error);
    return null;
  }
}

function getCustomBgmSource() {
  const meta = readCustomBgmMeta();
  if (meta) {
    const filePath = path.join(DATA_DIR, `bgm${meta.extension}`);
    if (fs.existsSync(filePath)) {
      return {
        filePath,
        mimeType: meta.mimeType || getMimeTypeForAudio(filePath)
      };
    }
  }

  if (fs.existsSync(LEGACY_BGM_FILE)) {
    return {
      filePath: LEGACY_BGM_FILE,
      mimeType: getMimeTypeForAudio(LEGACY_BGM_FILE)
    };
  }

  return null;
}

function getActiveBgmSource() {
  const customBgm = getCustomBgmSource();
  const hasCustom = Boolean(customBgm);
  const filePath = customBgm?.filePath || DEFAULT_BGM_FILE;
  const version = fs.existsSync(filePath) ? fs.statSync(filePath).mtimeMs.toString() : Date.now().toString();

  return {
    hasCustom,
    filePath,
    mimeType: customBgm?.mimeType || getMimeTypeForAudio(filePath),
    url: `/api/bgm/active?v=${version}`
  };
}

app.get("/api/bgm/status", (req, res) => {
  const activeBgm = getActiveBgmSource();
  res.json({
    hasCustom: activeBgm.hasCustom,
    url: activeBgm.url
  });
});

app.get("/api/bgm/active", (req, res) => {
  const activeBgm = getActiveBgmSource();
  res.setHeader("Content-Type", activeBgm.mimeType);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(activeBgm.filePath);
});

app.post("/api/bgm", (req, res) => {
  const { audio, mimeType, extension } = req.body;
  if (!audio) {
    res.status(400).json({ error: "Audio binary file base64 data required in matching parameter." });
    return;
  }

  try {
    const normalizedExtension = typeof extension === "string" && extension.length > 0
      ? (extension.startsWith(".") ? extension.toLowerCase() : `.${extension.toLowerCase()}`)
      : ".mp3";
    const targetFile = path.join(DATA_DIR, `bgm${normalizedExtension}`);
    const base64Data = typeof audio === "string" && audio.includes(",")
      ? audio.split(",").slice(1).join(",")
      : audio;
    const buffer = Buffer.from(base64Data, "base64");
    const previousCustomBgm = getCustomBgmSource();
    if (previousCustomBgm && fs.existsSync(previousCustomBgm.filePath) && previousCustomBgm.filePath !== targetFile) {
      fs.unlinkSync(previousCustomBgm.filePath);
    }
    if (fs.existsSync(LEGACY_BGM_FILE) && LEGACY_BGM_FILE !== targetFile) {
      fs.unlinkSync(LEGACY_BGM_FILE);
    }
    fs.writeFileSync(targetFile, buffer);
    fs.writeFileSync(
      BGM_META_FILE,
      JSON.stringify({ extension: normalizedExtension, mimeType: typeof mimeType === "string" ? mimeType : undefined }, null, 2),
      "utf-8"
    );
    res.json({ success: true, url: getActiveBgmSource().url });
  } catch (err: any) {
    console.error("Audio upload error", err);
    res.status(500).json({ error: "Could not write background music stream file to database disk storage." });
  }
});

app.post("/api/bgm/reset", (req, res) => {
  try {
    const currentCustomBgm = getCustomBgmSource();
    if (currentCustomBgm && fs.existsSync(currentCustomBgm.filePath)) {
      fs.unlinkSync(currentCustomBgm.filePath);
    }
    if (fs.existsSync(LEGACY_BGM_FILE)) {
      fs.unlinkSync(LEGACY_BGM_FILE);
    }
    if (fs.existsSync(BGM_META_FILE)) {
      fs.unlinkSync(BGM_META_FILE);
    }
    res.json({ success: true, url: getActiveBgmSource().url });
  } catch (err: any) {
    console.error("Audio reset error", err);
    res.status(500).json({ error: "Could not reset background music stream file." });
  }
});

app.post("/api/cards", (req, res) => {
  const { image, imageKey, text, quote } = req.body;
  if (!text) {
    res.status(400).json({ error: "Text is required for a valid card flipside." });
    return;
  }

  const cards = readCards();
  // Find current maximum serial number assigned to cards
  const nextNumber = cards.length > 0 ? Math.max(...cards.map(c => c.number || 0)) + 1 : 1;

  const newCard = {
    id: Date.now().toString(),
    number: nextNumber,
    image:
      typeof imageKey === "string" && imageKey.startsWith(CARD_IMAGE_PREFIX)
        ? getCardAssetUrl(imageKey)
        : typeof image === "string" && image.length > 0
          ? persistLegacyCardImage(image)
          : "",
    text: text,
    quote: typeof quote === "string" ? quote : ""
  };

  cards.push(newCard);
  writeCards(cards);
  res.status(201).json(newCard);
});

app.post("/api/cards/reset", (req, res) => {
  readCards().forEach((card) => deleteCardAsset(card.image));
  writeCards(DEFAULT_CARDS);
  res.json({ message: "Default cards reset successfully.", cards: DEFAULT_CARDS });
});

app.delete("/api/cards/:id", (req, res) => {
  const { id } = req.params;
  let cards = readCards();
  const index = cards.findIndex(c => c.id === id);
  if (index === -1) {
    res.status(404).json({ error: "Card not found." });
    return;
  }
  const [removedCard] = cards.splice(index, 1);
  // Re-number remaining cards to keep perfect numeric order matching index
  cards = cards.map((c, i) => ({
    ...c,
    number: i + 1
  }));
  writeCards(cards);
  deleteCardAsset(removedCard.image);
  res.json({ message: "Card deleted, subsequent cards renumbered." });
});

// Configure Vite middleware or production static folder serving
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Serve index.html for Single Page Application
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Express API Server] Active on port ${PORT}`);
  });
}

setupServer();
