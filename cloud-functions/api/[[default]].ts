import express from "express";
import { getStore } from "@edgeone/pages-blob";

type Card = {
  id: string;
  number: number;
  image?: string;
  text: string;
  quote?: string;
};

type CustomBgmMeta = {
  extension: string;
  mimeType?: string;
  updatedAt: string;
};

const app = express();
const store = getStore("zealous-data");

const CARDS_KEY = "cards/cards.json";
const CARD_IMAGE_PREFIX = "cards/images/";
const CARD_ASSET_ROUTE = "/api/card-assets/";
const BGM_META_KEY = "audio/bgm-meta.json";
const BGM_PREFIX = "audio/bgm";
const DEFAULT_BGM_URL = "/seed-assets/BGM.m4a";
const SEED_IMAGE_MIGRATIONS: Record<string, string> = {
  "/seed-assets/sketch/12-anti-vision.png": "/seed-assets/sketch/12-anti-vision-v2.jpg",
  "/seed-assets/sketch/12-anti-vision.jpg": "/seed-assets/sketch/12-anti-vision-v2.jpg",
  "/seed-assets/sketch/13-real-you.png": "/seed-assets/sketch/13-real-you-v2.jpg",
  "/seed-assets/sketch/13-real-you.jpg": "/seed-assets/sketch/13-real-you-v2.jpg",
};
const AUDIO_MIME_BY_EXTENSION: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
};

const DEFAULT_CARDS: Card[] = [
  {
    id: "1",
    number: 1,
    image: "/seed-assets/sketch/01-boost-1-6x.png",
    text: "1.6 倍人效下，雇谁更划算？",
    quote: "使用 AI 的综合绩效提升至1.61 倍，我有一个基于单一数据的臆想……",
  },
  {
    id: "2",
    number: 2,
    image: "/seed-assets/sketch/02-ability-x-influence.png",
    text: "影响力是能力的放大器",
    quote: "如果你是一根成熟的香蕉，那么适量的果蝇很有必要。",
  },
  {
    id: "3",
    number: 3,
    image: "/seed-assets/sketch/03-ai-native.png",
    text: "AI-native的核心还是人",
    quote: "AI-native的设想很美好，但很长一段时间内，human依然是中心。",
  },
  {
    id: "4",
    number: 4,
    image: "/seed-assets/sketch/04-a-union-b.png",
    text: "Boolen之人生大义",
    quote: "如果得到交集C才算成功，那人生路很窄。如果转向A和B，成功的可能性瞬间高起来。",
  },
  {
    id: "5",
    number: 5,
    image: "/seed-assets/sketch/05-a-to-a4.png",
    text: "全链路不是一条线性路",
    quote: "我们的任务，不是修一条完美的高速公路，而是在这张网上布置足够多的节点和触点。",
  },
  {
    id: "6",
    number: 6,
    image: "/seed-assets/sketch/06-communication-circles.png",
    text: "Underdog要把钱花在刀刃上",
    quote: "Lulu 针对underdog 提出的framework，对国内环境而言，可能过于理想化。",
  },
  {
    id: "7",
    number: 7,
    image: "/seed-assets/sketch/07-motivation-matters.png",
    text: "没有驱动的人只是工具",
    quote: "大家处在同个 range 里时， motivation 才是赢的关键。",
  },
  {
    id: "8",
    number: 8,
    image: "/seed-assets/sketch/08-problem-solving-paradigm.png",
    text: "怎么才算真正解决了问题？",
    quote: "picky的个性让我轻松做到前两步，却刻意省略第三步。",
  },
  {
    id: "9",
    number: 9,
    image: "/seed-assets/sketch/09-the-golden-circle.png",
    text: "知易行难，是因为开始就错了",
    quote: "没有内核的东西，做得再好都不会有人买单。",
  },
  {
    id: "10",
    number: 10,
    image: "/seed-assets/sketch/10-vector-life.png",
    text: "向量思维是我乐观的底色",
    quote: "在人生结束前，每一个点都足以画出新意义。",
  },
  {
    id: "11",
    number: 11,
    image: "/seed-assets/sketch/11-z-dna.png",
    text: "不完美的Z-DNA也很棒",
    quote: "既然画不出流畅的双螺旋，做个韧性满满、随时代而变的Z型，也不错。",
  },
  {
    id: "12",
    number: 12,
    image: "/seed-assets/sketch/12-anti-vision-v2.jpg",
    text: "反愿景是一种稀缺资源",
    quote: "如果 vision 是所有人都知道的方向，那么 anti-vision 就是那些还没有被说出口的反方向。",
  },
  {
    id: "13",
    number: 13,
    image: "/seed-assets/sketch/13-real-you-v2.jpg",
    text: "离开公司或平台，你还是你吗？",
    quote:
      "是「你」的，却不是「公司/平台」的能力，是什么？\n你的身份，\n是一个 passenger、一个 stakeholder、一个 autonomist？",
  },
];

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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

function parseDataUrl(value: string) {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;

  return {
    contentType: match[1],
    base64: match[2],
  };
}

async function persistLegacyCardImage(image: string) {
  const parsed = parseDataUrl(image);
  if (!parsed) return image;

  const blobKey = buildCardAssetKey("uploaded-image", parsed.contentType);
  const buffer = Buffer.from(parsed.base64, "base64");
  await store.set(blobKey, buffer, {
    cacheControl: "public, max-age=31536000, immutable",
  });
  return getCardAssetUrl(blobKey);
}

async function deleteCardAssets(cards: Card[]) {
  const keys = cards
    .map((card) => getCardAssetKeyFromUrl(card.image))
    .filter((key): key is string => Boolean(key));

  await Promise.allSettled(keys.map((key) => store.delete(key)));
}

function getSeedImageForCardNumber(number?: number) {
  if (number === 12) return "/seed-assets/sketch/12-anti-vision-v2.jpg";
  if (number === 13) return "/seed-assets/sketch/13-real-you-v2.jpg";
  return null;
}

function migrateSeedImagePath(image?: string) {
  if (typeof image !== "string") return image;
  return SEED_IMAGE_MIGRATIONS[image] ?? image;
}

function normalizeCards(cards: Card[]) {
  let changed = false;

  const normalized = cards.map((card) => {
    const nextSeedImage = getSeedImageForCardNumber(card.number);
    let nextImage = migrateSeedImagePath(card.image);

    if (nextSeedImage && typeof card.image === "string" && card.image.startsWith("data:image/")) {
      nextImage = nextSeedImage;
    }

    if (nextImage !== card.image) {
      changed = true;
      return {
        ...card,
        image: nextImage,
      };
    }

    return card;
  });

  return { cards: normalized, changed };
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

async function readCards() {
  const cards = await store.get(CARDS_KEY, { type: "json", consistency: "strong" });
  if (Array.isArray(cards)) {
    const isLegacyEnglishSeed =
      cards.length === 11 &&
      typeof cards[0]?.text === "string" &&
      cards[0].text.startsWith("1.6X BOOST.");

    if (isLegacyEnglishSeed) {
      await store.setJSON(CARDS_KEY, DEFAULT_CARDS);
      return DEFAULT_CARDS;
    }

    const normalized = normalizeCards(cards as Card[]);
    if (normalized.changed) {
      await store.setJSON(CARDS_KEY, normalized.cards);
    }
    return normalized.cards;
  }

  await store.setJSON(CARDS_KEY, DEFAULT_CARDS);
  return DEFAULT_CARDS;
}

async function writeCards(cards: Card[]) {
  await store.setJSON(CARDS_KEY, cards);
}

async function readCustomBgmMeta() {
  const meta = await store.get(BGM_META_KEY, { type: "json", consistency: "strong" });
  if (!meta || typeof meta !== "object") {
    return null;
  }

  const maybeMeta = meta as Partial<CustomBgmMeta>;
  if (!maybeMeta.extension || typeof maybeMeta.extension !== "string") {
    return null;
  }

  return {
    extension: normalizeExtension(maybeMeta.extension),
    mimeType:
      typeof maybeMeta.mimeType === "string"
        ? maybeMeta.mimeType
        : getMimeTypeForAudio(normalizeExtension(maybeMeta.extension)),
    updatedAt:
      typeof maybeMeta.updatedAt === "string" ? maybeMeta.updatedAt : new Date().toISOString(),
  } satisfies CustomBgmMeta;
}

async function deleteCustomBgm(meta: CustomBgmMeta | null) {
  if (!meta) return;
  await store.delete(getBgmBlobKey(meta.extension));
  await store.delete(BGM_META_KEY);
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

app.post("/cards/upload-url", async (req, res) => {
  const { filename, contentType } = req.body ?? {};
  if (typeof filename !== "string" || filename.trim().length === 0) {
    res.status(400).json({ error: "Image filename is required." });
    return;
  }

  if (typeof contentType !== "string" || !contentType.startsWith("image/")) {
    res.status(400).json({ error: "Only image uploads are supported for gallery cards." });
    return;
  }

  try {
    const key = buildCardAssetKey(filename, contentType);
    const upload = await store.createUploadUrl(key, {
      contentType,
      expireSeconds: 900,
    });

    res.json({
      url: upload.url,
      key,
      imageUrl: getCardAssetUrl(key),
      expiresAt: upload.expiresAt,
    });
  } catch (error) {
    console.error("Failed to create upload URL", error);
    res.status(500).json({ error: "Unable to prepare image upload." });
  }
});

app.get("/card-assets/*", async (req, res) => {
  const rawKey = req.params[0];
  const blobKey = typeof rawKey === "string" ? decodeURIComponent(rawKey) : "";
  if (!blobKey.startsWith(CARD_IMAGE_PREFIX)) {
    res.status(404).json({ error: "Card image not found." });
    return;
  }

  try {
    const [buffer, metadata] = await Promise.all([
      store.get(blobKey, { type: "arrayBuffer", consistency: "strong" }),
      store.getMetadata(blobKey, { consistency: "strong" }),
    ]);

    if (!buffer) {
      res.status(404).json({ error: "Card image not found." });
      return;
    }

    if (metadata?.contentType) {
      res.setHeader("Content-Type", metadata.contentType);
    }
    if (metadata?.cacheControl) {
      res.setHeader("Cache-Control", metadata.cacheControl);
    }

    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Failed to read card image", error);
    res.status(500).json({ error: "Unable to load card image." });
  }
});

app.get("/cards", async (_req, res) => {
  try {
    const cards = await readCards();
    res.json(cards);
  } catch (error) {
    console.error("Failed to read cards", error);
    res.status(500).json({ error: "Failed to load gallery cards." });
  }
});

app.post("/cards", async (req, res) => {
  const { image, imageKey, text, quote } = req.body;
  if (!text) {
    res.status(400).json({ error: "Text is required for a valid card flipside." });
    return;
  }

  try {
    const cards = await readCards();
    const nextNumber =
      cards.length > 0 ? Math.max(...cards.map((card) => card.number || 0)) + 1 : 1;

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

app.post("/cards/reset", async (_req, res) => {
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

app.delete("/cards/:id", async (req, res) => {
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
      await store.delete(assetKey);
    }
    res.json({ message: "Card deleted, subsequent cards renumbered." });
  } catch (error) {
    console.error("Failed to delete card", error);
    res.status(500).json({ error: "Failed to delete card." });
  }
});

app.get("/bgm/status", async (_req, res) => {
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

app.get("/bgm/active", async (_req, res) => {
  try {
    const activeBgm = await getActiveBgmSource();
    if (!activeBgm.hasCustom || !activeBgm.blobKey) {
      res.redirect(302, DEFAULT_BGM_URL);
      return;
    }

    const data = await store.get(activeBgm.blobKey, {
      type: "arrayBuffer",
      consistency: "strong",
    });

    if (!data) {
      res.redirect(302, DEFAULT_BGM_URL);
      return;
    }

    res.setHeader("Content-Type", activeBgm.mimeType);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.send(Buffer.from(data as ArrayBuffer));
  } catch (error) {
    console.error("Failed to stream background music", error);
    res.status(500).json({ error: "Failed to stream background music." });
  }
});

app.post("/bgm", async (req, res) => {
  const { audio, mimeType, extension } = req.body;
  if (!audio) {
    res.status(400).json({ error: "Audio binary file base64 data required in matching parameter." });
    return;
  }

  try {
    const normalizedExtension = normalizeExtension(
      typeof extension === "string" ? extension : undefined,
    );
    const base64Data =
      typeof audio === "string" && audio.includes(",")
        ? audio.split(",").slice(1).join(",")
        : audio;
    const buffer = Buffer.from(base64Data, "base64");
    const previousMeta = await readCustomBgmMeta();

    if (previousMeta && previousMeta.extension !== normalizedExtension) {
      await store.delete(getBgmBlobKey(previousMeta.extension));
    }

    await store.set(getBgmBlobKey(normalizedExtension), buffer);

    const nextMeta: CustomBgmMeta = {
      extension: normalizedExtension,
      mimeType:
        typeof mimeType === "string" && mimeType.length > 0
          ? mimeType
          : getMimeTypeForAudio(normalizedExtension),
      updatedAt: new Date().toISOString(),
    };
    await store.setJSON(BGM_META_KEY, nextMeta);

    res.json({ success: true, url: `/api/bgm/active?v=${encodeURIComponent(nextMeta.updatedAt)}` });
  } catch (error) {
    console.error("Audio upload error", error);
    res.status(500).json({ error: "Could not write background music to persistent storage." });
  }
});

app.post("/bgm/reset", async (_req, res) => {
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
