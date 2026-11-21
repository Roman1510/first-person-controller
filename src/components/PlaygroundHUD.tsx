import { useParkourStore } from '../store/ParkourStore'
import { parkourPads } from '../physics/ParkourCourse'
import { weapons } from '../physics/Weapons'
import { useWeaponStore } from '../store/WeaponStore'
import { usePause } from '../store/SessionStore'
import { useMovementDebug } from '../store/MovementDebugStore'
import { useMovementSettings } from '../store/MovementSettingsStore'

// Only this small readout subscribes to the 10 Hz physics telemetry.
function Telemetry() {
  const { grounded, crouched, speed, height, shotBlocked } = useMovementDebug()
  return <div>{crouched ? 'CROUCHED' : grounded ? 'GROUNDED' : 'AIRBORNE'} · {speed.toFixed(1)} units/s · feet {height.toFixed(2)}{shotBlocked && <div>MUZZLE BLOCKED · Step away from the obstacle</div>}</div>
}

function WeaponReadout() {
  const selected = useWeaponStore((state) => state.selected)
  return <div aria-live="polite">Weapon {selected + 1}/{weapons.length}: <strong>{weapons[selected].name}</strong> · Wheel to switch</div>
}

function SpeedControls() {
  const { speed, shiftMultiplier, setSpeed, setShiftMultiplier, reset, jumpForce, setJumpForce, toonzForce, setToonzForce, parkourPreset } = useMovementSettings()
  return <fieldset className="speed-controls">
    <legend>Movement speed</legend>
    <label htmlFor="walk-speed">Run <output>{speed} units/s</output></label>
    <input id="walk-speed" type="range" min={1} max={80} step={0.5} value={speed}
      onChange={(event) => setSpeed(event.currentTarget.valueAsNumber)} />
    <label htmlFor="shift-speed">Shift multiplier <output>{shiftMultiplier.toFixed(2)}× · {(speed * shiftMultiplier).toFixed(1)} units/s</output></label>
    <input id="shift-speed" type="range" min={0.1} max={3} step={0.01} value={shiftMultiplier}
      onChange={(event) => setShiftMultiplier(event.currentTarget.valueAsNumber)} />
    <p className="hint">Below 1× walks; above 1× sprints. Hold Ctrl to crouch (34% run speed).</p>
    <label htmlFor="jump-force">Jump force <output>{jumpForce.toFixed(2)}×</output></label>
    <input id="jump-force" type="range" min={0.25} max={3} step={0.05} value={jumpForce}
      onChange={(event) => setJumpForce(event.currentTarget.valueAsNumber)} />
    <p className="hint">Scales jump launch strength. 1× keeps the current Toonz jump; higher values jump higher.</p>
    <label htmlFor="toonz-force">Toonz force <output>{Math.round(toonzForce * 100)}%</output></label>
    <input id="toonz-force" type="range" min={0} max={100} step={1} value={Math.round(toonzForce * 100)}
      onChange={(event) => setToonzForce(event.currentTarget.valueAsNumber / 100)} />
    <p className="hint">Higher jumps, more air steering and braking, longer jump grace. At 50%+, hold Space to hop on landing. 0% disables cartoon assistance.</p>
    <div className="settings-actions">
      <button className="reset-button" onClick={parkourPreset}>Easy parkour preset</button>
      <button className="reset-button" onClick={reset}>CS 1.6-style preset</button>
    </div>
  </fieldset>
}

function ParkourReadout() {
  const { active, progress, checkpoint, falls, finished } = useParkourStore()
  if (!active) return <div>Esc → Start parkour · 13 platforms / 4 checkpoints</div>
  return <div className="parkour-status">{finished ? 'COURSE COMPLETE!' : `PARKOUR · ${progress + 1}/${parkourPads.length}`} · checkpoint {checkpoint + 1} · falls {falls}<br />R returns to checkpoint · Follow the white arrows</div>
}

export function PlaygroundHUD({ onPlay }: { onPlay: () => void }) {
  const paused = usePause()
  return <>
    {paused && <div className="pause-overlay">
      <section className="pause-panel" aria-label="Physics lab settings">
        <h1>Physics lab</h1>
        <p>Adjust your pace, then explore the course.</p>
        <SpeedControls />
        <button className="play-button" onClick={onPlay}>Enter / resume · Capture mouse</button>
        <div className="settings-actions course-actions">
          <button className="reset-button" onClick={() => { useParkourStore.getState().start(); onPlay() }}>Start / restart parkour</button>
          <button className="reset-button" onClick={() => { useParkourStore.getState().leave(); onPlay() }}>Return to physics lab</button>
        </div>
        <p className="hint">Press Esc anytime to pause and adjust speeds.</p>
      </section>
    </div>}
    {!paused && <div className="crosshair" />}
    <aside className="telemetry">
      <strong>FIRST PERSON / PHYSICS LAB</strong>
      <Telemetry />
      <WeaponReadout />
      <ParkourReadout />
      <div>WASD move · Mouse look · Shift speed modifier</div>
      <div>Space jump · Ctrl crouch · R respawn · Esc settings</div>
      <div>Click / hold to shoot · T rebuild targets</div>
    </aside>
  </>
}
