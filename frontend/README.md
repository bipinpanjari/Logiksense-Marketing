# Logiksense Marketing Frontend (Next.js)

## Stack
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn-style UI primitives

## Setup
1. Install dependencies:
   - `npm install`
2. Configure env:
   - Copy `.env.example` to `.env`
   - Set `NEXT_PUBLIC_API_URL`
3. Run development:
   - `npm run dev`

## Commands
- `npm run dev` - run app on port 3001
- `npm run build` - production build
- `npm run start` - run production server
- `npm run lint` - lint checks

## Migration Notes
- New routes are implemented in `app/` with App Router.
- Design tokens are centralized in `app/globals.css`.
- Tailwind semantic mapping is in `tailwind.config.ts`.
- Auth/session logic is centralized in `components/providers/auth-provider.tsx`.
- API auth fetching is centralized in `lib/api-client.ts`.
- All legacy `src/pages/*` files have been removed - every route is now a native Next.js App Router page under `app/`.

