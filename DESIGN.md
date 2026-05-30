# Zealous - Project Design & Interaction Specification

This document details the exact design principles, typography pairings, grid structures, animation effects, and interactive mechanics of the **Zealous** aesthetic gallery page. Pass this specification to any AI assistant or developer to perfectly replicate the layout and interactive behavior of this curated layout.

---

## 1. Visual & Typography System

The design is built on a clean, editorial, off-white gallery aesthetics with a strong contrast between black serif and gray sans-serif text.

### Font Configurations (`src/index.css`)
We define two primary font variables in the Tailwind theme:
*   **Serif Font Pair Group (`--font-serif`)**: 
    `"Playfair Display"`, `"Noto Serif SC"`, `"Songti SC"`, `"STSong"`, `"Georgia"`, `"Baskerville"`, `serif`
    *Used for Display Headings ("Zealous"), Card Numbers, and the italicized subtitle block.*
*   **Sans-serif Font Pair Group (`--font-sans`)**: 
    `"Inter"`, `"Helvetica Neue"`, `Arial`, `"PingFang SC"`, `"Microsoft YaHei"`, `sans-serif`
    *Used for clean metadata labels, button actions, back-face secondary content, and admin controls.*

---

## 2. Layout Structure & Grid Mechanics

The page features a grid of aesthetic elements.

### The Grid Layout (`src/App.tsx`)
*   **Container Width**: Responsive main wrapping container with `max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10`.
*   **Grid Structure**: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 pb-8`.
*   **Grid Item 1 (Title Block)**:
    *   Takes up multi-column spans: `col-span-2 md:col-span-4 lg:col-span-4`.
    *   **Directives**: It **must** perfectly match the height of individual grid aspect-ratio items next to it, aligning its top and bottom edges flawlessly with the sibling images.
    *   **Structure**: Uses `p-0 flex flex-col justify-between items-center h-full min-h-[140px] md:min-h-[180px] lg:min-h-0 bg-transparent relative overflow-hidden group select-none`.
    *   **Typography Sizing inside Title Block**:
        ```tsx
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[62px] xl:text-[78px] font-serif font-black tracking-[-0.05em] lg:tracking-[-0.06em] text-neutral-900 uppercase cursor-pointer select-none transition-all active:opacity-60 leading-[0.8] mt-[-4px] lg:mt-[-6px] xl:mt-[-8px] mb-0 pt-0">
          Zealous
        </h1>
        ```
    *   **Subtitle Block**: Nested inside `mt-auto` to pin perfectly to the absolute bottom bounds of the title block container:
        ```tsx
        <div className="w-full flex flex-col items-center mt-auto">
          {/* Upper Separator Border */}
          <div className="w-full border-t border-neutral-900"></div>
          
          {/* Subtitle */}
          <p className="font-serif italic text-xs sm:text-xs md:text-sm lg:text-[11px] xl:text-xs text-neutral-950 leading-relaxed tracking-wide my-1.5 lg:my-2 px-4 text-center">
            “Zealous for the next Aha moment.”
          </p>
          
          {/* Lower Separator Border */}
          <div className="w-full border-t border-neutral-900"></div>
        </div>
        ```

---

## 3. Card Flip Mechanics & User Interaction

The display utilizes elegant 3D card flipping effects for individual cards.

### Card Properties & Elements
*   **Each Card**: Structured using a square aspect ratio `w-full aspect-square perspective-1000`.
*   **Flip States**: Managed using `flippedCards` React state.
*   **Interactive Event Handlers**:
    *   **To Flip**: Left-click activates 3D state rotation (`toggleFlip(card.id)`).
    *   **To Reset / Hover Leave**: Moving the cursor away from the card boundary **automatically resets** and unflipps the card back to the front-face. Enabled via:
        `onMouseLeave={() => setFlippedCards(prev => ({ ...prev, [card.id]: false }))}`
*   **Aesthetic Rules**:
    *   **No bottom-right navigation arrows**: Ensure there are **no secondary decal overlays** or visual arrow markers in the corner.
    *   **Card Number**: Renders in the top-left of the card's front-face with fine serif styling (`font-serif text-3xl font-light`).
    *   **Flip Text Size**: Standardized to be clean and miniature: `text-[10px] sm:text-[10px] md:text-xs tracking-wide uppercase font-semibold text-center`.
    *   **Flipping CSS Transform classes**:
        ```css
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        ```

---

## 4. Background Music (BGM) Engine

The layout incorporates a background music experience using a minimal interactive icon button within the core Title Block.

### Audio States
*   **Autoplay**: Set to **Automatic (starts playing unmuted by default)**. The initial state is `isMuted = false` in React state.
*   **Icon Representation**: Placed beautifully at top-right inside the Title Block. Contains exclusively a clean `🎵` text or emoji indicator.
*   **Active Playing State Animation**:
    *   The icon swings and pulses in size when actively unmuted, synchronized directly using a CSS keyframe loop:
        ```css
        @keyframes musicSwing {
          0%, 100% {
            transform: translateY(0) scale(1) rotate(-8deg);
          }
          50% {
            transform: translateY(-3px) scale(1.15) rotate(12deg);
          }
        }
        .animate-music-beat {
          animation: musicSwing 1.4s ease-in-out infinite;
        }
        ```
*   **Paused State Style**:
    *   When the user pauses/mutes the music, the icon transitions to a flat, non-animated state and adopts a semi-transparent grayscale visual weight: `opacity-35 grayscale`.

---

## 5. Curator Setup / Secret Admin Panel

To maintain pristine visual focus, the curator tools are hidden.
*   **Unlock Command**: Click the display title `Zealous` **5 times** sequentially to toggle on Admin Mode.
*   **Features available**: Curate grid cards, add custom captions, assign custom image inputs, and upload new soundtrack files into the active BGM server database context.
