# Zealous Integrations

This document records the external services and adapter rules that keep Zealous running in production.

## Production Hosting

- Host: Vercel
- Production domain: `zealous.magicliz.me`
- Build command: `npm run build`
- Output directory: `dist`
- SPA rewrite: non-API paths are rewritten to `index.html` by `vercel.json`.

API paths are handled by Vercel serverless functions under `api/`.

## Backend Shape

The production backend implementation lives in:

- `api/_server.ts`

Thin Vercel adapter files under `api/` export the same server. This is intentional: route logic belongs in `api/_server.ts`; adapter files exist only so Vercel can route requests correctly.

Current adapter coverage:

- `api/cards.ts` -> `GET /api/cards`, `POST /api/cards`
- `api/cards/[id].ts` -> `DELETE /api/cards/:id`
- `api/cards/reset.ts` -> `POST /api/cards/reset`
- `api/cards/upload-url.ts` -> `POST /api/cards/upload-url`
- `api/card-assets/[...path].ts` -> `GET /api/card-assets/*`
- `api/card-assets-upload/[...path].ts` -> `PUT /api/card-assets-upload/*`
- `api/bgm.ts` -> `POST /api/bgm`
- `api/bgm/status.ts` -> `GET /api/bgm/status`
- `api/bgm/active.ts` -> `GET /api/bgm/active`
- `api/bgm/reset.ts` -> `POST /api/bgm/reset`

Run this after adding or changing API routes:

```bash
npm run check:api-routes
```

## Supabase Storage

The Vercel API uses Supabase Storage as the persistent backing store.

Required environment variables:

- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: server-side key used by Vercel functions.
- `SUPABASE_BUCKET`: storage bucket name, defaulting to `zealous`.

Stored object keys:

- Cards JSON: `data/cards.json`
- Card images: `cards/images/*`
- Custom BGM metadata: `audio/bgm-meta.json`
- Custom BGM file: `audio/bgm.<extension>`

The bucket should not depend on public browser writes. The API reads and writes through the service role key.

## Admin Access

Write endpoints require the `x-admin-key` request header.

Required environment variable:

- `ADMIN_ACCESS_KEY`: server-side write key. It should match the curator answer used by the control board.

Protected operations include:

- Create card
- Delete card
- Reset cards
- Create upload URL
- Upload card asset
- Upload BGM
- Reset BGM

## Legacy EdgeOne Files

The repository still contains the older EdgeOne function entry in `cloud-functions/api/[[default]].ts`. Production for `zealous.magicliz.me` currently serves through Vercel, so Vercel route coverage and Supabase configuration are the source of truth for the live site.

Keep EdgeOne files untouched unless explicitly reviving that deployment path.

## Release-Surface Notes

Zealous is a public site with admin-only write controls. Before public release or deployment changes, check:

- Dynamic API routes reach Express, not Vercel platform `NOT_FOUND`.
- Admin write endpoints reject missing or wrong `x-admin-key`.
- Supabase service role key is only present server-side.
- Security headers remain configured in `edgeone.json` only for EdgeOne; Vercel security headers should be handled separately if needed.
