# First-person controller

A standalone React Three Fiber + Rapier starter with a procedural physics playground. All runtime source, tests, and assets are contained in this project. There are no external models, game-specific systems, or imports from the source game.

## Run

Requires Node 22.6 or newer.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite in a desktop browser and click **Enter / resume**. The playground is the default page. Embedded browsers may reject pointer lock.

## Controls

- WASD / arrows: move; mouse: look.
- Shift: apply the speed multiplier (walk by default); Ctrl: hold to crouch; Space: jump; at 50%+ Toonz force, hold to hop again on landing.
- Left click / hold: shoot physical projectiles toward the crosshair. Gravity curves their flight.
- Mouse wheel: cycle Blaster, Rapid fire, and Heavy cannon in either direction while playing. The HUD shows the selected weapon.
- T: rebuild all 60 target boxes and clear all projectiles.
- R: respawn (latest checkpoint during parkour); Escape: release the mouse and open speed settings.
- Pause screen: run speed (1–80 units/s), Shift multiplier (0.10×–3×), jump force, Toonz force, and CS-style / Easy parkour presets. A Shift multiplier below 1 walks; above 1 sprints. Settings last until reload.

## Included

- Physics-only kinematic motor, stepped at 60 Hz.
- Collision-based grounding, acceleration/braking, limited air control.
- Yaw-only movement, normalized diagonals, interpolated camera position.
- 45° slope limit, 0.45-unit stairs, ground snapping.
- 100 ms coyote time and 120 ms jump buffering.
- Pointer-lock lifecycle, focus cleanup, respawn, and live movement HUD.
- Eleven test stations: stairs, walkable/steep ramps, translating platform, pushable boxes, low ceiling/walls, jump gaps, shootable box stacks, tall towers, a box wall, and distant pyramids.

## Structure

```text
src/physics/FirstPersonMotor.ts      Physics motor and tuning constants
src/hooks/usePlayerControl.tsx      Physics input and interpolated camera
src/hooks/usePhysicalKeyboard.tsx   Key state, press edges, focus cleanup
src/components/Player.tsx           Capsule and controller integration
src/components/PhysicsPlayground.tsx Procedural test course
src/components/PlaygroundHUD.tsx    Entry button, controls, telemetry
src/store/MovementSettingsStore.ts Movement settings and presets
src/store/SessionStore.ts           Pause state
src/store/MovementDebugStore.ts     Debug telemetry
src/App.tsx                        Canvas and pointer-lock lifecycle
tests/movement.test.mjs            Rapier integration tests
```

To use this in another scene, put `Player` inside `<Physics timeStep={1 / 60} updatePriority={-1}>`. Pause that world using the session state, and retain the pointer-lock lifecycle from `App`. Set the player's `spawn` and `initialYaw` props. Pass optional `{ speed, shiftMultiplier }` as the third argument of `motor.step` for runtime speed tuning. Other movement tuning lives in `movementDefaults`; body/eye dimensions live in `playerShape`.

## Verify

```sh
npm test
npm run lint
npm run build
```

The physics tests exercise grounding, jumping, direction/speed, thin walls, stairs, ceilings, buffered jumps, moving platforms, slope limits, coyote time, respawn, pushing boxes, runtime speed changes, and thin-wall collision at the maximum adjustable speed. Projectile tests also cover impact momentum, gravity, player filtering, CCD, fire rate, bounded body reuse, expiry, and reset.

For a manual check: look up/down while walking, climb the stairs and blue ramp, try the steep red ramp, jump underneath the ceiling, stand on the shuttle, push boxes, and pause/resume while holding movement keys. Compare camera motion at different display frame rates.

## Scope

This is a clean starter project, not yet a published npm library (`private: true`). The kinematic player pushes dynamic bodies but does not receive ordinary rigid-body knockback; explicit knockback, rotating-platform attachment, and gamepad/touch input are future work. Translating platforms have a short friction pickup lag. World dimensions preserve the original prototype scale.

## Performance

Rendering runs on demand while paused and continuously during play. Physics stays at a fixed 60 Hz, with a maximum device pixel ratio of 1.5. Course blocks share a unit-box geometry and materials by color, use explicit colliders, and avoid rebuilding the course on pause changes. The motor reuses movement scratch vectors and its collision filter. Only the small telemetry readout subscribes to 10 Hz debug updates.

Shared geometry/materials live for the scene module's lifetime. The production bundle still includes Three.js and Rapier's embedded WebAssembly; build size is not a frame-rate benchmark.

Projectiles use continuous collision detection, a 32-body reusable pool, a six-second simulation lifetime, and one instanced draw call. They collide with the world and boxes but not the player or each other. Shooting stops on pause/focus loss. Tune weapon speed, mass, and fire interval in `src/physics/Weapons.ts`; pool capacity and lifetime live in `src/physics/ProjectilePool.ts`. Switching weapons preserves the current shot cooldown.

## First-person presentation

Procedural sleeves, gloves, and two arms hold a distinct model for each weapon. Successful shots trigger recoil and muzzle flash; movement adds a small bob, and switching lowers then raises the model. A separate depth pass keeps the cosmetic model visible against nearby walls. It has no colliders. Its animated muzzle provides the projectile launch point; aiming still uses the camera crosshair. No external models or textures are required.

The range has 60 resettable target boxes: 12 near spawn, 10 in towers to the left, 20 in the wall to the right, and 18 in long-range pyramids. Press T while playing to rebuild all targets.

## Projectile origin and aiming

Press Esc to edit the **Projectile launch** Leva panel. Choose Muzzle (default) or Camera, adjust right/up/forward offsets in camera-local units, change the fallback aiming distance, or reset. Values last until reload. Zero offsets in Muzzle mode follow the animated muzzle for each weapon; zero offsets in Camera mode reproduce center-screen spawning.

A camera-center ray selects the nearest physical surface (or the fallback point in empty space). The projectile launches from the chosen origin toward that point. Muzzle coordinates compensate for the viewmodel's 60° FOV versus the world's 75° FOV. A sphere sweep from eye to origin checks the full projectile radius and blocks firing through walls/corners; the HUD reports MUZZLE BLOCKED. Queries ignore sensors, the player, and existing projectiles. Gravity still curves flight, so the crosshair describes the initial aim target, not a guaranteed ballistic impact point.

## Toonz force and parkour

Open the pause menu with Esc. **Toonz force** blends from original movement at 0% to higher jumps, 20% lighter player gravity, much stronger airborne steering/braking, 250 ms coyote time, and 250 ms jump buffering at 100%. At 50% and above, holding Space automatically hops on landing; there are no midair jumps. The app starts with the CS-style preset and Toonz force at 0%; the standalone motor keeps its original behavior when `toonzForce` is omitted. Only player movement changes: boxes and projectiles retain world gravity.

Choose **Easy parkour preset** (run 10, Shift 1.8×, Toonz force 65%), then **Start / restart parkour**. The separate 13-platform route has warm-up jumps, alternating strafe jumps, and narrower precision landings. Follow the numbered pads and white arrows. Land on every pad in order; green platforms save checkpoints (1, 5, 9), and gold platform 13 finishes the route. Falling returns you to the latest checkpoint and increments the fall counter; R retries manually. **Return to physics lab** exits the course. Pausing preserves progress.

Physics tests verify increased jump height, airborne braking, held-jump behavior, and successful landings for every course transition with the easy preset. This is a CS-style practice course, not a reproduction of GoldSrc movement or its speed-building exploits.

**Jump force** in the pause menu independently scales jump launch strength from 0.25× to 3×, after the Toonz boost. It affects the next jump, including auto-hops, without changing gravity or air steering. The CS-style and Easy parkour presets use 1× to preserve existing jump heights.

## CS 1.6-style defaults and crouch

The app starts with running speed 12.5, Shift walking at 0.52× (6.5 units/s), crouch speed at 0.34× (4.25 units/s), jump launch speed 13.4, player gravity 40, jump force 1×, and no Toonz assistance. This is CS-inspired tuning scaled for the scene, not an exact GoldSrc port. Classic air control preserves horizontal momentum on key release and adds capped directional air acceleration; it does not provide the arcade preset's midair braking. Raise Toonz force for more forgiving air control or select Easy parkour to restore the previous assisted jump setup. Boxes/projectiles keep their existing world gravity.

Hold either Ctrl key to duck. The capsule shrinks from 3.8 to 2 units tall while preserving foot position, and the eye lowers smoothly. Releasing Ctrl only stands up when the full standing capsule fits; under a ceiling you stay crouched until clear. Crouching caps ground movement at 34% of running speed (a slower Shift setting still applies). Respawning restores standing shape. The teal-roofed **CTRL / CROUCH TUNNEL** near spawn is a clearance test. Airborne ducking shrinks from the top; GoldSrc duck-jump exploits and exact weapon-dependent movement speeds are outside this implementation.
