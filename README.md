# iG Arena

iG Arena is an independent browser-based 3D arena game foundation built with Three.js, TypeScript and Vite. It is inspired by the structure of arena training experiences, but it is a standalone web game and does not require FiveM or another game client.

## Current foundation

- Main game shell with Home, Play, Loadout, Rankings and Profile sections.
- Mode selection for Arena, Deathmatch and Training.
- A local single-player training session that can load three selectable arena blockout maps: Foundry, District and Overpass.
- Map boundaries and basic obstacle collision for player movement.
- A renderer-independent match rules module for team rounds, free-for-all scoring, countdowns, breaks, time limits and disconnect outcomes.
- Clear availability states: online modes are marked as planned until a multiplayer backend exists.
- Responsive desktop and mobile layouts.

## Current playable content

Training is the only playable mode in this build. It includes first-person mouse look, WASD movement, sprinting, target practice, score, accuracy, session time and reload controls.

The Arena and Deathmatch cards are product direction only. They do not start matchmaking or create online matches.

## Technology

- Three.js for the 3D browser scene.
- TypeScript and Vite for the client.
- Planned online layer: Node.js game service with WebSocket connections.
- Planned persistence: a database-backed player profile, match history and progression service.

## Run locally

Requirements: Node.js 20.19+ or 22.12+ and npm.

Run npm install, then npm run dev.

## Build

Run npm run build, then npm run preview.

## Roadmap

1. Improve the three blockout maps with finished visual assets, full collision and spawn validation.
2. Connect the match rules module to a server-authoritative online session service.
3. Add replicated player movement, room flow and live match state over WebSocket.
4. Add accounts, saved loadouts, profiles, match history, rankings and persistent progression.
5. Add matchmaking, private rooms, deployment monitoring and production security.

## Structure

- src/app/App.ts — screen flow and game shell.
- src/data/gameModes.ts — mode definitions and availability.
- src/game/Game.ts — current local training scene.
- src/game/core/maps.ts — arena map catalog and spawn data.
- src/game/core/ArenaMapBuilder.ts — Three.js blockout map builder.
- src/game/core/MatchEngine.ts — independent match and round rules.
- src/game/core/matchConfig.ts — validated mode presets.
- docs/gameplay-foundation.md — gameplay architecture notes.
- src/game/PlayerController.ts — local player movement and camera controls.
- src/main.ts — application entry point.
- src/styles.css — application and game presentation.