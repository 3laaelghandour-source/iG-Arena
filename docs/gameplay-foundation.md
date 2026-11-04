# iG Arena gameplay foundation

This milestone adds reusable map data and match rules independently from the renderer.

## Arena map blockouts

The map catalog contains three layouts:

- Foundry — compact industrial blockout.
- District — wider urban blockout.
- Overpass — modern blockout with separated zones.

Each map defines its dimensions, basic structures, supported competitive playlists and spawn points. ArenaMapBuilder converts those definitions into basic Three.js geometry. These are functional greybox layouts, not finished art assets.

## Match lifecycle

The MatchEngine owns the match state and returns immutable snapshots. It does not read browser input or render the world.

1. Waiting — players join and mark themselves ready.
2. Countdown — starts when the minimum connected roster is ready.
3. Live — trusted game logic may award points.
4. Round break — Arena resets round points and starts the next countdown.
5. Finished — the result is locked and included in the snapshot.

## Arena rules preset

- Red and blue teams are assigned automatically to keep team sizes balanced.
- Minimum four players, maximum six.
- First team to three round wins takes the match.
- Each round has a time limit and a score limit.
- A team with no connected players forfeits the match.

## Deathmatch rules preset

- Free-for-all roster with two to six players.
- Match ends at the score limit or time limit.
- A tied time-limit result does not invent a winner.

## Security boundary

The match engine is a rules module, not an online server. Browsers must never submit trusted score totals. The future server must validate gameplay events before it calls the scoring methods.

## Not implemented yet

- Final map art, full collision geometry and spawn testing.
- Network-replicated player movement.
- Online matchmaking and live WebSocket rooms.
- Accounts, saved loadouts and persistent rankings.
- Production anti-cheat and operational monitoring.
