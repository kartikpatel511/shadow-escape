# Step 17 — Balanced Mayhem / Reliable Unfreeze

Rune Cage is completely removed from client visuals, random ability pools and server collision rules.

**Coin economy:** 300 per player at the start of every match (and every rematch).

**Shorter abilities:** Freeze 8s; Zero Gravity 18s (then 1.2s landing recovery); Chaos Controls 20s; Reverse Controls 10s; Zero Friction 12s; Slow Player 8s; Set Speed 10s; Portal Region 15s; Sprint Boost 12s; Bribe 12s; Invisibility 8s. All other prices and the 20s global cast cooldown stay the same. Shattered Compass still lasts 20s and exposes its caster to the hunter.

**Victim countdown:** A compact HUD independent of the ability deck shows which effect is active, time remaining, and a draining bar. Both server snapshots and local interpolation use the authoritative time left.

**Reliable expiry:** Freeze is cleared by the server once expired; a dedicated `effectExpired` event is sent. Client prediction also stops treating stale frozen/gravity effects as permanent when their remaining time reaches zero. Zero Gravity gets a guaranteed server landing, with a short, timed stumble.

**Effects visuals:** Reduced bright ice ring and anti-gravity crystal sizes, so the player remains visible. Slightly smaller skills panel on desktop.

## Run

```sh
npm start
```

Open http://localhost:3000 . Check with `npm run check`.
