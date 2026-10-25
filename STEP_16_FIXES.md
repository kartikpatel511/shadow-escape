# Step 16 — Stability & Hunter Aiming

## Changes

1. The hunter's on-round instructions no longer swallow WASD. Any movement key begins play. Reconnection no longer reopens this movement-blocking modal.
2. A connection indicator remains visible while attempting to resume the same match. The server preserves disconnected memberships for 90 seconds, client inputs are rate-limited under congestion, and server snapshots are dropped selectively instead of building up unbounded send queues.
3. More comfortable, wider field-of-view hunter scope, located just to the **right of the monster's shoulder**. Scope and fire remain B/right-click and H/FIRE.
4. Hunter model reduced from 2x to **1.65x** runner height, retaining its horns, claws, and threatening appearance.
5. Smaller character name tags/minimap markers, with the same original nine avatars.
6. 26 valid portal locations safely **within the play perimeter** and clear of nearby obstacles. Clients and the server use the identical boundary.

## Validation

- Run `npm run check` to execute syntax and gameplay tests.
- A real two-client local WebSocket smoke test confirmed room create/join, hunter WASD, and reconnect/resume with the same room and player ID.
- Graphics and public-hosting behavior must still be verified on the machine where the game will be deployed. Hosting requires **persistent Node.js** and WebSocket upgrade support on `/ws`.

## Deployment reminder

A GitHub Pages-only site will not host this Node/WebSocket server. Run `npm start` on a Node-capable host that exposes HTTP and WS on the same domain, and connect all users to that exact URL. Deploying a new version restarts the server and clears its in-memory rooms.
