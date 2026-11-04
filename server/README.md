# iG Arena game service

A separate Node.js WebSocket service for guest sessions, matchmaking queues and room readiness.

## Current responsibilities

- Health endpoint at GET /healthz.
- WebSocket endpoint at /ws.
- Temporary guest identities for connected clients.
- Arena and Deathmatch queues, grouped by selected map.
- Balanced Red/Blue team assignment for Arena rooms.
- Room snapshots and ready-state collection.
- Queue, room, payload-size, message-rate, connection-count and Origin checks.

## Important boundary

This service currently creates and manages staging rooms only. When all members are ready, it emits room.launch-ready. It does not yet replicate player movement, run the 3D match simulation, validate in-game scoring, persist accounts or store match history. Do not present it as a complete multiplayer runtime yet.

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
- ALLOWED_ORIGINS — comma-separated exact browser origins allowed to open WebSocket connections, for example the production frontend origin.

In production, configure ALLOWED_ORIGINS to the exact frontend origin. Avoid wildcard origins.

## Hosting layout

Deploy the root web client and this service separately. The frontend remains a Vite static site. The WebSocket service needs a Node.js host that supports long-lived WebSocket connections.

The frontend has not yet been connected to this service. The next integration step is a typed browser client, lobby screen and reconnect handling, followed by server-authoritative gameplay state.
