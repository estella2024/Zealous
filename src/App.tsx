import React, { useEffect, useRef, useState } from "react";
import {
  EyeOff,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Card } from "./types";

export default function App() {
  const MAX_CARD_IMAGE_BYTES = 850 * 1024;
  const MAX_CARD_IMAGE_DIMENSION = 1600;
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [hiddenCardIds, setHiddenCardIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);
  const [curatorAnswer, setCuratorAnswer] = useState("");
  const [authError, setAuthError] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadQuote, setUploadQuote] = useState("");
  const [uploadImageFile, setUploadImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [bgmUrl, setBgmUrl] = useState<string | null>(null);
  const [hasCustomBgm, setHasCustomBgm] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasStartedMusic, setHasStartedMusic] = useState(false);
  const [isBgmUploading, setIsBgmUploading] = useState(false);
  const [bgmUploadError, setBgmUploadError] = useState<string | null>(null);
  const [pendingAudioData, setPendingAudioData] = useState("");
  const [pendingAudioName, setPendingAudioName] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const clearImageSelection = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setUploadImageFile(null);
    setImagePreview("");
  };

  const readErrorMessage = async (response: Response, fallback: string) => {
    try {
      const result = await response.json();
      if (typeof result?.error === "string" && result.error.length > 0) {
        return result.error;
      }
    } catch (_error) {
      // Ignore JSON parsing failures and fall back to the default message.
    }

    return fallback;
  };

  const blobToFile = (blob: Blob, filename: string) => {
    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    const stem = filename.replace(/\.[^.]+$/, "") || "card-image";
    return new File([blob], `${stem}.${extension}`, { type: blob.type });
  };

  const loadImageElement = (file: File) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Unable to read the selected image."));
      };

      image.src = objectUrl;
    });

  const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
    new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    });

  const prepareImageForUpload = async (file: File) => {
    if (file.size <= MAX_CARD_IMAGE_BYTES) {
      return file;
    }

    const image = await loadImageElement(file);
    let width = image.naturalWidth || image.width;
    let height = image.naturalHeight || image.height;
    const scale = Math.min(1, MAX_CARD_IMAGE_DIMENSION / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to optimize the selected image.");
    }

    const mimeTypes = ["image/webp", "image/jpeg"];

    for (let attempt = 0; attempt < 6; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      for (const mimeType of mimeTypes) {
        for (const quality of [0.88, 0.8, 0.72, 0.64, 0.56, 0.48]) {
          const blob = await canvasToBlob(canvas, mimeType, quality);
          if (blob && blob.size <= MAX_CARD_IMAGE_BYTES) {
            return blobToFile(blob, file.name);
          }
        }
      }

      width = Math.max(640, Math.round(width * 0.82));
      height = Math.max(640, Math.round(height * 0.82));
    }

    throw new Error("This image is still too large after optimization. Please export a smaller file and try again.");
  };

  const fetchCards = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/cards");
      if (!response.ok) {
        throw new Error("Failed to fetch gallery cards.");
      }
      const data = (await response.json()) as Card[];
      const sorted = data.sort((a, b) => a.number - b.number);
      setCards(sorted);
      setHiddenCardIds((prev) => {
        const next: Record<string, boolean> = {};
        for (const card of sorted) {
          if (prev[card.id]) {
            next[card.id] = true;
          }
        }
        return next;
      });
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Unable to connect to the Zealous server. Please refresh or retry.");
    } finally {
      setLoading(false);
    }
  };

  const checkBgmStatus = async () => {
    try {
      const response = await fetch("/api/bgm/status");
      if (!response.ok) return null;
      const data = await response.json();
      setHasCustomBgm(Boolean(data.hasCustom));
      if (typeof data.url === "string" && data.url.length > 0) {
        setBgmUrl(data.url);
      }
      return data;
    } catch (err) {
      console.error("Failed to query background music status.", err);
      return null;
    }
  };

  const handleControlBoardClick = () => {
    if (isAdminMode) {
      setIsAdminOpen((prev) => !prev);
      return;
    }
    setAuthError("");
    setCuratorAnswer("");
    setIsAuthPromptOpen(true);
  };

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (curatorAnswer.trim() === "21877273126080") {
      setIsAdminMode(true);
      setIsAdminOpen(true);
      setIsAuthPromptOpen(false);
      setAuthError("");
      return;
    }
    setAuthError("Incorrect answer. Access denied.");
  };

  useEffect(() => {
    fetchCards();
    checkBgmStatus();

    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "true") {
      setIsAuthPromptOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!bgmUrl) return;

    const audio = new Audio(bgmUrl);
    audio.loop = true;
    audio.volume = 0.5;
    audio.muted = isMuted;
    audioRef.current = audio;

    const playAttempt = audio.play();
    if (playAttempt !== undefined) {
      playAttempt
        .then(() => setHasStartedMusic(true))
        .catch((err) => {
          console.log("Autoplay prevented. Music will trigger on first user click.", err);
          setHasStartedMusic(false);
        });
    }

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [bgmUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    const handleFirstClick = () => {
      if (!audioRef.current || hasStartedMusic) return;
      audioRef.current
        .play()
        .then(() => setHasStartedMusic(true))
        .catch((err) => console.log("Play failed on interaction", err));
    };

    window.addEventListener("click", handleFirstClick);
    window.addEventListener("touchstart", handleFirstClick);

    return () => {
      window.removeEventListener("click", handleFirstClick);
      window.removeEventListener("touchstart", handleFirstClick);
    };
  }, [hasStartedMusic]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (!nextMute && audioRef.current?.paused) {
      audioRef.current
        .play()
        .then(() => setHasStartedMusic(true))
        .catch((err) => console.log(err));
    }
  };

  const handleAudioSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];

    if (
      !file.type.startsWith("audio/") &&
      !file.name.endsWith(".mp3") &&
      !file.name.endsWith(".wav") &&
      !file.name.endsWith(".m4a")
    ) {
      alert("Please select a valid audio file in MP3, WAV, or M4A format.");
      return;
    }

    setBgmUploadError(null);
    setPendingAudioName(file.name);

    const reader = new FileReader();
    reader.onerror = () => {
      setBgmUploadError("Failed to read the selected audio file.");
      setPendingAudioData("");
      setPendingAudioName("");
    };
    reader.onload = () => {
      const base64Data = reader.result as string;
      setPendingAudioData(base64Data);
    };

    reader.readAsDataURL(file);
  };

  const handleAudioUpload = async () => {
    if (!pendingAudioData) {
      setBgmUploadError("Please select an audio file first.");
      return;
    }

    setIsBgmUploading(true);
    setBgmUploadError(null);

    try {
      const extension = pendingAudioName.includes(".") ? `.${pendingAudioName.split(".").pop()?.toLowerCase()}` : ".mp3";
      const response = await fetch("/api/bgm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: pendingAudioData, extension }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Audio upload rejected by the server.");
      }

      const data = await response.json();
      if (typeof data.url === "string" && data.url.length > 0) {
        setBgmUrl(data.url);
      }
      await checkBgmStatus();
      setHasCustomBgm(true);
      setPendingAudioData("");
      setPendingAudioName("");
      alert("Zealous soundtrack successfully uploaded.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload audio.";
      setBgmUploadError(message);
    } finally {
      setIsBgmUploading(false);
    }
  };

  const handleResetBgm = async () => {
    try {
      setIsBgmUploading(true);
      const response = await fetch("/api/bgm/reset", { method: "POST" });
      if (!response.ok) {
        throw new Error("Could not reset soundtrack.");
      }
      const data = await response.json();
      if (typeof data.url === "string" && data.url.length > 0) {
        setBgmUrl(data.url);
      }
      await checkBgmStatus();
      setHasCustomBgm(false);
      setPendingAudioData("");
      setPendingAudioName("");
      alert("Background music restored to the default track.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not reset soundtrack.";
      alert(message);
    } finally {
      setIsBgmUploading(false);
    }
  };

  const toggleFlip = (id: string) => {
    setFlippedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleResetDefaults = async () => {
    if (!window.confirm("Are you sure you want to reset all cards to the original 12 design templates?")) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/cards/reset", { method: "POST" });
      if (!response.ok) {
        throw new Error("Could not reset templates.");
      }
      const result = await response.json();
      setCards(result.cards as Card[]);
      setFlippedCards({});
      setHiddenCardIds({});
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failure resetting cards. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file.");
      return;
    }

    setIsPreparingImage(true);

    try {
      const preparedFile = await prepareImageForUpload(file);

      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }

      setUploadImageFile(preparedFile);
      setImagePreview(URL.createObjectURL(preparedFile));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to prepare the selected image.";
      alert(message);
    } finally {
      setIsPreparingImage(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files?.[0]) {
      void processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      void processFile(e.target.files[0]);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) {
      alert("Please provide the card's flipside title.");
      return;
    }

    if (isPreparingImage) {
      alert("The image is still being optimized. Please wait a moment and try again.");
      return;
    }

    setIsSubmitting(true);
    try {
      let imageKey = "";

      if (uploadImageFile) {
        const uploadUrlResponse = await fetch("/api/cards/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: uploadImageFile.name,
            contentType: uploadImageFile.type || "application/octet-stream",
          }),
        });

        if (!uploadUrlResponse.ok) {
          throw new Error(await readErrorMessage(uploadUrlResponse, "Unable to prepare image upload."));
        }

        const uploadTarget = (await uploadUrlResponse.json()) as { url: string; key: string };
        const uploadResponse = await fetch(uploadTarget.url, {
          method: "PUT",
          body: uploadImageFile,
          headers: {
            "Content-Type": uploadImageFile.type || "application/octet-stream",
          },
        });

        if (!uploadResponse.ok) {
          throw new Error("Unable to upload the image file.");
        }

        imageKey = uploadTarget.key;
      }

      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageKey,
          text: uploadTitle.trim(),
          quote: uploadQuote.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Unable to publish new card."));
      }

      const published = (await response.json()) as Card;
      setCards((prev) => [...prev, published]);
      setUploadTitle("");
      setUploadQuote("");
      clearImageSelection();
      alert(`Card #${published.number} published successfully.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publishing failed.";
      alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHideCard = (cardId: string) => {
    setHiddenCardIds((prev) => ({
      ...prev,
      [cardId]: true,
    }));
    setFlippedCards((prev) => ({
      ...prev,
      [cardId]: false,
    }));
  };

  const handleRestoreCard = (cardId: string) => {
    setHiddenCardIds((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
  };

  const handleDeleteCard = async (cardId: string, cardNumber: number) => {
    if (!window.confirm(`Delete card #${cardNumber}? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Unable to delete card.");
      }

      setCards((prev) => prev.filter((card) => card.id !== cardId));
      setFlippedCards((prev) => {
        const next = { ...prev };
        delete next[cardId];
        return next;
      });
      setHiddenCardIds((prev) => {
        const next = { ...prev };
        delete next[cardId];
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete card.";
      alert(message);
    }
  };

  const visibleCards = cards.filter((card) => !hiddenCardIds[card.id]);
  const hiddenCards = cards.filter((card) => hiddenCardIds[card.id]);
  const showCardActions = isAdminMode && isAdminOpen;

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-neutral-900 font-sans antialiased selection:bg-neutral-200">
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
        {isAuthPromptOpen && (
          <section className="mb-8 border border-neutral-200 bg-[#fffefd] px-5 py-4 shadow-[0_1px_1px_rgba(20,20,20,0.04),0_2px_10px_rgba(20,20,20,0.035)] md:px-7 md:py-5">
            <div className="flex justify-end pb-1">
              <button
                onClick={() => {
                  setIsAuthPromptOpen(false);
                  setAuthError("");
                }}
                className="flex h-8 w-8 items-center justify-center border border-transparent text-neutral-300 transition hover:border-neutral-200 hover:text-neutral-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUnlockSubmit} className="mt-2 flex items-stretch gap-3">
              <label className="flex-1">
                <input
                  type="password"
                  value={curatorAnswer}
                  onChange={(e) => setCuratorAnswer(e.target.value)}
                  className="h-full w-full border border-neutral-300 bg-transparent px-4 py-3 font-mono text-[15px] tracking-[0.05em] text-neutral-900 outline-none transition focus:border-neutral-900"
                  placeholder="Eliza的两个telephone是什么？"
                />
              </label>
              <button
                type="submit"
                aria-label="Unlock editor"
                className="flex h-[52px] w-[52px] items-center justify-center border border-neutral-900 bg-neutral-900 text-[24px] text-white transition hover:bg-neutral-800"
              >
                →
              </button>
            </form>

            {authError && <p className="mt-2 font-mono text-[12px] text-red-700">{authError}</p>}
          </section>
        )}

        {isAdminMode && isAdminOpen && (
          <section className="admin-shell mb-10 border border-neutral-900 bg-[#fffefd] px-5 pb-5 pt-4 shadow-[0_1px_1px_rgba(20,20,20,0.04),0_2px_10px_rgba(20,20,20,0.035)] md:px-9 md:pb-7 md:pt-5">
            <div className="mb-5 flex justify-end pb-1">
              <button
                onClick={() => setIsAdminOpen(false)}
                className="flex h-9 w-9 items-center justify-center border border-transparent text-neutral-300 transition hover:border-neutral-200 hover:text-neutral-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-8 xl:grid-cols-[1.42fr_0.9fr]">
              <form onSubmit={handleFormSubmit} className="space-y-8">
                <div className="pt-5">
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`relative flex h-[196px] border px-8 py-8 text-center transition-all ${
                      dragActive ? "border-neutral-900 bg-[#f5f4f0]" : "border-neutral-300 bg-[#fffefd]"
                    }`}
                  >
                    {imagePreview ? (
                      <div className="flex h-full flex-col items-center justify-center gap-4 md:flex-row md:justify-start">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="h-28 w-28 border border-neutral-200 object-cover"
                        />
                        <div className="text-left">
                          <p className="font-serif text-[17px] font-semibold italic text-neutral-900 md:text-[18px]">Image loaded successfully</p>
                          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">1:1 ratio is maintained for the gallery card.</p>
                          <button
                            type="button"
                            onClick={clearImageSelection}
                            className="mt-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-700 underline"
                          >
                            Remove image
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center">
                        <Upload className="mb-4 h-11 w-11 text-neutral-400" />
                        <p className="font-serif text-[17px] font-semibold italic text-neutral-800 md:text-[18px]">
                          Drag and drop your 1:1 image here, or{" "}
                          <span className="underline">browse files</span>
                        </p>
                        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-400">
                          Supports PNG, JPG, or GIF. High-resolution files are scaled.
                        </p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                      </div>
                    )}
                  </div>

                </div>

                <div className="space-y-4 pt-5">
                  <div className="space-y-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                      Flipside Title
                    </p>
                    <textarea
                      required
                      rows={2}
                      placeholder="INPUT THE FLIPSIDE TITLE..."
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      className="w-full border border-neutral-300 bg-transparent px-6 py-5 text-center font-mono text-[11px] tracking-[0.08em] text-neutral-500 outline-none transition placeholder:text-center placeholder:font-mono placeholder:text-[11px] placeholder:tracking-[0.08em] placeholder:text-neutral-300 focus:border-neutral-900"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                      Flipside Quote
                    </p>
                    <textarea
                      rows={4}
                      placeholder="INPUT THE SUPPORTING QUOTE OR INTRO..."
                      value={uploadQuote}
                      onChange={(e) => setUploadQuote(e.target.value)}
                      className="w-full border border-neutral-300 bg-transparent px-6 py-6 text-center font-mono text-[11px] tracking-[0.08em] text-neutral-500 outline-none transition placeholder:text-center placeholder:font-mono placeholder:text-[11px] placeholder:tracking-[0.08em] placeholder:text-neutral-300 focus:border-neutral-900"
                    />
                  </div>
                </div>

                  <button
                  type="submit"
                  disabled={isSubmitting || isPreparingImage}
                  className="flex w-full items-center justify-center gap-3 border border-neutral-900 bg-neutral-900 px-6 py-5 font-mono text-[13px] font-bold uppercase tracking-[0.22em] text-white transition hover:bg-neutral-800 disabled:opacity-60"
                >
                  {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {isPreparingImage ? "Optimizing Image..." : isSubmitting ? "Publishing Content..." : "Publish to Gallery Grid"}
                </button>
              </form>

              <aside className="space-y-6 pt-5">
                <div className="h-[196px] border border-neutral-300 bg-[#fffefd]">
                  <label className="relative flex h-full cursor-pointer flex-col items-center justify-center px-8 py-8 text-center">
                    <Upload className="mb-4 h-11 w-11 text-neutral-400" />
                    <span className="font-serif text-[17px] font-semibold italic text-neutral-800 md:text-[18px]">
                      {isBgmUploading ? "Processing..." : "Select Audio File"}
                    </span>
                    <span className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-400">MP3, WAV, or M4A formats</span>
                    {pendingAudioName && (
                      <span className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
                        {pendingAudioName}
                      </span>
                    )}
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioSelection}
                      disabled={isBgmUploading}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>

                  {bgmUploadError && (
                    <p className="mx-8 mb-8 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{bgmUploadError}</p>
                  )}

                  {hasCustomBgm && (
                    <button
                      type="button"
                      onClick={handleResetBgm}
                      disabled={isBgmUploading}
                      className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-700 underline"
                    >
                      Clear custom / 回到默认 BGM
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAudioUpload}
                  disabled={isBgmUploading || !pendingAudioData}
                  className="flex w-full items-center justify-center gap-3 border border-neutral-900 bg-neutral-900 px-6 py-5 font-mono text-[13px] font-bold uppercase tracking-[0.22em] text-white transition hover:bg-neutral-800 disabled:opacity-60"
                >
                  {isBgmUploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {isBgmUploading ? "Publishing Audio..." : "Publish Audio"}
                </button>

                <section className="border border-neutral-300 bg-[#fffefd] px-5 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">Hidden Cards</p>
                      <p className="mt-1 font-serif text-[15px] italic text-neutral-800">
                        {hiddenCards.length === 0 ? "No cards are hidden." : `${hiddenCards.length} hidden card${hiddenCards.length > 1 ? "s" : ""}`}
                      </p>
                    </div>
                  </div>

                  {hiddenCards.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {hiddenCards.map((card) => (
                        <div
                          key={card.id}
                          className="flex items-center justify-between gap-3 px-1 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border border-neutral-200 bg-white">
                              {card.image ? (
                                <img
                                  src={card.image}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span className="px-2 text-center font-mono text-[8px] uppercase tracking-[0.12em] text-neutral-400">
                                  No Image
                                </span>
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                                Card #{card.number}
                              </p>
                              <p className="truncate pt-1 font-serif text-[14px] text-neutral-900">
                                {card.text}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRestoreCard(card.id)}
                            className="shrink-0 px-1 py-0.5 font-mono text-[9px] normal-case tracking-[0.04em] text-neutral-400 decoration-neutral-300 underline underline-offset-[1px] transition hover:text-neutral-600 hover:decoration-neutral-500"
                          >
                            Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>

              </aside>
            </div>
          </section>
        )}

        {error && (
          <div className="mb-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3 pb-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            <div className="col-span-2 min-h-[140px] animate-pulse bg-neutral-100 md:col-span-4 md:min-h-[180px] lg:min-h-0" />
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="aspect-square animate-pulse rounded bg-neutral-100" />
            ))}
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={handleControlBoardClick}
              className="mb-4 inline-flex items-center gap-2 font-serif text-[16px] italic tracking-[0.01em] text-neutral-400 underline underline-offset-[3px] transition hover:text-neutral-600"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Control Board
            </button>

            <div className="grid grid-cols-2 gap-3 pb-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
              <div className="col-span-2 flex min-h-[140px] flex-col justify-between bg-transparent p-0 md:col-span-4 md:min-h-[180px] lg:min-h-0">
                <div className="relative flex h-full flex-col items-center justify-between">
                  <button
                    onClick={toggleMute}
                    id="bgm_mute_toggle"
                    className={`absolute right-2 top-1.5 z-20 bg-transparent p-0 text-lg transition-all duration-300 md:text-2xl ${
                      isMuted ? "opacity-35 grayscale" : "animate-music-beat opacity-100"
                    }`}
                    title={isMuted ? "Unmute Background Music" : "Mute Background Music"}
                  >
                    🎵
                  </button>

                  <div className="flex h-full w-full flex-col justify-between items-center">
                    <h1
                    className="font-serif text-4xl font-black uppercase leading-[0.8] tracking-[-0.05em] text-neutral-900 transition-all active:opacity-60 sm:text-5xl md:text-6xl lg:text-[62px] lg:tracking-[-0.06em] xl:text-[78px]"
                      title="Zealous"
                    >
                      Zealous
                    </h1>

                    <div className="mt-auto flex w-full flex-col items-center">
                      <div className="w-full border-t border-neutral-900" />
                      <p className="my-1.5 px-4 text-center font-serif text-xs italic leading-relaxed tracking-wide text-neutral-950 sm:text-xs md:text-sm lg:my-2 lg:text-[11px] xl:text-xs">
                        Zealous for the next Aha moment.
                      </p>
                      <div className="w-full border-t border-neutral-900" />
                    </div>
                  </div>
                </div>
              </div>

              {visibleCards.map((card, index) => {
                const isFlipped = Boolean(flippedCards[card.id]);
                const displayNumber = index + 1;
                return (
                  <div
                    key={card.id}
                    onClick={() => toggleFlip(card.id)}
                    onMouseLeave={() => setFlippedCards((prev) => ({ ...prev, [card.id]: false }))}
                    className="relative w-full cursor-pointer select-none perspective-1000"
                    title="Click to flip card"
                  >
                    {showCardActions ? (
                      <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={`Hide card ${displayNumber}`}
                          title="Hide this card on the front end"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleHideCard(card.id);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-[rgba(255,254,253,0.95)] text-neutral-700 shadow-sm transition hover:border-neutral-900 hover:text-neutral-950"
                        >
                          <EyeOff className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete card ${displayNumber}`}
                          title="Delete this card"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteCard(card.id, displayNumber);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-[rgba(255,254,253,0.95)] text-neutral-700 shadow-sm transition hover:border-neutral-900 hover:text-neutral-950"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}

                    <div className={`relative aspect-square w-full transform-style-3d transition-transform duration-700 ${isFlipped ? "rotate-y-180" : ""}`}>
                      <div className="card-frame absolute inset-0 flex h-full w-full flex-col justify-between overflow-hidden rounded-[6px] backface-hidden">
                        <span className="absolute left-[10px] top-[4px] z-10 font-serif text-[14px] font-normal leading-none text-neutral-950 md:text-[15px]">
                          {displayNumber}
                        </span>
                        {card.image ? (
                          <div className="h-full w-full overflow-hidden">
                            <img
                              src={card.image}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.015]"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center bg-white text-[10px] italic text-neutral-400">
                            No Image Asset
                          </div>
                        )}
                      </div>

                      <div className="card-frame absolute inset-0 flex h-full w-full rotate-y-180 flex-col justify-between overflow-y-auto rounded-[6px] bg-white px-4 pb-4 pt-3 backface-hidden">
                        <div className="flex flex-1 flex-col items-center justify-start gap-3 pt-3">
                          <p className="whitespace-pre-wrap text-center font-serif text-[10px] font-semibold leading-relaxed tracking-[0.02em] text-neutral-900 sm:text-[10px] md:text-[12px]">
                            {card.text}
                          </p>
                          {card.quote ? (
                            <p className="max-w-[18ch] whitespace-pre-wrap text-center font-serif text-[10px] leading-relaxed text-neutral-600 sm:text-[10px] md:text-[12px]">
                              {card.quote}
                            </p>
                          ) : null}
                        </div>

                        <div className="border-t border-neutral-100 pt-1.5 text-center font-mono text-[9px] uppercase tracking-widest text-neutral-400">
                          Zealous Catalyst
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
