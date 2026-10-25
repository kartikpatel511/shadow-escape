# Shadow Escape — Step 15 Changes

## Fixes
- Water no longer blocks players and cars; shallow river/pond zones instead add only 15% movement slowdown for walking and sprinting.
- Faster shared controller speeds: 7.5 m/s walk, 14.0 m/s sprint.
- Removed unnecessary static floating diamonds and ground rings; preserved the real magical secret portal and functional Swap pickups as stone floor plaques.
- Shattered Compass now has an always-visible left-side panel for runners with a dedicated G shortcut, direct activation button, 8-way directional arrow, FAINT/GROWING/STRONG bars, duration, cooldown/cost, and hunter-reveal warning. A rough guiding ray displays on the minimap without revealing portal coordinates.
- Role-specific round-start tutorial lists assigned skills, costs, controls, winning conditions, and where notifications appear. Players cannot move before dismissing it.
- Added temporary stacked skill/error notifications during gameplay.

## How to find the exit
1. As a runner, press **G** or the **USE COMPASS** button (75 coins).
2. Your compass guides you for 20 seconds. **Rotate the camera** until the arrow points **↑** and move forward. Turn and follow the short guide ray in the minimap if preferred.
3. FAINT means far away; GROWING means closer; STRONG means close. Guidance is intentionally approximate and does not show the exact door location.
4. While the compass is active, the **hunter sees your live location on their minimap** for the same 20 seconds.
5. Reach the large shining blue portal and walk through to automatically win the 8-minute race.

## Validation
Run `npm run check` to validate syntax and multiplayer tests. Test in a browser with 2+ connected users to check rendering and skill interaction.
