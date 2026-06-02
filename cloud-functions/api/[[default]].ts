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
const BGM_META_KEY = "audio/bgm-meta.json";
const BGM_PREFIX = "audio/bgm";
const DEFAULT_BGM_URL = "/seed-assets/BGM.m4a";
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
    text: "1.6X BOOST. AI MAKES SENIOR AND EXPERT STAFF MORE VALUABLE, NOT LESS.",
  },
  {
    id: "2",
    number: 2,
    image: "/seed-assets/sketch/02-ability-x-influence.png",
    text: "ABILITY X INFLUENCE. GROW THE VALUE OF WHAT YOU KNOW BY AMPLIFYING WHO YOU CAN MOVE.",
  },
  {
    id: "3",
    number: 3,
    image: "/seed-assets/sketch/03-ai-native.png",
    text: "AI-NATIVE. HUMAN JUDGMENT STILL SITS AT THE CENTER OF EVERY SYSTEM WORTH TRUSTING.",
  },
  {
    id: "4",
    number: 4,
    image: "/seed-assets/sketch/04-a-union-b.png",
    text: "A UNION B. SUCCESS EXPANDS WHEN YOU ALLOW MORE THAN ONE CORRECT PATH.",
  },
  {
    id: "5",
    number: 5,
    image: "/seed-assets/sketch/05-a-to-a4.png",
    text: "A TO A4. TRANSLATE A BLURRY IDEA INTO A FORMAT THAT CAN ACTUALLY BE SHARED.",
  },
  {
    id: "6",
    number: 6,
    image: "/seed-assets/sketch/06-communication-circles.png",
    text: "COMMUNICATION CIRCLES. WHAT YOU SAY CHANGES ONCE YOU DECIDE WHO THE MESSAGE SERVES.",
  },
  {
    id: "7",
    number: 7,
    image: "/seed-assets/sketch/07-motivation-matters.png",
    text: "MOTIVATION MATTERS. WHEN CAPABILITY CLUSTERS TOGETHER, DRIVE DECIDES THE OUTCOME.",
  },
  {
    id: "8",
    number: 8,
    image: "/seed-assets/sketch/08-problem-solving-paradigm.png",
    text: "PROBLEM-SOLVING PARADIGM. DEFINE, SOLVE, SYSTEMATIZE. CLOSURE IS NOT THE SAME AS COMPLETION.",
  },
  {
    id: "9",
    number: 9,
    image: "/seed-assets/sketch/09-the-golden-circle.png",
    text: "THE GOLDEN CIRCLE. IF THE CORE IS EMPTY, NOTHING YOU LAYER ON TOP WILL HOLD.",
  },
  {
    id: "10",
    number: 10,
    image: "/seed-assets/sketch/10-vector-life.png",
    text: "VECTOR LIFE. EVERY POINT CAN STILL CHANGE DIRECTION BEFORE THE STORY ENDS.",
  },
  {
    id: "11",
    number: 11,
    image: "/seed-assets/sketch/11-z-dna.png",
    text: "Z-DNA. RESILIENCE DOES NOT NEED A PERFECT HELIX TO KEEP EVOLVING.",
  },
];

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
    return cards as Card[];
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
  const { image, text, quote } = req.body;
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
      image: image || "",
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

    cards.splice(index, 1);
    cards = cards.map((card, cardIndex) => ({
      ...card,
      number: cardIndex + 1,
    }));

    await writeCards(cards);
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
