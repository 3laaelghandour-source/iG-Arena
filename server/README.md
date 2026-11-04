# iG Arena game service

A separate Node.js service for player accounts, guest sessions, matchmaking queues and staging-room readiness.

## HTTP API

- GET /healthz — service health.
- POST /api/auth/register — create a username and password account.
- POST /api/auth/login — create a seven-day session.
- POST /api/auth/logout — invalidate the current session token.
- GET /api/me — return the authenticated player's public profile and stats.
- GET /api/leaderboard?limit=20 — public XP leaderboard.

Account requests use JSON. Authenticated requests send the session token in the Authorization header as a Bearer token. Tokens are returned once at login or registration; the web client keeps the token in sessionStorage and clears it when the browser tab session ends.

Usernames are 3–16 letters, numbers or underscores. Passwords must be at least 8 characters. Passwords are hashed with Node's built-in scrypt and random per-account salts. Password hashes and salts are never returned by the API. Login has a basic per-IP attempt limit.

## WebSocket staging

- WebSocket endpoint at /ws.
- Temporary guest identity for queue-only connections.
- Arena and Deathmatch queues grouped by selected map.
- Balanced Red/Blue team assignment for Arena rooms.
- Room snapshots, ready-state collection and timeout cancellation.

The browser client can connect to this service and show the queue and staging lobby. When all room members are ready, it receives room.launch-ready.

This is not yet a live multiplayer game runtime. The service does not replicate player movement or run the 3D match simulation. Match result recording exists as a server-side store method but is not connected to live matches yet.

## Persistence

Player profiles and sessions are saved in DATA_DIR/players.json using atomic file replacement. Mount persistent storage at DATA_DIR on the hosting provider. Queue and staging-room state remains in memory and is cleared when the process restarts.

Player IDs created by the WebSocket queue are still temporary guest IDs. Account login is available through the HTTP API; account identity is not yet bound to a WebSocket game session.

## Run

Requires Node.js 20.19 or newer.

From this directory:

    npm install
    npm test
    npm start

## Environment

- PORT — service port; defaults to 8080.
- DATA_DIR — persistent directory for player data; defaults to ./data.
- NODE_ENV — set to production on the deployed service.
- ALLOWED_ORIGINS — comma-separated exact browser origins permitted to call the HTTP API and open WebSocket connections.

In production, configure ALLOWED_ORIGINS to the exact frontend origin. Avoid wildcard origins.

The browser client uses VITE_GAME_SERVER_URL for WebSocket staging and VITE_GAME_API_URL for HTTP account/profile requests. Copy the root .env.example to .env for local development.

## Hosting layout

Deploy the root Vite web client and this Node.js service separately. The WebSocket service requires a Node.js host that supports long-lived WebSocket connections and a persistent volume for DATA_DIR.
