# Zealous Runbook

This runbook keeps the operational facts needed to run, verify, and recover the live Zealous site.

## Live URLs

- Production site: https://zealous.magicliz.me/
- Local development: http://localhost:3000/
- If port `3000` is busy, run with another port, for example `PORT=3001 npm run dev`, then open `http://localhost:3001/`.

## Local Checks

Run these before committing or deploying API changes:

```bash
npm run lint
npm run build
```

`npm run lint` includes `npm run check:api-routes`, which verifies every Express route in `api/_server.ts` has a matching Vercel adapter file under `api/`.

## Deployment Flow

1. Confirm the release context. Treat `zealous.magicliz.me` as a public live site.
2. Run `npm run lint` and `npm run build`.
3. Create a clean, scoped git commit.
4. Push `main` to `origin`.
5. Wait for Vercel production deployment to update.
6. Run live probes against the production domain.

## Live Verification Probes

Use safe probes that do not modify production data:

```bash
curl -i https://zealous.magicliz.me/api/cards
curl -i -X DELETE https://zealous.magicliz.me/api/cards/__codex_probe_nonexistent__ -H 'x-admin-key: <ADMIN_ACCESS_KEY>'
```

Expected results:

- `GET /api/cards` returns `HTTP 200` with JSON and `x-powered-by: Express`.
- The nonexistent delete probe returns `HTTP 404` with JSON: `{"error":"Card not found."}`.
- If the delete probe returns Vercel plain text `NOT_FOUND`, the dynamic route is not reaching Express.

## Common Issues

### Delete Card Shows "Unable to delete card"

Likely causes:

- Missing Vercel adapter for `DELETE /api/cards/:id`.
- Production deployment has not rolled forward yet.
- The admin key header is missing or wrong.

Checks:

```bash
npm run check:api-routes
curl -i -X DELETE https://zealous.magicliz.me/api/cards/__codex_probe_nonexistent__ -H 'x-admin-key: <ADMIN_ACCESS_KEY>'
```

The safe delete probe should return the Express JSON `Card not found` response, not Vercel platform `NOT_FOUND`.

### API Storage Is Not Configured

If API logs show `Supabase is not configured`, verify the Vercel environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET`
- `ADMIN_ACCESS_KEY`

### Uploaded Images or BGM Fail to Load

Check that the Supabase bucket exists and the service role key can read, upload, and remove objects. The Vercel API uses the server-side Supabase service role key, not a browser client key.

## Rollback

The project uses git-backed deploys. If a production deploy is bad:

1. Identify the last known good commit.
2. Revert the bad commit or redeploy the known good commit through the hosting provider.
3. Re-run the live probes above.

Do not reset local history unless the user explicitly asks for that operation.
