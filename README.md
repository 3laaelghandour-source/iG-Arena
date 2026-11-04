# iG Arena

iG Arena is an independent browser-based 3D arena game built with Three.js, TypeScript and Vite. It is inspired by browser arena and training experiences, but it is a standalone web game and does not require FiveM or another game client.

## Current foundation

- Main game shell with Home, Play, Loadout, Rankings and Profile sections.
- Arena, Deathmatch and Training mode definitions.
- Three selectable 3D arena blockout maps: Foundry, District and Overpass.
- Map boundaries and basic obstacle collision in the local training scene.
- Renderer-independent match rules for team rounds, free-for-all scoring, countdowns, round breaks and match results.
- A Node.js WebSocket service for temporary guest sessions, queues, balanced teams and staging-room readiness.
- Browser-side queue and lobby integration when the game-service URL is configured.
- Player accounts with scrypt password hashing, seven-day sessions, saved profiles and a public XP leaderboard.

## What is playable today

Training is the only playable 3D mode in the browser client. It is a local session. Arena and Deathmatch can connect to the staging queue when the WebSocket service is configured, but room readiness is not the same as a live match. There is no network-replicated 3D gameplay yet.

Player profiles and account authentication are implemented. Rankings read from the game-service leaderboard API, but will remain empty until live match results are connected. Loadout is still an informational section.

## Technology

- Client: Three.js, TypeScript and Vite.
- Staging service: Node.js and the ws WebSocket library.
- Planned persistence: a database-backed player profile, match history and progression service.

## Run the web client locally

Requirements: Node.js 20.19+ or 22.12+ and npm.

1. Copy .env.example to .env.
2. Keep VITE_GAME_SERVER_URL set to ws://localhost:8080/ws for local service development, or leave it empty to hide online queue entry.
3. Run npm install, then npm run dev.

## Run the game service locally

From server/, run npm install, npm test and npm start. The health endpoint is /healthz and the WebSocket endpoint is /ws.

For production, set NODE_ENV=production and ALLOWED_ORIGINS to the exact frontend origin. Deploy the service separately on a Node.js host that supports long-lived WebSocket connections.

## Build

Run npm run build, then npm run preview.

## Roadmap

1. Finish map blockouts with proper art, collision and spawn validation.
2. Complete staging-room reliability, reconnect handling and service monitoring.
3. Add a server-authoritative live session with replicated player presence and movement.
4. Connect validated match rules to live sessions and persist match results.
5. Add player accounts, saved loadouts, profiles, match history and rankings.

## Structure

- src/app/App.ts — application screens, queue and lobby flow.
- src/data/gameModes.ts — mode definitions and availability.
- src/game/Game.ts — local training scene.
- src/game/PlayerController.ts — local movement and camera controls.
- src/game/core/ — map definitions, map builder and renderer-independent match rules.
- src/network/GameServiceClient.ts — browser WebSocket client.
- src/network/PlayerApiClient.ts — account, profile and leaderboard API client.
- server/src/playerStore.js — persistent player accounts, sessions and stats.
- server/src/ — guest sessions, matchmaking queues and staging rooms.
- server/test/ — game-service protocol tests.
- docs/gameplay-foundation.md — gameplay architecture notes.
