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
const DEFAULT_BGM_FILE = path.join(process.cwd(), "public", "seed-assets", "BGM.m4a");
const BGM_META_FILE = path.join(DATA_DIR, "bgm.json");

// Ensure the data folder and JSON store exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_CARDS = [
  {
    id: "1",
    number: 1,
    image: "/seed-assets/sketch/01-boost-1-6x.png",
    text: "1.6X BOOST. AI MAKES SENIOR AND EXPERT STAFF MORE VALUABLE, NOT LESS."
  },
  {
    id: "2",
    number: 2,
    image: "/seed-assets/sketch/02-ability-x-influence.png",
    text: "ABILITY X INFLUENCE. GROW THE VALUE OF WHAT YOU KNOW BY AMPLIFYING WHO YOU CAN MOVE."
  },
  {
    id: "3",
    number: 3,
    image: "/seed-assets/sketch/03-ai-native.png",
    text: "AI-NATIVE. HUMAN JUDGMENT STILL SITS AT THE CENTER OF EVERY SYSTEM WORTH TRUSTING."
  },
  {
    id: "4",
    number: 4,
    image: "/seed-assets/sketch/04-a-union-b.png",
    text: "A UNION B. SUCCESS EXPANDS WHEN YOU ALLOW MORE THAN ONE CORRECT PATH."
  },
  {
    id: "5",
    number: 5,
    image: "/seed-assets/sketch/05-a-to-a4.png",
    text: "A TO A4. TRANSLATE A BLURRY IDEA INTO A FORMAT THAT CAN ACTUALLY BE SHARED."
  },
  {
    id: "6",
    number: 6,
    image: "/seed-assets/sketch/06-communication-circles.png",
    text: "COMMUNICATION CIRCLES. WHAT YOU SAY CHANGES ONCE YOU DECIDE WHO THE MESSAGE SERVES."
  },
  {
    id: "7",
    number: 7,
    image: "/seed-assets/sketch/07-motivation-matters.png",
    text: "MOTIVATION MATTERS. WHEN CAPABILITY CLUSTERS TOGETHER, DRIVE DECIDES THE OUTCOME."
  },
  {
    id: "8",
    number: 8,
    image: "/seed-assets/sketch/08-problem-solving-paradigm.png",
    text: "PROBLEM-SOLVING PARADIGM. DEFINE, SOLVE, SYSTEMATIZE. CLOSURE IS NOT THE SAME AS COMPLETION."
  },
  {
    id: "9",
    number: 9,
    image: "/seed-assets/sketch/09-the-golden-circle.png",
    text: "THE GOLDEN CIRCLE. IF THE CORE IS EMPTY, NOTHING YOU LAYER ON TOP WILL HOLD."
  },
  {
    id: "10",
    number: 10,
    image: "/seed-assets/sketch/10-vector-life.png",
    text: "VECTOR LIFE. EVERY POINT CAN STILL CHANGE DIRECTION BEFORE THE STORY ENDS."
  },
  {
    id: "11",
    number: 11,
    image: "/seed-assets/sketch/11-z-dna.png",
    text: "Z-DNA. RESILIENCE DOES NOT NEED A PERFECT HELIX TO KEEP EVOLVING."
  }
];

function readCards(): any[] {
  try {
    if (fs.existsSync(CARDS_FILE)) {
      const data = fs.readFileSync(CARDS_FILE, "utf-8");
      return JSON.parse(data);
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
  const { image, text, quote } = req.body;
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
    image: image || "", // Allow empty card state if no image is uploaded
    text: text,
    quote: typeof quote === "string" ? quote : ""
  };

  cards.push(newCard);
  writeCards(cards);
  res.status(201).json(newCard);
});

app.post("/api/cards/reset", (req, res) => {
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
  cards.splice(index, 1);
  // Re-number remaining cards to keep perfect numeric order matching index
  cards = cards.map((c, i) => ({
    ...c,
    number: i + 1
  }));
  writeCards(cards);
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
