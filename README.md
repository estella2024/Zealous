<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Zealous

Zealous is a lightweight gallery site with a front-end control board and a file-backed Node API for gallery data and soundtrack uploads.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`
3. Open the main site:
   [http://localhost:3000](http://localhost:3000)

## Collaboration workflow

Use the main site in the built-in browser when discussing visual changes. When sharing progress, always provide a concrete browser-viewable address and prefer the simplest working address instead of adding extra preview-only entry points unless they are truly needed.

## Vercel API routing

The Vercel deployment keeps the backend implementation in `api/_server.ts`. Files under `api/` are thin Vercel route adapters that export that same server.

When adding or changing an Express route in `api/_server.ts`, make sure the matching adapter file exists. Run `npm run check:api-routes` or `npm run lint` before deploying; the check fails if a Vercel adapter is missing.

Current route families:

- Cards: `api/cards.ts`, `api/cards/[id].ts`, `api/cards/reset.ts`, `api/cards/upload-url.ts`
- Card assets: `api/card-assets/[...path].ts`, `api/card-assets-upload/[...path].ts`
- Background music: `api/bgm.ts`, `api/bgm/status.ts`, `api/bgm/active.ts`, `api/bgm/reset.ts`
