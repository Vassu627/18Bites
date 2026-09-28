# 18Bites

Cricket-ground food pre-ordering: schedule by expected finish time, kitchen dashboard, rider GPS tracking, delivery OTP.

## Stack

- **apps/web** — Next.js 14 (player, kitchen, rider, admin)
- **apps/api** — Express + Socket.io
- **packages/db** — Prisma + PostgreSQL
- **packages/shared** — Zod schemas and types

## Quick start

1. Copy `.env.example` to `.env` in the repo root.
2. Start Postgres: `docker compose up -d`
3. Install: `npm install` (from repo root)
4. Database: `npm run db:push` then `npm run db:seed`
5. Build shared: `npm run build --workspace=@18bites/shared`
6. Run API: `npm run dev:api`
7. Run web: `npm run dev:web`

- Web: http://localhost:3000  
- API: http://localhost:4000  

### Demo accounts (after seed)

| Role    | Login |
|---------|--------|
| Admin   | admin@18bites.local / admin123 |
| Kitchen | kitchen@18bites.local / kitchen123 |
| Rider   | +919999000001 (OTP in API log when `SMS_PROVIDER=mock`) |
| Player  | any phone + OTP from API log |

## Deployment notes

- Set `JWT_SECRET`, `DATABASE_URL`, `SMS_PROVIDER` (msg91 or twilio), `CORS_ORIGIN`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`.
- Optional: `NEXT_PUBLIC_MAPBOX_TOKEN` for static map on order tracking.
- Refresh recommendations: `npm run recommendations:refresh --workspace=@18bites/api`
