# Shadow Escape Step 13 — Timefall Escape

## How to win

Every round has exactly one enormous, shimmering time-travel portal. The Node server chooses one of 26 safe candidate locations when the host starts the round. Portal location is locked until the round ends. You must travel through the fantasy world to find it; only nearby players see the portal object. It is intentionally not broadcast to everyone's minimap.

A runner wins by reaching within 7.5 metres on foot and pressing **F twice within 3 seconds**. This deliberately prevents surprise exits from unrelated keys. The server validates role, position and incapacitation. The first eligible runner wins immediately.

The match lasts **eight minutes** exactly, enforced by the server. If nobody escapes in time, the monster (hunter) wins. Rematches select a fresh location and a new random monster.

## Powers

Zero Gravity costs 90 coins and lasts 60 seconds. The victim rises to around 15–28 metres, loses steering control, flies erratically, and is thrown to random valid locations several times during the minute. Nearby viewers see each throw's magical burst. At the deadline the server cancels the effect, resets altitude to safe terrain height and applies a 1.2-second landing stumble. It is physically authoritative, not just a notification. The target cannot escape while floating.

Shattered Compass is guaranteed to each runner and costs 75 coins to use. For 20 seconds the runner sees only an approximate eight-direction bearing and one of three proximity strengths. The hunter's minimap displays that runner's real position for those same 20 seconds; other runners do not get a free reveal.

Attack skills remain unavailable to the hunter and cannot target them. Swap crystals remain ground pickups. Original nine playable avatars and gameplay controllers are preserved.

## Tests and deployment

Use Node 18+: `npm start`, then open `http://localhost:3000`. Other devices must connect to the same accessible server. Hosting must allow WebSocket Upgrade on `/ws` or multiplayer cannot work. `npm run check` runs code checks and 83 automated tests. Live GPU/browser gameplay still needs testing on your hardware.
