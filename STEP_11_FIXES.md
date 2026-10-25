# Step 11 — Multiplayer movement, freeze, visibility and exits

This ZIP is the updated working source (not a separate demo). All old avatars, world, skills, car and camera controls remain.

## Fixes

- Freeze now reaches the victim with authoritative state and location in `powerHit`. Server blocks X/Y/Z movement for the full ability duration. Their local screen stops responding to movement input, and other players see the immobilized avatar with icy visual effects.
- All normally visible avatars appear in the main 3D world, even when distant. Runner spawn positions are grouped so players can see each other immediately. The rotating minimap uses **only** `radar.contacts` obtained through existing reveal skills; no free enemy markers were added. Invisibility still hides the player model.
- The secret exit requires **two F presses within 3 seconds** or two presses of its on-screen button while standing close. The Leave button also requires confirmation during active play to prevent stray keyboard/button activation.
- Temporary connection loss is no longer an instant exit. The Node server keeps the original slot for 12 seconds and reconnects clients using a private session token. Manual leave still works immediately. When the grace period expires without reconnecting, original disconnection behavior applies.

## Running

`npm start` then open http://localhost:3000. For tests: `npm run check`.

## Tests

71 passing automated tests, including new multiplayer regression tests in `tests/visibility-reconnect-v11.test.js`. Chromium access to local URLs is blocked in this environment, so visual multiplayer gameplay still needs testing in a browser on your machine.
