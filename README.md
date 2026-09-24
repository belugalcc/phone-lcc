# LCC Chat

LCC Chat is a Discord-inspired browser workspace for one-to-one voice and video calls, direct messages, and a shared `#central` chat. Calls use PeerJS/WebRTC; chat is backed by Cloudflare Workers KV.

## Deploy to Cloudflare Workers

The included `wrangler.toml` binds the `LCC_KV` namespace to `751d8e73870244c5a758d0750c834acf`. From this repository, deploy with:

```bash
npx wrangler deploy
```

The Worker serves the static application and `/api/v1` from the same origin. Do not put private VAPID material in this repository. Configure it as a Worker secret if you add server-side Web Push delivery.

## API

All responses are JSON and CORS-enabled.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Service health check |
| `GET`, `POST` | `/api/v1/channels/central/messages` | Read or send shared-channel messages |
| `GET`, `POST` | `/api/v1/dms/:peerId` | Read or send direct messages; reads need `?user=:yourId` |
| `POST` | `/api/v1/notifications/subscriptions` | Store a browser Push subscription |

A message POST body is `{ "text": "Hello", "image": { "name", "type", "data" }, "author": { "id": "call-id", "name": "Display name" } }`. Text and image fields are optional individually, but every message must include at least one. Image uploads are limited to 2 MB and accept PNG, JPEG, GIF, and WebP.

## Notifications

The app registers `sw.js` and asks for browser permission in **Settings**. It stores subscriptions in `LCC_KV` so a future authenticated server-side Web Push sender can notify users while the page is closed. The push service worker displays and opens notifications.

## Call quality

Calls request 48 kHz, echo-cancelled, noise-suppressed, automatic-gain-controlled audio. For reliable calls across restrictive networks, configure a trusted TURN service in `app.js`; STUN alone cannot guarantee connectivity through every school or mobile network.

## Video calls and soundboard

Use **Video call** from the home screen or a friend row to invite the other person with camera video. The call overlay includes camera and microphone controls. The soundboard accepts custom audio uploads (up to 10 MB each) and stores them in this browser using IndexedDB. During a call, selected clips are mixed into the outgoing WebRTC audio so the other participant hears them.
