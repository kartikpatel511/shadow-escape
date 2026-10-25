# RIFTBOUND — Escape the Veil (Step 18)

**A multiplayer fantasy escape-and-sabotage game built for a hackathon.**

In **RIFTBOUND**, players awaken in a magical world, search for a hidden time-travel gate, and race to return home. One player is the **Hunter**; everyone else is a **Runner**. Runners must evade the Hunter and survive other runners' disruptive skills. **The first runner to reach the portal wins automatically** — but if the eight-minute timer runs out, the Hunter wins.

## Highlights

- **Real-time multiplayer:** Private rooms, character selection, a Hunter role, runner roles, and spectator cameras.
- **A secret destination:** A brilliant time-travel portal appears in one of 26 validated locations and stays fixed during that round. Nearby players receive a dramatic proximity alert; no remote exact coordinates are leaked.
- **Sabotage skills:** Freeze, Chaos Controls, Zero Gravity, teleport-related abilities, and more. Skills have coin costs and cooldowns, and effects are enforced by the Node.js game server.
- **Shattered Compass:** Gives rough directional guidance toward the exit while revealing the user's location to the Hunter for 20 seconds.
- **Cinematic world:** Moonlit fantasy environment, nine original avatars, an intimidating monster, first/third-person camera, overview camera, car, small Swap floor-plaques (no useless floating diamonds or circles), and original ambient music.
- **Competitive matches:** An eight-minute countdown; automatic first-to-portal victory or Hunter victory at timeout. A dedicated crown podium displays the victor and the reason the round ended.

## Play locally

**Requirements:** Node.js **18+** and a modern WebGL2-compatible browser.

```bash
npm start
```

Open **http://localhost:3000**. To start a round, create a room and join with at least one other player. For local multiplayer testing, open the site in multiple browser windows, preferably on separate devices or browser profiles.

### Controls

| Action | Key |
| --- | --- |
| Move / strafe | W/A/S/D |
| Run / jump | Shift / Space |
| Shattered Compass (always equipped) | G or the on-screen COMPASS button |
| Look / orbit camera | Drag with mouse |
| First-person / third-person | V |
| Overview | O |
| Enter / exit vehicle | E |
| Select skills / use skill | 1–6 / Q |
| Collect Swap | R |
| Hunter fire / scope | H or click / B or right-click |
| Win by entering the portal | Walk into its glowing entrance (F also works) |

Touch controls are available on supported devices. The hunter can press **B** (or right-click) to toggle a zoom scope and use the on-screen FIRE button. Music is an original, low-volume browser-synthesized ambient soundtrack that starts after your first interaction; tap **♫ MUSIC** to mute/unmute.

## Step 18 — RIFTBOUND cinematic edition

- **New identity:** The game is now branded **RIFTBOUND: Escape the Veil**, with a refreshed, cinematic, responsive lobby featuring atmospheric ruins, portal motifs, readable game rules, animated original avatar previews, and a four-part gameplay overview. The multiplayer engine and nine playable skins are preserved.
- **Smaller 3D characters:** Runners now render at **80%** of their prior size and the Hunter at **approximately 68%** of its former size. The Hunter is still **1.4× as large** as a runner, with its horns, claws, and dark armor. These are visual model changes; the server's collision rules remain unchanged.
- **Updated sabotage timing:** Freeze **20s**; Zero Gravity **20s** followed by its existing **1.2s** landing recovery; Chaos Controls **30s**; Slow Player **8s** at **10% normal speed**; Invisibility **20s**. These durations are enforced on the server and displayed by the corresponding HUD countdowns.
- **Removed two skills:** Reverse Controls and Zero Friction have been completely removed from shared definitions, random loadouts, menus, client movement, and server power execution. Any forged requests for those skills are rejected.
- **Preserved rules:** Every runner gets six strategic skills including Shattered Compass. A single Swap crystal can be collected from the ground. Every player starts with **300 coins**, skill use shares a 20-second cooldown, and each round lasts **eight minutes**.

## Step 17 — Previous balance (historical reference, superseded in Step 18)

- **Rune Cage removed:** It cannot be randomly assigned or cast. The cage world collision, HUD icon, 3D cage model and server serialization have been deleted.
- **Limited starting balance:** Every runner and Hunter starts each round with **300 coins** (not 1,000); rematches reset to 300. Prices stay visible on the skill buttons; choose your casts carefully.
- **Short, readable attack effects:** Freeze **20 seconds**, Zero Gravity **20 seconds** plus a **1.2-second landing stagger**, Chaos Controls **30 seconds**, Slow Player **8 seconds at 10% speed**, Set Speed **10 seconds**, Portal Region **15 seconds**. Reverse Controls and Zero Friction are no longer offered. Time Yank / Random Teleport remain instant. Shattered Compass keeps its 20-second risky guidance window. Other defensive effects were shortened too.
- **Victim countdowns:** A separate small panel at the top shows **FROZEN — 20s LEFT** or **ZERO GRAVITY — 20s LEFT**, with a draining meter. It stays visible even if the ability deck is minimized.
- **Unfreeze reliability:** The server clears Freeze on its exact deadline and tells the player. The client also interpolates the server's remaining milliseconds, so losing a snapshot cannot leave the local movement code using a stale permanent `frozen: true` flag. Timed movement effects are always validated server-side.
- **Smaller visuals:** Freeze rings/crystals and Zero Gravity effects were made less obstructive to the camera. The in-match abilities panel was tightened slightly on desktop.
- **Validation:** Run `npm run check` for syntax checks and the 100 automated multiplayer/gameplay tests, including effect-expiry regressions.

## Step 16 — Stability, Hunter Controls & Safe Portal

- **Monster movement:** The hunter can begin moving immediately with WASD (or arrow keys); pressing a movement key dismisses the round tutorial. After reconnecting, the tutorial no longer reopens and blocks movement.
- **Connection recovery:** Short socket interruptions pause controls instead of ending the round. The match is kept for up to **90 seconds** while reconnecting with the private session token, and a persistent amber connection indicator appears. The server drops obsolete snapshots rather than queuing them indefinitely when the connection is slow. Browser/game-server hosting must support real WebSockets at `/ws`; a server process that stops or restarts still cannot preserve in-memory rooms.
- **Monster appearance:** Still larger and more threatening than runners, now **1.65×** their size instead of 2× in Step 16 (further reduced to 1.4× in Step 18).
- **Scope:** A wider, less magnified hunter scope; camera sits slightly above/right of the monster's shoulder so the target remains visible. Press **B** or right-click to aim, and **H** or the red **FIRE** button to shoot.
- **Sharper visibility:** Smaller player name labels and minimap markers.
- **Fair arena:** The same playable perimeter is enforced on the server and client. All **26** secret portals spawn safely inside the walkable area, with at least 5 m entrance clearance. No portal is beyond the reachable map boundary. Water crossing still works.
- **Validation:** Full automated test suite and a local real-WebSocket integration check for the hunter movement and room resume.

## Step 15 — Previously added

- **Water traversal:** Run or wade straight across rivers and shallow ponds. Bridges are optional. Trees, rocks, buildings, and the outer wall still block movement. Water gives a small 15% slowdown, rather than stopping you.
- **Faster runners:** Base walk speed is now **7.5 m/s** and sprint speed **14 m/s**, consistently on both the client and server.
- **Cleaner map:** Removed floating decorative white diamonds and circles. Swap collectibles are marked by small ground plaques. The real exit portal keeps its distinctive bright magic effects.
- **Shattered Compass is easy to use:** Every runner starts with it. Click **USE COMPASS** in the left-side panel or press **G**. It costs **75 coins**, gives **20 seconds** of approximate 8-direction guidance, and shares the 20-second ability cooldown. Turn the camera until its arrow points **↑** and run forward; the minimap also shows a short guide ray (not the portal's exact position). Signal strength increases from **FAINT** to **GROWING** to **STRONG** as you get closer. **Warning:** the hunter sees your live position on their minimap for those 20 seconds.
- **Start tutorial and notifications:** Each round opens a role-specific instructions screen explaining movement, objectives, controls, your actual assigned skills and their costs. Click **I UNDERSTAND · START PLAYING**, or press a movement key to begin immediately. Skill use/attacks and important events display temporary pop-up notifications without taking away movement controls.

## How the game works

1. Players join a shared private room. One player is selected as Hunter.
2. Runners spawn inside the fantasy world with a strategic randomized skill loadout and the Shattered Compass ability.
3. The time-travel gate spawns at a secret position and stays there for the match.
4. Players explore, evade the Hunter, and sabotage other runners. Coin-priced abilities can alter movement, visibility, and positioning.
5. The first surviving runner to touch the glowing portal within **8:00** wins automatically. Otherwise, the Hunter wins. The results screen awards a crown, shows the winner’s avatar/name, and explains why the game ended.

## Tech stack

- **Frontend:** HTML, CSS, JavaScript, custom WebGL2 3D renderer.
- **Backend:** Node.js, native HTTP server, WebSocket multiplayer protocol.
- **Shared game rules:** ES modules for movement, world generation, skills, and authority checks.
- **Testing:** Node.js built-in test runner (`node --test`).

## Run the tests

```bash
npm run check
```

This validates JavaScript syntax and runs automated tests for the game server, ability effects, room logic, portal race, visibility, and controls.

## Deployment note

This is a **real-time multiplayer Node.js/WebSocket application**. GitHub hosts the **source code**; it does not run the Node.js server just because the repository is public. GitHub Pages alone is **not suitable for hosting the multiplayer game**. For a playable public demo, deploy the server to a hosting provider that supports persistent WebSocket connections and submit the live demo URL separately from this GitHub repository link.

## Project documents

- [Full project and gameplay documentation](docs/ORIGINAL_PROJECT_README.md)
- [Step 14 release changes](STEP_14_CHANGES.md)
- [Step 13 release changes](STEP_13_CHANGES.md)
- [Instructions to publish this repository](GITHUB_UPLOAD_GUIDE.md)
- `controller_demo.html` is an extra standalone Three.js controller reference; the actual multiplayer game starts with `npm start`.

> Hackathon submission tip: add your team members, a short demo video, screenshots, and your deployed gameplay link here before submitting. Do not commit passwords or secret tokens.
