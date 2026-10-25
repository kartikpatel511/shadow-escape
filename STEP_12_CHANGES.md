# Shadow Escape — Step 12: Mystic Mayhem

Built on Step 11. It preserves the existing multiplayer WebGL2 project, world collision, avatar skins, monster, driving, and first/third/overview cameras.

## Connection repair

- A dropped WebSocket keeps the player in the match for up to **45 seconds**. The timeout now removes the player properly when the socket ID has already been detached; a bug in Step 11 prevented this.
- The client retries with capped backoff and sends heartbeat packets every 15 seconds.
- In the same browser tab, reloading remembers a private resume token in `sessionStorage`, reconnects, and restores the room.
- Run through `npm start` and a real server address; `file://` is not multiplayer. If hosting behind a proxy, it must forward **WebSocket Upgrade** requests at `/ws`. Hosting infrastructure failures or network outages are not fixed by game code.

## Rage skills (server-authoritative)

| Skill | Cost | Duration | Effect |
| --- | ---: | ---: | --- |
| Shattered Compass | 75 | 20 s | All runners receive it. Reveals **approximate**, camera-relative eight-way bearing and faint/growing/strong signal. Hunter sees the user's live position on its minimap until expiry. Does not give the runner an exact exit coordinate. |
| Zero Gravity | 90 | 60 s | An opponent rises around 11 metres, drifts in a circle with only 12% steering, gains visible floating magic, then lands automatically with a short stumble. Hunter is never targeted. |
| Freeze | 80 | 30 s | Victim's movement remains stopped on the server and all nearby players see an ice lock. Freeze overrides invisibility. |
| Rune Cage | 90 | 20 s | Server blocks a designated rival runner from crossing the magic cage boundary. |
| Time Yank | 95 | instant | Sends one rival runner back about four seconds along their server-recorded path. |
| Chaos Controls | 110 | 120 s | Server remaps the victim's input. |

- Six skills per runner: Shattered Compass **plus one random information skill, three random attack skills, and one random self-skill**; nobody can use an ability they were not assigned. The monster gets zero player skills, and hostile skills never target the monster.
- Swap still requires finding a ground crystal. Shared cooldown remains 20 seconds. The entire loadout is redrawn each round.
- Magical visual cues now appear on all clients receiving an affected player's 3D state. Normal minimap tracking is still private and does not leak the positions of everyone by default.

## World visuals

- Adjusted the in-game sky to a violet moonlit atmosphere, balanced blue-violet fog and cool lighting, and added enchanted rune arches and ambient crystal landmarks at all gates.
- Upgraded Freeze and Zero Gravity effects with visible energy rings, crystals, and a locator glow.
- Kept the existing front-page illustration and nine original avatar color/shape variations.
- This remains a browser WebGL2 game, **not** a PS5-quality Unreal asset pipeline; no unlicensed game assets are used.

## Test it

1. Unzip and run `npm start` with Node.js 18+.
2. Open `http://localhost:3000` on two or more tabs/devices (all connect to the same server).
3. Test three runners and a hunter to watch an opponent get frozen or floated. With only two players you have one runner and one hunter, so runner-vs-runner skills cannot be targeted.
4. Refresh one tab while the round is running; confirm it automatically rejoins within 45 seconds.
5. Use Shattered Compass as a runner; the hunter's map should show that runner for 20 seconds, then the contact should disappear. The runner sees only a rough bearing and strength.
6. Use Zero Gravity, confirm another client sees the airborne player, then fast-forward timer in tests or play for 60 seconds to verify server-controlled return to the ground.

Automated tests: `npm run check` (syntax + Node tests). A full interactive browser/rendering test may still be needed on the target hardware/hosting environment.
