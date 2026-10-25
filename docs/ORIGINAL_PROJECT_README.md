# SHADOW ESCAPE — STEP 14: MYSTIC VICTORY

This updates the **original multiplayer website** you supplied. It retains the previous world, nine player avatar choices, lobby and server, private rooms, spectator mode, monster, artwork, coins, random skills, and Swap crystals. It is not a rewrite as a different game.

## Start the multiplayer website

Install Node.js 18 or later, extract the ZIP, and run these commands **inside this project folder**:

```bash
npm start
```

Open `http://localhost:3000`. Friends on the same network can join using the server's LAN IP and a room code. For test coverage: `npm run check`.

## Step 13 — Time-travel race and full Zero Gravity chaos

- **Win condition:** One massive glowing time-travel portal is chosen from **26 validated locations** at the start of each round; it stays at those coordinates until the round ends. Nearby runners **and the hunter** see a large 3D stone arch with shimmering blue-purple energy, rotating runes and glowing particles. It is not shown on everyone's minimap. It is reachable on foot; the first runner within 7.5 m who crosses into the portal wins automatically (F is optional). A frozen, floating, downed, or driving player cannot claim escape.
- **Eight-minute time limit:** A server-authoritative countdown starts at `08:00`. The HUD turns urgent during the final minute. If no runner escapes before time reaches zero, the **hunter wins**. The server decides race winners atomically, so later input cannot replace a winner. The host can then start a new round with a new random portal location.
- **Zero Gravity (60 seconds):** Only runner opponents can be targeted. Victims are levitated, pulled unpredictably in fast sideways vortices, and **thrown to another valid position ~24–66 m away** at 5–8-second intervals. Their movement keys cannot cancel these throws. Everyone near the throw sees a purple burst, and every player receives the authoritative airborne avatar position. At 60 seconds, the server puts the victim back safely on the ground and briefly staggers them; victims never remain trapped in the air indefinitely.
- **Shattered Compass:** Every runner has it (not the hunter). Spending 75 coins provides a coarse eight-direction bearing plus faint/growing/strong proximity guidance for 20 seconds; the monster sees that runner's **live minimap location during those same 20 seconds**. The runner never receives the portal's exact coordinates through the compass.
- **Balanced skills, avatars and world preserved:** Five other server-assigned random skills, existing nine animated avatar designs, large monster, spectator views, multiplayer rooms, ground Swap pickup, drivable car and fantasy backdrop remain intact.
- **Optional Portal Region intel:** This legacy skill reports a broad region rather than claiming every possible portal appears in a perimeter wall.

Run `npm run check` for **83 automated tests**, including WebSocket multiplayer tests, portal drawing geometry smoke tests, portal visibility/private-information safeguards, fixed positions within each round, timed win conditions, Shattered Compass and repeated Gravity throws. The available browser graphics environment could not complete a GPU test; please test the 3D appearance on the target browser and hardware.

## Earlier Step 12 multiplayer fixes and magic abilities

See [STEP_12_CHANGES.md](STEP_12_CHANGES.md) for exact costs, durations, and security notes. Shattered Compass is granted to every runner, reveals a rough bearing only, and broadcasts the caster's live position to the hunter for 20 seconds. Step 13 upgrades Zero Gravity from circular drift to unpredictable aerial bursts and random throws before the guaranteed 60-second landing. Time Yank is a new attack that restores a rival's position from four seconds earlier. Dropped WebSocket sessions may reconnect for 45 seconds, including after same-tab reloads.

## Previous Step 11 bug fixes

- **No surprise exits:** Pressing F at the exit now asks for a second confirmation within 3 seconds. The Leave Room control also requires a second click while playing. An accidentally focused button cannot exit the game through Space. A brief WebSocket interruption no longer resets the lobby immediately; the server reserves your session for **45 seconds** and automatically resumes your identity if you reconnect in time. An explicit Leave is still immediate. If the hunter stays disconnected after the grace period, the round ends with the correct explanation.
- **Freeze actually locks the victim:** The server blocks the target's X, Y and Z, and sends the victim their authoritative active effects and exact frozen position immediately. The victim's own input prediction stops; other players' 3D views stop interpolating the frozen player and show a visible ice effect.
- **See friends in the main world, without revealing them on the minimap:** All visible players' 3D avatars are streamed and rendered regardless of 115m proximity. Runners spawn in a nearby cluster so they appear on one another's screens as the round starts. **The rotating top-right minimap still receives player positions only from the legitimate paid reveal skills; invisibility still hides avatars.**

## What changed

- **WASD movement is simultaneous and camera-relative.** W/S moves forward/back and A/D strafes; diagonal input is normalized. Left/Right arrow keys rotate the camera, Up/Down arrows go forward/back. Walk = **5.2 m/s**, run = **10.2 m/s** (Shift). Player heading follows actual movement. The server calculates input from normalized local coordinates instead of accepting spoofed client world velocities.
- **Mouse/touch camera:** Drag rotates yaw by `-dx * 0.005`, pitch by `+dy * 0.004` (clamped `[-0.45, 1.2]`). Wheel multiplies third-person distance by `(1 + deltaY * 0.001)` and clamps `[0.01, 14]`.
- **First-person / third-person:** Press **V** or use the on-screen button. Defaults to third-person at distance **6**, pitch **0.35**, yaw **PI**. First-person = **0.01** and hides the local avatar; third-person shows it. Smooth camera interpolation uses `min(1, dt * 9)` (instant for first-person). A terrain clamp keeps the camera from going underground.
- **Orbit overview:** Press **O**. Starts `theta=0.8`, `phi=1`, `radius=170`; drag/zoom with exactly the provided sensitivity and range. Overview disables walking and the touch joystick.
- **Drivable car:** Positioned near the new first-runner spawn at `(0, 52)`. Press **E** or Car button within **6m** to enter, E again to exit **2.8m to the vehicle's right**. Speed/steering, collision bounce, follow yaw (`dt * 3`), and minimum camera distance (`9`) use the provided formula. The server owns the car and driver so everyone in the same room sees it.
- **Touch:** Touch the LEFT 45% of the screen to create a temporary **90px joystick** with **30px knob**, maximum **45px movement**, and running over **95%** travel. Drag on the right to look. Two simultaneous pointers are supported.
- **Collision:** X and Z resolve separately, sliding along buildings, trees, rocks and barriers. The original terrain has heights centered near y=0, so a *separate normalized ground-height check* applies the `> 0.3` water limit without moving every existing building/avatar vertically. Existing bridges remain traversable.
- **Minimap:** Round and rendered at **150px**, rotates by `PI + yaw` around the player's location, and keeps the yellow pointer fixed in the center.
- **Freeze skill fixed:** The server now blocks **X, Y and Z** movement for the full **30 seconds**, and the receiving client immediately stops local prediction. Other effects (slow, reverse, friction, gravity, scramble, cages) are processed by server physics and mirrored in client prediction. Runners driving the car cannot bypass attacks.
- **Removed abilities:** **Warm / Cold** and **Exit Compass** are completely removed from the shared ability definitions, server assignment and interface. Grow/Shrink remain removed.

### Other skill rules retained

Each runner receives **six randomly selected skills** in equal categories: 2 information, 3 attack and 1 self/defense. Monster receives no skill deck. Global skill cooldown: **20s**. Swap remains a ground-only pickup. Attacks and obstacle skills target other runners, not the monster. Freeze and friction last **30s**, upward Zero Gravity lasts **60s**, Chaos Controls lasts **120s**.

## Controls

| Action | Input |
| --- | --- |
| Walk / strafe | W/S + A/D simultaneously; Up/Down arrows move |
| Turn / look | Left/Right arrows; mouse/touch drag |
| Run | Shift or joystick near its edge |
| Jump / climb | Space / C |
| Enter or exit car | E / on-screen Car button |
| Switch first/third-person | V / camera button |
| Orbit overview toggle | O / Overview button |
| Zoom | Mouse wheel |
| Pick / use Swap | R to collect, 7 to select if held, Q to cast |
| Select and cast a skill | 1–6 and Q |
| Fire as monster | H / click world / Fire button |
| Escape through gate | Step through portal automatically (or press F) |
| Spectate previous / next / first-person | [ / ] / V |

## Standalone, single-file Three.js r128 version

`controller_demo.html` is an **additional standalone controller reference** that follows your exact specification. It uses the Three.js **r128 non-module global build**, loaded via CDN: **no ES modules and no build step**, but internet is needed to load the CDN script. It contains walk, first/third-person, overview, a vehicle, collision, joystick, moving avatar, and 150px minimap. You may open this file directly in a browser. It **does not** contain the multiplayer backend, saved avatars, or paid skill rules: those continue to live in the main website above.

The original multiplayer website continues to use **WebGL2 + Node.js modules** rather than replacing its renderer with Three.js, to avoid breaking your existing game. All named shared multiplayer controller tunables are in `shared/controls.js`.

## Validation

- Run `npm run check` for automated server physics, skill effects, coordinates, camera constants, car handling, and WebSocket scenarios.
- A graphical **live multiplayer browser playtest** is still recommended. The available browser environment blocked access to a locally hosted game URL; automated Node tests are not a substitute for a real GPU/touch session.
