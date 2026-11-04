# iG Arena

iG Arena is an independent browser-based 3D arena game foundation built with Three.js, TypeScript and Vite. It is inspired by the structure of arena training experiences, but it is a standalone web game and does not require FiveM or another game client.

## Current foundation

- Main game shell with Home, Play, Loadout, Rankings and Profile sections.
- Mode selection for Arena, Deathmatch and Training.
- A local single-player training session that can load three selectable arena blockout maps: Foundry, District and Overpass.
- Map boundaries and basic obstacle collision for player movement.
- A renderer-independent match rules module for team rounds, free-for-all scoring, countdowns, breaks, time limits and disconnect outcomes.
- A separate Node.js WebSocket service for guest sessions, queue matchmaking, balanced team assignment and staging-room readiness.
- Clear availability states: online modes are marked as planned until a multiplayer backend exists.
- Responsive desktop and mobile layouts.

## Current playable content

Training is the only playable mode in this build. It includes first-person mouse look, WASD movement, sprinting, target practice, score, accuracy, session time and reload controls.

The Arena and Deathmatch cards are product direction only. They do not start matchmaking or create online matches.

## Technology

- Three.js for the 3D browser scene.
- TypeScript and Vite for the client.
- Client: Three.js, TypeScript and Vite.
- Staging service: Node.js with the ws WebSocket library.
- Planned persistence: a database-backed player profile, match history and progression service.

## Run locally

Requirements: Node.js 20.19+ or 22.12+ and npm.

Run npm install, then npm run dev.

## Build

Run npm run build, then npm run preview.

## Game service

The WebSocket staging service is a separate Node.js app under server/. From that directory, run npm install, npm test and npm start. Set ALLOWED_ORIGINS to the exact deployed frontend origin when running in production. The service exposes /healthz and /ws.

The browser can connect to the staging service when VITE_GAME_SERVER_URL is configured. Copy .env.example to .env and set the WebSocket endpoint. The Play screen then exposes Arena and Deathmatch queue buttons and a ready-room lobby.

The service currently manages guest queues and room readiness only. It does not yet replicate the 3D world or start a live online match.

## Roadmap

1. Improve the three blockout maps with finished visual assets, full collision and spawn validation.
2. Connect the browser client to the WebSocket staging service and add lobby screens and reconnect handling.
3. Add server-authoritative live match state and replicated player movement.
4. Connect validated match scoring to the server and persist match results.
5. Add verified accounts, saved loadouts, profiles, match history, rankings and production monitoring.

## Structure

- src/app/App.ts — screen flow and game shell.
- src/data/gameModes.ts — mode definitions and availability.
- src/game/Game.ts — current local training scene.
- src/network/GameServiceClient.ts — browser WebSocket client for online staging.
- src/game/core/maps.ts — arena map catalog and spawn data.
- src/game/core/ArenaMapBuilder.ts — Three.js blockout map builder.
- src/game/core/MatchEngine.ts — independent match and round rules.
- src/game/core/matchConfig.ts — validated mode presets.
- docs/gameplay-foundation.md — gameplay architecture notes.
- src/game/PlayerController.ts — local player movement and camera controls.
- src/main.ts — application entry point.
- src/styles.css — application and game presentation.
- server/src/index.js — WebSocket guest sessions, queues and staging rooms.
- server/src/protocol.js — protocol validation and name sanitization.
- server/test/protocol.test.js — protocol unit tests.
- server/README.md — service deployment and environment notes.
