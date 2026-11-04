# iG Arena game service

A separate Node.js WebSocket service used by the iG Arena browser client for guest sessions, matchmaking queues and staging-room readiness.

## Current responsibilities

- Health endpoint at GET /healthz.
- WebSocket endpoint at /ws.
- Temporary guest identities for connected clients.
- Arena and Deathmatch queues, grouped by selected map.
- Balanced Red/Blue team assignment for Arena rooms.
- Room snapshots, ready-state collection and timeout cancellation.
- Queue, room, payload-size, message-rate, connection-count and Origin checks.

## Important boundary

The browser client can connect to this service and show the queue and staging lobby. When all room members are ready, it receives room.launch-ready.

This is not yet a live multiplayer game runtime. The service does not replicate player movement, run the 3D match simulation, validate live gameplay scoring, persist accounts or store match history. The browser must never be treated as the trusted source for competitive scores.

All room and queue state is in memory and is cleared when the process restarts. Player IDs are temporary guest IDs, not verified accounts.

## Run

Requires Node.js 20.19 or newer.

From this directory:

    npm install
    npm test
    npm start

The HTTP health route is /healthz and the WebSocket route is /ws.

## Environment

- PORT — service port; defaults to 8080.
- NODE_ENV — set to production on the deployed service.
- ALLOWED_ORIGINS — comma-separated exact browser origins allowed to open WebSocket connections.

In production, configure ALLOWED_ORIGINS to the exact frontend origin. Avoid wildcard origins.

The browser client uses VITE_GAME_SERVER_URL. Copy the root .env.example to .env and set the WebSocket URL.

## Hosting layout

Deploy the root Vite web client and this Node.js service separately. The frontend can be hosted as a static site. The WebSocket service requires a Node.js host that supports long-lived WebSocket connections.

The next gameplay milestone is the server-authoritative 3D match runtime: player presence and movement state, replicated match phase, and validated score events.
