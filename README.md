# iG Arena

iG Arena is an independent browser-based 3D arena game foundation built with Three.js, TypeScript and Vite. It is inspired by the structure of arena training experiences, but it is a standalone web game and does not require FiveM or another game client.

## Current foundation

- Main game shell with Home, Play, Loadout, Rankings and Profile sections.
- Mode selection for Arena, Deathmatch and Training.
- A local single-player Training Facility that uses the existing Three.js scene.
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

1. Build out the core game shell, screen flow and mode definitions.
2. Add real arena maps, player collision, match rules, rounds, team logic and score handling.
3. Implement a Node.js multiplayer service with server-authoritative sessions and WebSocket networking.
4. Add accounts, saved loadouts, profiles, match history, rankings and persistent progression.
5. Add matchmaking, private rooms, deployment monitoring and production security.

## Structure

- src/app/App.ts — screen flow and game shell.
- src/data/gameModes.ts — mode definitions and availability.
- src/game/Game.ts — current local training scene.
- src/game/PlayerController.ts — local player movement and camera controls.
- src/main.ts — application entry point.
- src/styles.css — application and game presentation.