
# Production Readiness Plan — connect-start

Big picture: this project has a working Express + Prisma + Postgres backend for auth/users/finance, but the rest of the admin surface (Courses, News, Competitions, Gallery, Board) is still bolted onto local mock data / localStorage with fake short IDs (`c1`, `i2`, `b3`). I'll close every gap end-to-end (schema → CRUD routes → frontend fetch), keep the Arabic UI and layout exactly as-is, and harden the Docker/Nginx/seed setup for a plain Node VPS deployment.

## Step 1 — Lock in build target
- Verify `vite.config.ts` keeps `nitro.preset = "node-server"` and add a code comment warning against regeneration.
- Confirm `Dockerfile` runs `node .output/server/index.mjs` and doesn't drift back to Cloudflare defaults.

## Step 2 — Prisma schema additions
- `User`: add `birthDate DateTime? @db.Date` and `photoUrl String?` (verify already-applied fix; migrate if missing).
- `News`: no change needed.
- `Competition` / `Gallery`: already present, add missing fields (`Gallery.url` used as public URL — keep, allow `null` caption if needed).
- New `BoardMember` model: `id uuid`, `fullName`, `birthDate DateTime?`, `phone?`, `position` (string, since Arabic role labels vary), `photoUrl?`, `orderIndex Int?`, `createdAt`.
- Run `prisma migrate dev` / update generated client. Ensure `GRANT`s not needed (this is direct Prisma → Postgres, not Supabase).

## Step 3 — Backend REST routes (Express)
Add to `backend/src/routes/admin.js` and `backend/src/routes/public.js`:

- **Courses**
  - Public: `GET /api/courses` (published only, join instructor name + enrolled count).
  - Admin: `GET /api/admin/courses`, `PUT /api/admin/courses/:id`, `DELETE /api/admin/courses/:id`, `POST /api/admin/courses/:id/unenroll`.
- **News**
  - Public: `GET /api/news`.
  - Admin: `GET /api/admin/news`, `PUT /api/admin/news/:id`, `DELETE /api/admin/news/:id`.
- **Competitions**
  - Public: `GET /api/competitions`.
  - Admin: full CRUD `GET/POST/PUT/DELETE /api/admin/competitions`.
- **Gallery**
  - Public: `GET /api/gallery`.
  - Admin: full CRUD. Accept image `url` field (URL string). No file upload server in scope — document that operator supplies hosted URLs; leave a TODO stub for future upload endpoint.
- **Board**
  - Public: `GET /api/board`.
  - Admin: full CRUD `GET/POST/PUT/DELETE /api/admin/board`.

All routes use Zod validation, return real UUIDs, and match the field names the frontend already uses.

## Step 4 — Frontend rewiring
For each store, replace the localStorage-only pattern with the same `ensureLoaded()` + refresh-after-mutation pattern already used in `people-store.ts`:

- `src/lib/content-store.ts` (courses, competitions, gallery — split if needed) → fetch real data from `/api/...` on mount, refresh after mutation.
- `src/lib/news-store.ts` → same treatment; drop `DEFAULT_NEWS` seed.
- New `src/lib/board-store.ts` (or extend people-store) → real API.
- `src/lib/people-store.ts` → wire `courseIds` selection to real `POST /courses/:id/enroll` and new `POST /courses/:id/unenroll`; `instructorId` on courses for instructors.
- Remove all hardcoded fake IDs (`c1`..`c6`, `i1`..`i9`, `b1`..`b9`) from defaults.
- `src/lib/mock-data.ts`: keep only pure UI helpers (`CATEGORY_LABEL`, type exports); delete the fake `COURSES`, `NEWS`, `COMPETITIONS`, `GALLERY`, `BOARD` arrays (or keep as `[]` if any pure-static consumer remains).
- Public pages (`courses.tsx`, `news.tsx`, `competitions.tsx`, `gallery.tsx`, `about.tsx` for board) → fetch from public endpoints via `apiFetch`. Preserve exact Arabic copy, layout, and styling.

## Step 5 — CORS & env
- `backend/src/index.js`: keep strict origin list from `CORS_ORIGINS`, keep `credentials: true`, reject `*` when credentials enabled. Add a startup warning if `CORS_ORIGINS` still contains `your-domain.tn`.
- `backend/.env.example`: default `CORS_ORIGINS=http://localhost:3000,http://localhost:8080` for dev-out-of-the-box; production placeholder documented in README.

## Step 6 — Seed hardening
- `backend/src/db/seed.js`:
  - Require `SEED_ADMIN_PASSWORD` env var; if unset, generate a random 20-char password and print it **once** with a red warning banner.
  - Print a "CHANGE THIS PASSWORD IMMEDIATELY" notice regardless.
- README: add explicit post-deploy step.

## Step 7 — Deployment hardening
- `docker-compose.yml`: `restart: unless-stopped` on every service; bind `db` (5432) and `api` (4000) to `127.0.0.1` only; only `nginx` published on 80/443.
- `deploy/nginx.conf.example`: add HTTPS server block template with Let's Encrypt paths and HTTP→HTTPS redirect; document `certbot` step in README.
- README: add sections for backups (`pg_dump` cron example), log rotation (`docker compose logs` + `logrotate` note), and the full post-deploy checklist from the brief.

## Step 8 — Verification
- Run `bun run build` (or equivalent) to confirm the frontend compiles.
- Run `bunx tsgo --noEmit` on frontend for type check.
- Grep for any surviving `mock-data` imports or `c1|i1|b1` literals and fix.

## Technical notes
- Backend is Express + Prisma (Postgres), NOT Supabase / TanStack server functions — GRANT rules and `requireSupabaseAuth` do not apply here.
- All new admin routes go through the existing `authRequired` + `requireRole("admin")` middleware chain in `backend/src/index.js`.
- Frontend fetches use existing `apiFetch` from `src/lib/api.ts` which already handles the JWT.
- No UI redesign — Arabic RTL layout, fonts, colors, and copy stay identical; only the data source changes.

Expected file changes: ~6 backend files, ~10 frontend files, `schema.prisma`, `docker-compose.yml`, `deploy/nginx.conf.example`, `README.md`, one Prisma migration.
