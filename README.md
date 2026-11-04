# iG Arena

A browser-based 3D FPS training prototype built with Three.js, TypeScript and Vite.

## Current prototype

- First-person camera with mouse look (Pointer Lock).
- WASD movement and Shift sprint.
- Single training arena with cover and target lanes.
- Rifle-style hitscan target practice, magazine and reload.
- Score, health and ammo HUD.
- Targets respawn after being hit.

> This is a local single-player prototype. Online multiplayer, accounts, persistent stats, matchmaking and authoritative server validation are not implemented yet.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Click **START TRAINING** to lock the mouse. Press **Esc** to release it.

## Controls

| Input | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Aim |
| Left click | Fire |
| R | Reload |
| Shift | Sprint |
| Esc | Release mouse |

## Build

```bash
npm run build
npm run preview
```

## Roadmap

1. Prototype polish: movement feel, collision, weapon feedback, target variety and performance.
2. Multiplayer foundation: Node.js server, WebSocket sessions and server-authoritative state.
3. Accounts and persistence: PostgreSQL profiles, match history and progression.
4. Game modes: FFA, Team Deathmatch, private matches and training scenarios.

## Project structure

```
src/
  game/
    Game.ts
    PlayerController.ts
  main.ts
  styles.css
```