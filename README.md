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
| Right mouse | Aim down sights |
| R | Reload |
| 1 / 2 / Q / mouse wheel | Switch weapon |
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
Collision stays simple boxes. Props are baked by `python3 tools/props2json.py model.fbx out.json --up y|z --scale 0.01 [--keep Part]` into `assets/props/*.json` (positions, normals, UVs) and loaded by `js/props.js`; textures live in `assets/tex/*.jpg`. If a prop file is missing the map falls back to the old boxes.
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
