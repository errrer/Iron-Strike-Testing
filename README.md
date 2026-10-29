# IRON STRIKE

A free, browser-based **3D first-person shooter** in the style of modern arena shooters. No install, no build step - it is plain ES modules + [Three.js](https://threejs.org).

**Play:** enable GitHub Pages (see below) and open the URL, or run it locally.

## Features

- **3 game modes**
  - **Team Deathmatch** - 5v5, first team to 30 kills
  - **1v1 Duel** - you vs one bot, first to 10 kills
  - **Free For All** - 8 players, first to 20 kills
- **4 maps** - *Warehouse* (indoor containers + catwalk), *Dust* (desert village), *Skyline* (rooftop at dusk), *Frostbite* (snow compound with watchtowers)
- **8 weapons** - pick a primary and a secondary before every match

| Slot | Weapon | Type | Notes |
|---|---|---|---|
| Primary | **VMP** | SMG | Fastest-firing primary, great mobility |
| Primary | **M4A1** | Assault rifle | Balanced and accurate |
| Primary | **AK-47** | Assault rifle | Hard-hitting, heavy recoil |
| Primary | **Kar98k** | Sniper | Bolt-action, 4x scope, one-shot body kill |
| Primary | **Model 680** | Shotgun | Pump action, 10 pellets |
| Secondary | **G18** | Machine pistol | Full-auto, 1100 RPM |
| Secondary | **M1911** | Pistol | Semi-auto, 3 shots to kill |
| Secondary | **.357 Magnum** | Revolver | 2 shots to kill |

- Bots with line-of-sight vision, reaction time, burst fire, strafing and A\* pathfinding (3 difficulty levels)
- Hitscan ballistics with damage fall-off, headshots, recoil, spread, ADS and sprint
- Health regeneration, kill feed, hit markers, damage direction indicators, radar, scoreboard
- Procedural textures and WebAudio sound; guns are either your own baked models (the **VMP** is a custom FBX model) or detailed procedural stand-ins

## Controls

| Key | Action |
|---|---|
| W A S D | Move |
| Shift | Sprint |
| C | Crouch |
| Space | Jump |
| Left mouse | Fire |
| Right mouse or Q | Aim down sights (hold Shift with a sniper/SVD to steady your breath) |
| R | Reload |
| 1 / 2 / mouse wheel | Switch weapon |
| V | Toggle first / third person camera (also in the menu and pause settings) |
| Tab (hold) | Scoreboard |
| Esc | Pause |

## Handling (V0.4)

- **Random recoil** - every shot rolls its own climb (with the occasional big jolt) and a sideways drift that random-walks through a burst, plus a little camera shake. The viewmodel kicks in a random direction too.
- **Tac stance** (`Z` toggles it, then hold the aim button) - the gun turns on its side and you aim with the laser dot instead of the sights. The crosshair stays on screen. Faster than ADS, tighter than hip fire (best with a laser). Sprinting drops it.
- **Crosshair changer** - pick a style (cross, cross + dot, dot, circle, T, X), colour, size, thickness, gap, opacity and outline from the main menu or the pause menu. Saved in your browser.
- **Reload** - the gun and your hands stay inside the frame for the whole reload on every weapon.
- **Slide** - sprint, then tap `C`: you keep your momentum, drop low and skid for about a second. Jumping cancels it and keeps your speed.
- **Mantle** - walk or jump into a ledge that is too tall to step on (up to about 1.5 m) and you pull yourself over it. Walls taller than that stay walls.
- **Soldiers** - a proper jointed body: head with ears, nose and brow, neck, chest, abdomen, pelvis, upper arms, elbows, forearms, hands with fingers and thumbs, thighs, knees, shins, ankles and boots, plus a vest with plates and pouches, a backpack and one of three headgear styles. Their arms are solved with two-bone IK every frame, so the trigger hand is on the grip and the support hand on the foregrip of whatever gun they hold, at any aim angle. Knees bend when they run and they fold into a crouch. See `js/soldier.js`.
- **Gore** (GoreBox-style, can be turned off with the Gore checkbox in the menus) - blood sprays out along the shot, splatters on walls, floors and crates, and pools under the body. Stumps spurt, parts and chunks fly off and leave blood trails. Head, torso, arm and leg each have 3 models, plus 3 kinds of chunk (meat, bone shard, organ) in `js/gore.js`. Headshots pop the head; shotgun and sniper kills tear off several parts. The part disappears from the corpse and returns on respawn. Textures live in `assets/gore/` (flesh surface and 15 blood splats, the sprayed, dripping and smeared ones cut from your sheet) - swap the files to change the look.
- **Weapon animations** in the style of the 2010-2015 Call of Duty games: gun swings up on draw, swung-across sprint with arm pump, strafe tilt, landing dip, jump float, look sway, and full reloads where the support hand goes for the mag, the old mag drops, a new one is seated (mag slap) and the gun is charged. Pistol slides recoil and lock back when empty, the Kar98k works its bolt after every shot and on reload, the pump shotgun pumps after every shot and loads shells one by one. `F` inspects the weapon.
- The animated parts are tagged in `js/gunmodels.js` (`mag`, `slide`, `bolt`, `pump`); the VMP's `Mag` part is animated automatically.

- **Euphoria ragdoll** (checkbox in the menus, `js/ragdoll.js`) - a dying soldier is an active ragdoll, not a plank that tips over. A 16-point Verlet skeleton keeps fighting for a moment: it props itself up, takes stumbling steps in the direction of the hit, clutches the wound (or its head) with one hand, flails the other arm, then reaches for the ground as it falls and finally goes limp and settles against the floor and crates. Bigger guns shove harder (shotgun and sniper hardest, pistols least) and stay conscious for less time; headshots cut it short. Knees and elbows bend the right way, severed parts bleed from the right spot on the moving body, and it is cosmetic only, so every peer simulates its own in multiplayer.

## V0.5 - objectives, killstreaks and ranks

- **4 new offline modes** (`js/objectives.js`; bots play the objective too): **Domination** (capture A/B/C by standing in the ring, a point every 3 s per flag, first to 200), **Hardpoint** (one zone that moves every 45 s, only the team alone in it scores, first to 250), **Kill Confirmed** (kills drop dog tags - pick up red tags to confirm, blue to deny, first to 40) and **Search & Destroy** (one life per round; attackers hold **E** in site A or B for 3 s to plant, defenders hold **E** at the bomb for 5 s to defuse, bomb timer 40 s, first to 4 rounds). They are single-player only for now, so they are hidden from the multiplayer lobby.
- **Killstreaks** (`js/streaks.js`, offline modes): 3 kills in a row earns a **UAV** (key 4, all enemies on the radar for 25 s), 5 a **Sentry Gun** (key 5, automatic turret for 60 s), 7 an **Airstrike** (key 6, eight bombs along your view direction). The cycle repeats every 10 kills.
- **XP, ranks and unlocks** (`js/progress.js`, saved in the browser): kills, headshots, streaks, captures, plants/defuses and wins give XP. 30 levels with 10 rank names; weapons unlock with level (M4A1/VMP/G18 at 1, M1911 3, AK-47 5, Model 680 8, .357 11, Kar98k 14). The main menu has an "Unlock all weapons (testing)" checkbox, ON by default - turn it off to play the progression for real.

## Warehouse props (V0.5 part 4)
The warehouse now uses real 3D props and image textures: shipping containers (two halves per slot, tinted per colour), crates, barrels, pallet racking along the north/south walls, roller shutters and big doors on the walls, a concrete floor and corrugated wall texture.
Collision stays simple boxes. Map props are built in code in `js/props.js` (merged, vertex-coloured box/cylinder meshes; crates use `assets/tex/crate.jpg`). If a prop fails to build the map falls back to plain boxes.
Not used yet: the ladder (no textures supplied, 10k+ triangles) and the 3 beam pieces (`Untitled_2.fbx`).

## Sandbox mode

Pick **Sandbox** in the mode list (also available in multiplayer). There is no score and no clock, and no bots - just you, a map and dummies.

- **B** drops a dummy where your crosshair is pointing (on the floor or on top of a crate). **Shift+B** drops a row of five, **N** clears them all. Up to 20 at a time.
- Dummies stand still and do nothing. They can be shot (hit markers, kill feed, gore and all); dead ones ragdoll to the floor and are cleared away after about 8 seconds.
- **Esc** opens the pause menu with a sandbox panel: spawn/clear buttons plus your **loadout**. Change the primary, secondary or any attachment and it takes effect immediately, with a fresh magazine and the new gun in your hands and on your body.
- **Multiplayer:** the host picks Sandbox in the lobby and can start alone. Everybody can spawn and clear dummies and change loadout mid-match; the host validates every request and everyone sees the same dummies and guns. People who join late get the existing dummies.

## Attachments

Pick them on the main menu (or in the multiplayer lobby) under each weapon. They are remembered per weapon.

| Attachment | Fits | Effect |
|---|---|---|
| Red Dot Sight | VMP, M4A1, AK-47, Model 680, and all pistols | ADS accuracy +20%; aiming down sights lines you up with the dot instead of the iron sights |
| Vertical Grip | all primaries | recoil -20%, hip spread -10%; your support hand moves to the grip |
| Laser Sight | all weapons (pistols: under the barrel, primaries: side of the handguard) | hip spread -30%, ADS +5%; shows a red dot where you point |

The Kar98k keeps its own scope (grip and laser only). Attachment models are built from the gun's `mount` / `under` anchors in `js/gunmodels.js`, so your own models just need those two anchor points (see `asset.mount` / `asset.under` in `js/weapons.js`).

## Multiplayer (V0.3)

Click **MULTIPLAYER** on the main menu.

- **Host a game** - creates a room and shows a **6-letter code**. Pick the mode, map and your loadout in the lobby, then press START MATCH.
- **Join a game** - type the host's code. You can also join a match that is already running.
- Up to **18 players** per room (1v1 Duel is limited to 2). All 3 modes and all 4 maps work online; Team Deathmatch auto-balances the teams.
- Pause does not stop the match online. Esc / "Leave match" takes you out of the room.

How it works: there is no game server. Players connect directly to each other with WebRTC (via [PeerJS](https://peerjs.com), loaded from a CDN, using its free public signalling server). The host's browser runs the match and streams the state to everyone else, with lag compensation for hits. So it keeps working on GitHub Pages, but:

- The host needs a decent connection (an 18-player room uploads roughly 1.5-2 Mbit/s). If the host closes the tab, the room ends.
- Movement is trusted from each client, so it is made for playing with friends, not for ranked/anti-cheat play.
- Very strict firewalls / some mobile networks can block WebRTC; the free PeerJS relay usually gets around that.

Tests: `python3 tests/mp-test.py` runs a host plus up to 18 simulated clients over a fake in-memory network.

## Run locally

ES modules need a web server (opening `index.html` directly from disk will not work):

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

Three.js is loaded from the jsDelivr CDN (see the import map in `index.html`). To run fully offline, download `three.module.js` (r160) into a `vendor/` folder and point the import map at it.

## Deploy to GitHub Pages

1. Create a new GitHub repository and push this folder to the `main` branch.
2. In the repo go to **Settings -> Pages -> Build and deployment -> Source** and choose **GitHub Actions**.
3. The included workflow (`.github/workflows/pages.yml`) publishes the site on every push. Your game will be live at `https://<your-username>.github.io/<repo-name>/`.

## Project layout

```
index.html          page + import map
css/style.css       menu + HUD styling
js/main.js          menu, settings, game flow
js/game.js          match logic, player, shooting, modes
js/bots.js          bot AI
js/weapons.js       weapon stats + procedural gun models
js/maps.js          the four maps (pure data, unit-testable)
js/physics.js       collision, ray casting, navigation graph
js/world.js         builds the Three.js scene from a map
js/hud.js           HUD, radar, kill feed, scoreboard
js/audio.js         procedural sound effects
js/gunmodels.js     gun models: loads baked assets + procedural stand-ins
assets/fbx/         source FBX models (vmp.fbx)
assets/models/      baked models the game loads (vmp.json)
tools/              FBX -> game model converter + preview scripts
tests/              map/nav test + headless smoke test
```

## Tests

```bash
node tests/nav-test.mjs   # every map has a connected nav graph and valid spawns
python3 tests/smoke.py    # headless Chromium (Playwright): plays all modes with a stubbed Three.js
python3 tests/modes-test.py     # V0.5: objective modes, killstreaks, XP and unlocks
python3 tests/ragdoll-test.py   # euphoria ragdoll: stagger, limb lengths, ground, sleep, respawn reset
```

## Using your own gun models (FBX)

The VMP uses a custom model. To add more, model them in Blender (or anything that exports binary FBX) and bake them:

```bash
cp my_m4a1.fbx assets/fbx/m4a1.fbx
python3 tools/fbx2model.py assets/fbx/m4a1.fbx m4a1 --length 0.85 --preview /tmp/m4a1.png
```

Then register it on the weapon in `js/weapons.js` (the `grip` / `fore` values are the names of the parts where the hands go):

```js
m4a1: { ..., asset: { id: 'm4a1', grip: 'grip', fore: 'handguard' } }
```

Tips for the converter (Python 3 + numpy only, no Blender needed):
- Name a part `Stock` (or `Butt...`) so it knows which end is the back, and a part starting with `Mag` so it knows which way is down. Otherwise pass `--forward -x` / `--up +y` yourself.
- Each part becomes one mesh coloured from its material's *Diffuse Color*. Textures and UVs are ignored.
- `--length` is the gun's overall length in metres (the VMP is 0.62). The converter centres the model on the receiver and points the muzzle down -Z.
- Use `--muzzle x,y,z` if the muzzle flash should come from somewhere other than the front-most point.
- The `--preview` PNG shows side / iso / top / front views so you can check orientation and colours.

If a model file is missing the game silently falls back to the procedural stand-in.

## Adding content

- **New weapon:** add an entry to `WEAPONS` in `js/weapons.js` and list its id in `PRIMARIES` or `SECONDARIES`.
- **New map:** write a builder function in `js/maps.js` (boxes, buildings, stairs helpers) and register it in `MAP_BUILDERS` / `MAP_INFO`.

## Disclaimer

Fan-made, non-commercial hobby project. It is not affiliated with, endorsed by, or sponsored by any game publisher or studio. Weapon names describe real-world firearms and are used descriptively; all code, models, textures and sounds are generated procedurally.

## License

MIT (see `LICENSE`). Three.js is MIT licensed by its authors.

## Easter egg

Type `richtofen` anywhere (menu or in a match) and every soldier turns into the Richtofen model; type it again to turn it off. The model lives in `assets/models/richtofen.json`, baked from an OBJ with `python3 tools/obj2model.py model.obj richtofen`. It only changes your own screen, also in multiplayer.

## V0.6 – Zombies (big update)

The game now opens on a start screen: **Multiplayer** (all the existing modes) or **Zombies**.

**Zombies** is a BO3-style co-op survival mode on a new night map, *Outpost* (3 rooms, 10 boardable windows). Solo, or 2-4 players online (Zombies screen -> Create room / Join with code).

- Rounds of zombies pour in through the windows and tear the boards; hold **F** to rebuild them (+10 pts each). Round size and zombie health scale each round, and they get faster.
- Points: +10 per hit, +60 per kill, +100 for a headshot kill. Spend them with **F**: wall guns (buy, then half-price ammo), doors (750 / 1250) that open the next rooms, the Mystery Box (950), Pack-a-Punch (5000).
- Perks: Juggernog, Quick Revive, Speed Cola, Double Tap, Stamin-Up.
- Power-ups from kills: Max Ammo, Insta-Kill, Double Points, Nuke, Carpenter.
- Down at 0 HP (pistol only, crawl). A teammate holds **F** to revive you; solo Quick Revive gives self-revives. Everyone down = game over; the score is rounds survived. Dead players return next round.
- Multiplayer is host-authoritative; zombies run on the host and are synced to clients.

New tests: `tests/zombies-test.py` (rules, shops, power-ups, game over) and `tests/zm-mp-test.py` (host + clients co-op sync). Existing tests were updated for the start screen.

Not in yet: dog rounds, box moving, multiple box spots, melee.

## V0.6.1 – animation, grips, fixes

- **Containers** were baked on their side; re-oriented so they stand upright.
- **Leg glitch** fixed: every joint is rewritten each frame (and reset after ragdolls), so limbs can no longer stay twisted sideways.
- **Third-person animation** (`js/anim.js`): speed-scaled stride, legs that turn with the travel direction (strafing, walking backwards), pelvis bounce, torso lean, jump/fall/landing poses, crouch and slide, head look, breathing, low-ready sprint carry, recoil kick, draw dip, and a reload where the support hand goes to the vest pouch and then the magazine well.
- **Grips**: first-person hands rebuilt with palm, wrapped fingers, trigger finger and thumb raked to the grip angle (two-handed hold on pistols, C-clamp under the handguard on long guns). Added an ADS arc, breathing and step sway to the viewmodel.
- **Zombies**: shamblers, limpers and sprinters have different gaits, swipe when a player is in reach, and pull at boards when tearing windows.
- **Barricades**: bullets pass through boards; players can never climb out through a window (zombies still can).
- New test: `tests/anim-test.py`.

## V0.6.2 – movement

- Mantle reach raised to about 2.5 m (newer-COD style). Low ledges (up to ~1.3 m) are vaulted quickly and keep your momentum; higher ones are climbed. Sprinting into a ledge up to 1.2 m vaults it automatically, no jump needed.
- **Q** is now hold-to-aim (same as right mouse). Switch weapons with 1/2 or the mouse wheel.
- Mantle poses in third person.

## V0.7 – more guns, iron sights, sway

- **8 new guns** (loadout menu, bots, online, unlocks, Zombies Mystery Box): MP5, P90, SCAR-H, M249 LMG, SVD marksman rifle (2.6x scope), AA-12 auto shotgun; secondaries Skorpion machine pistol and Desert Eagle. Primaries are now 11, secondaries 5.
- **Iron sights rebuilt** for every gun: a proper rear aperture ring or notch plus a front post with guard ears (white-dot blades on pistols), centred on the aiming line. The VMP, which had none, now has them too. Hidden when a red dot is fitted.
- **Aim sway** (COD style): sights drift in a figure-eight while aiming, strongest with the Kar98k, less with the SVD, small otherwise; worse while moving, better crouched. Hold **Shift** with the Kar98k or SVD to hold your breath (about 4.5 s, then a gasp).
- **Crate texture** replaced with the new wood grain, recoloured brown.
- **Frostbite** now uses the existing container, crate and barrel models.

### V0.7.1
- Crate model re-UV-mapped so the wood grain (with plank grooves) covers every face; barrels brighter (were rendering black); plain-box fallbacks are no longer drawn once a model is loaded; Frostbite containers moved off the watchtower stairs.

## V0.7.2
Removed the imported map-prop models. Containers (corrugated, locking bars, corner castings), wooden crates, steel drums, pallet racking, roller shutters and industrial doors are now procedural low-poly models in the game's blocky style. Imported VMP gun and Richtofen model unchanged.

## V0.8 - Zombies update
- **Two new zombies maps** (pick the map on the Zombies screen, solo or online): **Bunker** (four rooms deep underground, three doors) and **Farmstead** (farmhouse, barn and granary on a foggy night). Outpost stays. Every map has 10 windows, doors, 5 perks, the Mystery Box and Pack-a-Punch.
- **The VMP is in a raised room on every zombies map**, 3 m up a stair in the yard (the wall-buy is up there). Zombies path up the stairs after you (`map.zm.upper` describes the stair foot and top); the room has shooting slits.
- New wall guns: LMG on every map.
- **Crawler Rush**: every fourth round from round 5 is a rush of fast, low, weaker crawlers; the last one drops Max Ammo.
- Zombies stagger briefly when shot (so you can back-pedal), crawlers hit for less.
- Fixed a navigation bug (distance field used 32-bit floats, which left holes in the field, so zombies could freeze in some spots).
- Skyline floor z-fighting fixed. Lights can have colours (`lights: [x, y, z, colour]`).
- Tests: tests/zm-maps-test.py (every zombies map: stairs, VMP buy, zombies climbing up, crawler rush); nav-test.mjs now checks the zombies maps too.

## V0.8.1 - Multiplayer robustness
- STUN servers plus a public TURN relay as the fallback, so strict NATs (mobile data, school/office wifi) can connect.
- A second *unordered* data channel per client carries snapshots and movement, so one lost packet no longer stalls everything behind it (falls back to the reliable channel if it can't open). Stale snapshots/states are dropped.
- Heartbeat independent of the frame loop; the client shows "Connection lost" after 15 s of silence and the host drops silent clients after 25 s. Signalling reconnect on both sides.

## V0.8.2 - Super 46
- New SMG **Super 46** (unlocks at level 4, in the zombies Mystery Box, bots use it): built from your Blender model. The `.blend` (Blender 5.2, zstd compressed) was read directly, boxes/cylinders triangulated with flat shading, materials -> colours (tan receiver, black polymer, grey rails), merged by colour into a 14-part `assets/models/super46.json` (~150 KB). Its own iron sights are tagged so a red dot hides them; the magazine is a separate part for the reload animation.
- Stats: 20 dmg, 1100 rpm, 33-round mag, low recoil, short range (9-28 m).


## V0.8.7-V0.8.9 / V0.9.0
- The imported Blender Super 46 was dropped (messy mesh); the Super 46 is now a hand-built procedural model (`buildSuper46` in `js/gunmodels.js`): slab receiver, vented shroud, top rail with teeth, angled mag, folding triangle stock, iron sights. Same stats and attachments as before. `assets/models/super46.json` removed.
- **Map Maker** (V0.9.3): button on the start screen. A 3D Blender-style editor (`js/mapmaker3d.js`, Three.js OrbitControls + TransformControls): orbit/pan/zoom, click to select, move/rotate/scale gizmo with snap, shapes, the game's props, and import of your own .glb/.gltf/.obj/.fbx models. Saves/loads a JSON map file (imported models embedded) and exports .glb. A warning shows every time it opens: maps made here are not playable in the game unless the dev adds them. Test: `tests/mapmaker-test.py`.
- Map Maker V0.9.4: undo/redo (buttons, Ctrl+Z / Ctrl+Y) and gameplay markers (team spawns, player start, zombie spawn, barricade window, wall buy, buyable door, mystery box, perk machine; buy/door/perk have a cost/name field). Markers are exported with the map for the dev; the game still does not load custom maps.
- **Model Maker** (V0.9.5): second button on the start screen, same 3D editor in model mode (small grid, fine snap, extra shapes cone/ring, Mirror X, import parts) exporting .glb/JSON. Shows its own warning: models made here are not usable in the game unless the dev adds them.
- V0.9.6: **Tac stance removed** (Z key, HUD tag, pose and spread code, hints). **4 new attachments**: Suppressor (quiet, recoil -10%, damage -6%, range -8%), Extended Mag (+50% mag, reload +15%, taller mag), Compensator (recoil -15%, sideways kick -25%), Long Barrel (range +20%, ADS spread -10%, speed -3%). Each gun gets the ones that fit its class; muzzle devices move the muzzle flash forward. Test: `tests/attach-test.py`.
- V0.9.7 Map/Model Maker: Blender-style tools - Join (Ctrl+J), Boolean cut/union/intersect (C/U/I, via three-bvh-csg from the CDN), Mirror X/Y/Z (Alt+X/Y/Z), Array (A), Drop to ground (D), Hide (H), multi-select (shift-click), views (1/3/7/5), wireframe (Z), local/global gizmo (L), per-shape roughness/metalness. Every button shows its shortcut; Duplicate (Shift+D / Ctrl+D) copies in the same place. Joined/boolean results are saved as baked meshes in the map file.
- V0.9.11: **M4A1 model** from the user's Model Maker file (`assets/models/m4a1.json`, 0.92 m, 2.1k triangles, own iron sights tagged 'iron', mag tagged 'mag'). Converted from the editor's baked meshes (axes flipped so the muzzle points -Z, scaled x0.5, near-black colours lifted to gunmetal tones); the editor's 'Casing Eject' box was left out. The procedural AR builder stays as the fallback.
- V0.9.12: reload fix for baked models (VMP, M4A1): the support hand now reaches for the middle of the mag's bounding box instead of the mag mesh's origin (which is always 0,0,0 for baked parts), so the arm no longer sweeps across the screen.
- V0.9.13: reload mag animation: the old mag now drops 34 cm and vanishes (was 12 cm, so it hovered under the well), the new one rises from 20 cm below.
- V0.10.0 **Mobile support** (`js/touch.js`, `?touch=1` forces it, `?touch=0` turns it off; auto-detected on phones/tablets): floating move stick (push to the rim = sprint), swipe anywhere on the right to look, FIRE (hold + swipe to aim while firing), AIM (toggle), JUMP, CROUCH (toggle, slide while sprinting), RELOAD, SWAP, USE (zombies), killstreak buttons, scoreboard and pause buttons. No pointer lock on touch. HUD rearranged around the thumbs, menus scroll on small screens, full screen + landscape requested on the first tap, 'rotate your phone' notice in portrait. Analog stick support in `updatePlayer` (`game.joy`); `game.look()` shared by mouse/touch. Test: `tests/touch-test.py`.
- V0.10.1 Mobile aim assist / auto shoot (removed again in V0.10.2).
- V0.10.2 **Controller support** (`js/gamepad.js`, standard-mapping pads, menus navigable with D-pad/stick + A/B), aim assist and auto shoot removed, fast tapping no longer zooms the page (`blockZoom()` + `touch-action: manipulation`), GUI polish pass (focus rings, scrollbars, buttons, HUD, scoreboard). Test: `tests/gamepad-test.py`.
- V0.11.0 **Air mantle + realism pass** (physics unchanged): newer-COD mantling - any time you are airborne (jump, fall, sliding off a ledge) with a ledge within arm's reach (~1.7 m above your feet) in front of you, you grab and pull up without pressing anything; from the ground you still jump into ledges up to ~2.2 m. Landing impact dip + camera tilt scaled by fall speed, film grain, aim vignette. Test: `tests/mantle-test.py`.
- V0.11.1 **Container map** (from the Map Maker file): 37 containers at free angles (some stacked), racking, barrels, crates; team A east / team B west. Props gained a free `ang` yaw (`js/world.js`); rotated footprints are cut into rows of small collision boxes; this map uses a finer bot nav grid (`navStep`). Test: `tests/container-test.py`. (smoke.py's m4a1 sight-height assertion is stale since the custom M4A1 model.)
- V0.12.0 **Dirt Bike Race** (new landing card; no guns): `js/race-core.js` (track spline with four jumps, arcade bike physics with ballistic jumps, AI riders that brake for corners, laps/positions) + `js/race.js` (procedural dirt bike + rider model, terrain/track/scenery, chase camera, HUD with minimap/nitro, engine sound, pause, results, best lap saved, keyboard / controller / touch). 3 laps, 1 or 5 laps or free ride; easy/normal/hard riders; six bike colours. Tests: `tests/race-core-test.mjs`, `tests/race-test.py`.
- V0.13.0 **COD-style menus**: landing is now a left-hand vertical menu (smoky backdrop, amber diamond on the highlighted entry, description panel); multiplayer screen restyled with square amber-highlight tiles and a loadout panel (big weapon name, stat bars, rounds/reserve, slowly swaying 3D preview from `js/wpreview.js`) above a strip of white-icon weapon tiles with an EQUIPPED bar. **VMP iron sights fixed**: the baked VMP has no sights of its own and they were floating at the wrong height on the stock; they now sit on its rail (`asset.sights` in weapons.js).
- V0.13.1 Cache-busting: the stylesheet, main.js and every module import now carry `?v=0.13.1` so browsers can't mix new HTML with old CSS/JS (bump it when releasing).
- V0.13.2 Red dot on the Magnum and M1911: the hammer sat right in the sight line and hid the dot; it now drops below the line when a dot is fitted.
- V0.13.3 **Gun visuals** (procedural guns only - the VMP and M4A1 models you made are untouched, they ignore the new reflections): bevelled edges on every part, an image-based lighting environment so metal actually reflects (it was near black before), a fine metal/polymer grain, real wood grain on the stocks and furniture, brighter blued/steel/silver colours. Used by the first-person viewmodel and the menu preview/icons.
- V0.13.4 **Online is easy to find**: the start screen has an ONLINE entry (create or join a room) that opens the room panel straight away; it used to be a button at the bottom of the bot-match menu. The old entry is now PLAY VS BOTS.
- V0.14.0 **Dirt bike multiplayer**: DIRT BIKE RACE > PLAY ONLINE. Create a room, share the 6-letter code, up to 6 riders; the host picks laps, bots (0-5, total grid of 8) and bot skill. Everybody drives their own bike locally (no steering lag) and sees the others smoothed, with name tags; results table updates live and the host can start another race. Solo mode now has a Bots option too (none / 1 / 3 / 5). Test: tests/racenet-test.py.
- V0.14.1 **Killfeed fix**: kill messages were huge (a style name clashed with the new loadout panel). Fixed.
- V0.15.0 **Gunsmith, camos, keybinds**: COD-style Gunsmith screen (button in each loadout panel): the gun in the middle with slot boxes around it - Muzzle, Barrel, Laser, Optic, Stock, Underbarrel, Magazine, Ammunition, Camo. 3+ options per slot (3 suppressors, flash hider/compensator/brake, 3 barrels, 3 grips, 3 lasers, 3 mags, 3 stocks, 3 ammo types, 4 optics), each with a small downside (e.g. suppressors cost damage/range, long barrel is slow to swing) and the change in numbers shown in green/red. Weapon stats now show real numbers (damage, fire rate, range, accuracy, hip fire, control, mobility, reload, magazine). 12 procedural camos (Woodland, Desert, Arctic, Urban Digital, Tiger, Blue Tiger, Crimson Digital, Gold, Diamond, Obsidian, Galaxy) unlocked by level or kills/headshots per gun; your own VMP/M4A1 models keep their shape but now use the same metal/polymer materials. New **KEYBINDS** button (menu and pause) rebinds every key. Tests: tests/attach-test.py, tests/keybind-test.py.
- V0.15.1 **Gunsmith polish**: your hand-made M4A1 extended mag is used for the M4A1 (assets/models/m4a1_xmag.json); the VMP extended mag now stretches down from the mag well instead of floating; the VMP no longer gets extra iron sights (its model has its own). Attachments are stronger with real trade-offs (COD-style: e.g. Heavy Suppressor = near silent, -22% recoil but -14% damage and -28% range). 18 camos now: new Carbon Fibre, Neon Grid, Toxic, Magma, Holo Prism and Dragon Scale; camos have a clearcoat gloss and the glowing ones (Obsidian, Galaxy, Neon Grid, Toxic, Magma) pulse while Holo Prism shifts colour.
- V0.16.0 **Gun Game, melee, classes, mod menu**: new **Gun Game** mode (solo and online): 16-gun ladder, every kill upgrades you, a knife kill sets the victim back, and the final gun is the **Golden Gun** - 1 bullet, 1 shot, 1 kill, very slow reload; kill with it to win. 7 new guns (UMP-45, M16A4, FAL, RPK, SKS, MAC-10, .44 Revolver). **Melee**: tap V = quick knife lunge, hold V = equip your knife; 5 knives (Combat Knife, Karambit, Balisong, Machete, Tomahawk). **5 classes** you can edit and swap mid-match from the pause menu. Every attachment now has its own 3D model. Type `supermod` for the mod menu (session or permanent; new Damage multiplier). Online play keeps running while you are in the menu (the pause screen says so); joining retries on flaky networks, uses more relay servers, and tells you plainly on a version mismatch. Tests: tests/gungame-test.py, class-test.py, melee-test.py, supermod-test.py.
- V0.16.1 **Graphics, depth camos, decal sight**: new **Graphics** setting (Low / Medium / High: render scale, shadow quality, camo animation) and a Show FPS counter, in the menu and the pause menu. Rare camos (Gold, Diamond, Obsidian, Galaxy, Neon Grid, Magma, Holo Prism, Dragon Scale) now have layered depth: three parallax layers drifting at different speeds, a rim glow and a light sweep. **Custom Decal Sight**: a reflex optic whose reticle is your own picture (Gunsmith > Optic > Custom Decal Sight > Choose image; saved on this device). VMP and M4A1 models are chamfered (tools/bevel.py) and the built-in stand-in models for them are gone (the M16A4 uses your M4A1 model). Fast Mags and the coloured ammo bands are removed. Online: protocol 3.
- V0.17.0 **Inspect animations**: press F and every gun plays its own inspect (mag checks, charging-handle pulls, slide racks, pumps, flips, spins, a two-turn Golden Gun show-off) and each of the 5 knives has its own (karambit finger spin, balisong flips, tomahawk toss, machete show-off...). Sequences are built from reusable moves in js/inspect.js. Test: tests/inspect-test.py.
- V0.17.1 **Dirt bike, graphics, knives**: Dirt bike: Shift = wheelie (front wheel up, slower steering, tops up nitro), Space = nitro, damped-spring suspension (body, forks and rider soak bumps and landings), and Free ride has no edges - an endless grass field follows you. Graphics: Low now really cuts work (half-res, no shadows or extra lights, simple materials, short view distance, no ragdoll/gore, plain camos, fewer trees on the bike track); High is full-res with 4K shadows. Knives: new extruded blade models (drop-point combat knife, hooked karambit, balisong, machete, bearded tomahawk) and new per-knife swings with wind-up and follow-through. Inspect animations are calmer (eased holds, no jiggle).
- V0.17.2 **Karambit**: rebuilt - the hooked blade now grows out of the handle (tapering crescent with jimping on the spine) with a finger ring at the back. Knife spins and flips now pivot at the wrist, and the forearm twists with them instead of the whole arm swinging round.
- V0.17.3: knife inspect spins now rotate only the hand and blade at the wrist; the forearm stays still.
- V0.18.0 **Smarter bots, touch, Ultra**: dirt bike bots now ride like people - racing line (wide in, cut to the apex), trail braking and rolling back on the gas, going round slower riders, the odd misjudged corner, and wheelies on clear straights. Touch controls: dirt bike gets an analog steering strip plus big Gas / Brake / Nitro / Wheelie buttons with haptics; the main game gets Knife (tap lunge, hold equip), Inspect and Sprint-lock buttons, haptics and a Touch look sensitivity slider. New **Ultra** graphics preset: supersampled render, 8K shadows, image-based lighting, sharper textures, colour grade and vignette. Animations: inspects, knife swings and the support hand now run through a slightly under-damped spring, with overlapping moves, anticipation and faint breathing, so they flow instead of looking robotic. Tests: tests/gfx-test.py, tests/bike-test.py.
- V0.18.1: fixed the dirt bike camera suddenly staring at the sky. Cause: a zero-length frame made the bike's ground snap divide by zero, which dropped the bike through the world (y = -600) and the camera followed. Bikes now ignore zero-length frames and recover from bad numbers, and the chase camera can never tilt up into the sky.
- V0.18.2: inspects no longer do full spins or twirls (the hand/arm dragged with them) - they are slow, partial turns now. Reload movement is spring-smoothed like the rest of the viewmodel, so every animation eases in and out instead of snapping.
