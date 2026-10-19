# MAYA AI — Full Voice Assistant

Next.js + TypeScript + OpenAI Realtime API + WebRTC.

## Prerequisites
- Node.js version supported by Next.js 15 (20.9+ recommended).
- An OpenAI API key with access to Realtime API and available API usage/billing.
- A browser with WebRTC support. Microphone access requires localhost or HTTPS.

## Install and run
1. Extract the ZIP and open a terminal in this project folder.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Put your key in `.env.local`:

   `OPENAI_API_KEY=your_real_key`

   Never use `NEXT_PUBLIC_OPENAI_API_KEY`, commit the key, or expose it in frontend code.
5. Run `npm run dev`.
6. Open `http://localhost:3000`, press start, and allow microphone access.

## Architecture
- Browser captures microphone audio and creates a WebRTC offer.
- `POST /api/realtime-call` sends the SDP offer to the Next.js backend.
- Backend uses the secret API key to call `https://api.openai.com/v1/realtime/calls`.
- Browser applies the SDP answer. Audio returns through WebRTC and transcript/status events travel through a data channel.

## Troubleshooting
- 401/403: check key, API project access, and Realtime API availability.
- 429: check quota, rate limits, and API billing.
- Microphone unavailable: use HTTPS or localhost and allow microphone permission.
- Connected but silent: check iPhone silent/volume/output route, tap “เปิดเสียงตอบกลับ”, and inspect browser/server logs.
- Model/voice unsupported: confirm current Realtime model and voice availability for your API account and update `app/api/realtime-call/route.ts`.

## Before public launch
This is a functional development starter, not a hardened public SaaS. Add authentication, server-side rate limiting, per-user quotas, abuse prevention, origin/CSRF protections appropriate to your deployment, privacy notice/consent, and cost monitoring before sharing it publicly. The endpoint must not be left open to unlimited public calls.

Official docs:
- https://developers.openai.com/api/docs/guides/voice-webrtc
- https://developers.openai.com/api/docs/guides/realtime
- https://nextjs.org/docs/app/guides/environment-variables
