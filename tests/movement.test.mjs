import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { FirstPersonMotor } from '../src/physics/FirstPersonMotor.ts'
const require = createRequire(import.meta.url)
// Use the same Rapier version as R3F, not drei's transitive version.
const rapierRequire = createRequire(require.resolve('@react-three/rapier'))
const R = rapierRequire('@dimforge/rapier3d-compat')
await R.init()
const idle = { forward: 0, right: 0, yaw: 0, sprint: false, jumpPressed: false }
function setup({ floor = true, y = 2 } = {}) {
  const world = new R.World({ x: 0, y: -20, z: 0 })
  world.timestep = 1 / 60
  const box = (x, y, z, hx, hy, hz) => world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z))
  if (floor) box(0, -0.5, 0, 200, 0.5, 200)
  const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, y, 0))
  world.createCollider(R.ColliderDesc.capsule(1.4, 0.5), body)
  const motor = new FirstPersonMotor(world, body)
  world.step()
  const step = (input = idle, count = 1, speeds) => {
    for (let i = 0; i < count; i++) { motor.step(input, world.timestep, speeds); world.step() }
  }
  const close = () => { motor.dispose(); world.free() }
  return { world, body, motor, step, box, close }
}
test('lands on the floor and stays grounded without sinking', () => {
  const s = setup({ y: 8 })
  s.step(idle, 180)
  assert.equal(s.motor.grounded, true)
  assert.ok(Math.abs(s.body.translation().y - 1.925) < 0.02)
  s.close()
})
test('one jump press produces one jump; apex is not ground', () => {
  const s = setup()
  s.step(idle, 30)
  s.step({ ...idle, jumpPressed: true })
  let apex = 0
  for (let i = 0; i < 140; i++) {
    s.step()
    const y = s.body.translation().y
    apex = Math.max(apex, y)
    if (y > 2.1) assert.equal(s.motor.grounded, false)
  }
  assert.ok(apex > 4 && apex < 4.7, `apex ${apex}`)
  assert.equal(s.motor.grounded, true)
  assert.ok(s.body.translation().y < 2)
  s.close()
})
test('diagonal speed equals forward speed; yaw rotates travel', () => {
  for (const input of [{ forward: 1, right: 0, yaw: 0 }, { forward: 1, right: 1, yaw: 0 }, { forward: 1, right: 0, yaw: -Math.PI / 2 }]) {
    const s = setup()
    s.step(idle, 30)
    s.step({ ...idle, ...input }, 60)
    const v = s.body.linvel()
    assert.ok(Math.abs(Math.hypot(v.x, v.z) - 20) < 0.05)
    if (input.yaw) assert.ok(v.x > 19.9 && Math.abs(v.z) < 0.01)
    s.close()
  }
})
test('sprint cannot tunnel through a thin wall', () => {
  const s = setup()
  s.box(0, 3, -8, 10, 3, 0.1)
  s.step(idle, 30)
  s.step({ ...idle, forward: 1, sprint: true }, 120)
  assert.ok(s.body.translation().z > -7.4)
  s.close()
})
test('climbs a 0.35 step but blocks a 0.8 step', () => {
  for (const height of [0.35, 0.8]) {
    const s = setup()
    s.box(0, height / 2, -7, 4, height / 2, 4)
    s.step(idle, 30)
    s.step({ ...idle, forward: 1 }, 25)
    if (height < 0.45) assert.ok(s.body.translation().z < -4 && s.body.translation().y > 2.2, JSON.stringify(s.body.translation()))
    else assert.ok(s.body.translation().z > -3, JSON.stringify(s.body.translation()))
    s.close()
  }
})
test('ceiling collision cancels upward speed', () => {
  const s = setup()
  s.box(0, 4.5, 0, 5, 0.25, 5)
  s.step(idle, 30)
  s.step({ ...idle, jumpPressed: true })
  s.step(idle, 5)
  assert.ok(s.body.translation().y < 2.36)
  assert.ok(s.motor.velocity.y <= 0)
  s.close()
})
test('buffered jump fires after landing', () => {
  const s = setup({ y: 2.05 })
  s.step({ ...idle, jumpPressed: true })
  s.step(idle, 10)
  assert.ok(s.motor.velocity.y > 0)
  s.close()
})
test('standing player follows a translating kinematic platform', () => {
  const s = setup({ floor: false, y: 2.5 })
  const platform = s.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased())
  s.world.createCollider(R.ColliderDesc.cuboid(5, 0.5, 5), platform)
  s.step(idle, 30)
  for (let i = 0; i < 120; i++) {
    platform.setNextKinematicTranslation({ x: (i + 1) / 60 * 2, y: 0, z: 0 })
    s.step()
  }
  // Rapier transfers platform velocity with friction: allow the initial pickup lag.
  assert.ok(s.body.translation().x > 3.5 && s.body.translation().x < 4.1, JSON.stringify(s.body.translation()))
  assert.ok(Math.abs(s.body.linvel().x - 2) < 0.1, `platform carry velocity ${s.body.linvel().x}`)
  assert.equal(s.motor.grounded, true)
  s.close()
})
test('walks up a 25 degree slope but cannot climb a 60 degree slope', () => {
  for (const degrees of [25, 60]) {
    const s = setup()
    const angle = degrees * Math.PI / 180
    s.world.createCollider(R.ColliderDesc.cuboid(4, 0.25, 6)
      .setTranslation(0, Math.sin(angle) * 6, -9)
      .setRotation({ x: Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) }))
    s.step(idle, 30)
    s.step({ ...idle, forward: 1 }, 40)
    if (degrees === 25) assert.ok(s.body.translation().y > 3, JSON.stringify(s.body.translation()))
    else assert.ok(s.body.translation().y < 2.6, JSON.stringify(s.body.translation()))
    s.close()
  }
})
test('coyote jump works shortly after an edge but expires in freefall', () => {
  for (const delay of [2, 12]) {
    const s = setup({ floor: false })
    const floor = s.box(0, -0.5, 0, 5, 0.5, 5)
    s.step(idle, 30)
    assert.equal(s.motor.grounded, true)
    s.world.removeCollider(floor, false)
    s.step(idle, delay)
    s.step({ ...idle, jumpPressed: true })
    assert.equal(s.motor.velocity.y > 0, delay === 2)
    s.close()
  }
})
test('respawn clears motion and buffered input', () => {
  const s = setup()
  s.step(idle, 30)
  s.step({ ...idle, forward: 1, jumpPressed: true }, 10)
  s.motor.reset({ x: 10, y: 2, z: 10 })
  s.step(idle, 30)
  assert.ok(Math.abs(s.body.translation().x - 10) < 0.01)
  assert.ok(Math.abs(s.body.translation().z - 10) < 0.01)
  assert.equal(s.motor.grounded, true)
  s.close()
})
test('walking into a dynamic box pushes it', () => {
  const s = setup()
  const crate = s.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, 0.75, -5))
  s.world.createCollider(R.ColliderDesc.cuboid(0.75, 0.75, 0.75).setDensity(2), crate)
  s.step(idle, 30)
  s.step({ ...idle, forward: 1 }, 30)
  assert.ok(crate.translation().z < -6, JSON.stringify(crate.translation()))
  s.close()
})

test('live speed tuning changes walk and sprint without recreating the motor', () => {
  const s = setup()
  try {
    s.step(idle, 30)
    for (const [speed, sprintSpeed, sprint] of [[8, 16, false], [8, 16, true], [30, 60, false], [30, 60, true], [1, 1, false]]) {
      s.step({ ...idle, forward: 1, right: 1, sprint }, 90, { speed, sprintSpeed })
      const velocity = s.body.linvel()
      assert.ok(Math.abs(Math.hypot(velocity.x, velocity.z) - (sprint ? sprintSpeed : speed)) < 0.05)
    }
  } finally { s.close() }
})

test('maximum adjustable speed cannot tunnel through a thin wall', () => {
  const s = setup()
  try {
    s.box(0, 3, -40, 10, 3, 0.1)
    s.step(idle, 30)
    s.step({ ...idle, forward: 1, sprint: true }, 120, { speed: 80, sprintSpeed: 80 })
    assert.ok(s.body.translation().z > -39.4)
  } finally { s.close() }
})

test('Toonz force raises jump height and improves airborne braking', () => {
  const results = []
  for (const toonzForce of [0, 1]) {
    const s = setup()
    try {
      const tuning = { speed: 20, sprintSpeed: 38, toonzForce }
      s.step(idle, 30, tuning)
      s.step({ ...idle, forward: 1 }, 30, tuning)
      s.step({ ...idle, forward: 1, jumpPressed: true }, 1, tuning)
      s.step(idle, 10, tuning)
      const residualSpeed = Math.abs(s.motor.velocity.z)
      let apex = s.body.translation().y
      for (let i = 0; i < 180; i++) { s.step(idle, 1, tuning); apex = Math.max(apex, s.body.translation().y) }
      results.push({ apex, residualSpeed })
    } finally { s.close() }
  }
  assert.ok(results[1].apex > results[0].apex + 5)
  assert.ok(results[1].residualSpeed < 0.1)
  assert.ok(results[0].residualSpeed > 10)
})

test('holding jump auto-hops only with enough Toonz force, without midair jumps', () => {
  for (const toonzForce of [0, 0.65]) {
    const s = setup()
    try {
      const tuning = { speed: 10, sprintSpeed: 18, toonzForce }
      s.step(idle, 30, tuning)
      let launches = 0
      for (let i = 0; i < 360; i++) {
        const grounded = s.motor.grounded
        const previousY = s.motor.velocity.y
        s.step({ ...idle, jumpHeld: true, jumpPressed: i === 0 }, 1, tuning)
        if (s.motor.velocity.y > 1 && s.motor.velocity.y > previousY + 1) {
          assert.equal(grounded, true, 'holding jump must not jump again in midair')
          launches++
        }
      }
      assert.equal(toonzForce === 0 ? launches === 1 : launches > 2, true)
    } finally { s.close() }
  }
})

test('every parkour transition is landable with the easy preset', async () => {
  const { parkourPads, parkourSpawn, standingOnPad } = await import('../src/physics/ParkourCourse.ts')
  for (let i = 0; i < parkourPads.length - 1; i++) {
    const s = setup({ floor: false })
    try {
      for (const pad of parkourPads) s.box(pad.x, pad.top - 0.6, pad.z, pad.width / 2, 0.6, pad.depth / 2)
      s.motor.reset(parkourSpawn(i))
      const tuning = { speed: 10, sprintSpeed: 18, toonzForce: 0.65 }
      s.step(idle, 30, tuning)
      const target = parkourPads[i + 1]
      let landed = false
      for (let frame = 0; frame < 240; frame++) {
        const p = s.body.translation()
        const dx = target.x - p.x
        const dz = target.z - p.z
        const distance = Math.hypot(dx, dz)
        s.step({ ...idle, forward: distance > 0.4 ? -dz / distance : 0,
          right: distance > 0.4 ? dx / distance : 0, jumpPressed: frame === 0 }, 1, tuning)
        if (s.motor.grounded && standingOnPad(s.body.translation(), i + 1)) { landed = true; break }
      }
      assert.equal(landed, true, `jump ${i + 1} → ${i + 2} must be reachable`)
    } finally { s.close() }
  }
})

test('jump-force changes affect the next jump without changing gravity or air control', () => {
  const s = setup()
  try {
    for (const jumpForce of [0.25, 1, 3]) {
      const tuning = { speed: 10, sprintSpeed: 18, toonzForce: 0.65, jumpForce }
      s.motor.reset({ x: 0, y: 2, z: 0 })
      s.step(idle, 30, tuning)
      s.step({ ...idle, jumpPressed: true }, 1, tuning)
      const launch = (10 + 0.65 * 8) * jumpForce
      assert.ok(Math.abs(s.motor.velocity.y - launch) < 0.001)
      // Changing the slider in flight must not add a second impulse.
      s.step(idle, 1, { ...tuning, jumpForce: 2 })
      assert.ok(Math.abs(s.motor.velocity.y - (launch - 20 * (1 - 0.65 * 0.2) / 60)) < 0.001)
      assert.equal(s.motor.velocity.x, 0)
      assert.equal(s.motor.velocity.z, 0)
    }
  } finally { s.close() }
})

test('Shift multiplier supports walking and sprinting relative to run speed', async () => {
  const { csMovementPreset } = await import('../src/physics/FirstPersonMotor.ts')
  const s = setup()
  try {
    s.step(idle, 30)
    for (const shiftMultiplier of [0.52, 1, 2]) {
      const tuning = { ...csMovementPreset, shiftMultiplier }
      s.step({ ...idle, forward: 1, shift: true }, 60, tuning)
      assert.ok(Math.abs(Math.abs(s.body.linvel().z) - tuning.speed * shiftMultiplier) < 0.05)
    }
  } finally { s.close() }
})

test('crouching preserves feet, fits under a roof, and waits for headroom before standing', async () => {
  const { csMovementPreset, playerShape } = await import('../src/physics/FirstPersonMotor.ts')
  const s = setup()
  try {
    s.box(0, 2.7, -5, 4, 0.25, 2)
    s.step(idle, 30, csMovementPreset)
    const initialFeet = s.body.translation().y - 1.9
    s.step({ ...idle, crouch: true }, 30, csMovementPreset)
    assert.equal(s.motor.crouched, true)
    assert.equal(s.body.collider(0).halfHeight(), playerShape.crouchHalfHeight)
    assert.ok(Math.abs(s.body.translation().y - 1.9 - initialFeet) < 0.01)
    assert.equal(s.motor.eyeOffset, playerShape.crouchEyeOffset)
    s.step({ ...idle, forward: 1, crouch: true }, 90, csMovementPreset)
    assert.ok(s.body.translation().z < -4, 'crouched capsule enters tunnel')
    assert.ok(Math.abs(Math.abs(s.body.linvel().z) - csMovementPreset.speed * csMovementPreset.crouchMultiplier) < 0.05)
    s.step(idle, 30, csMovementPreset)
    assert.equal(s.motor.crouched, true, 'releasing Ctrl under roof must not stand')
    s.step({ ...idle, forward: 1 }, 150, csMovementPreset)
    assert.equal(s.motor.crouched, false, 'automatically stands after clearing roof')
    assert.ok(Math.abs(s.body.collider(0).halfHeight() - playerShape.halfHeight) < 0.001)
    assert.ok(Math.abs(s.body.translation().y - 1.9 - initialFeet) < 0.02)
  } finally { s.close() }
})

test('crouch reset restores standing shape and CS air movement preserves momentum', async () => {
  const { csMovementPreset, playerShape } = await import('../src/physics/FirstPersonMotor.ts')
  const s = setup()
  try {
    s.step({ ...idle, crouch: true }, 30, csMovementPreset)
    s.motor.reset({ x: 0, y: 2, z: 0 })
    assert.equal(s.motor.crouched, false)
    assert.ok(Math.abs(s.body.collider(0).halfHeight() - playerShape.halfHeight) < 0.001)
    s.step(idle, 30, csMovementPreset)
    s.step({ ...idle, forward: 1 }, 30, csMovementPreset)
    s.step({ ...idle, forward: 1, jumpPressed: true }, 1, csMovementPreset)
    assert.ok(Math.abs(s.motor.velocity.y - csMovementPreset.jumpSpeed) < 0.001)
    const speed = s.motor.velocity.z
    s.step(idle, 10, csMovementPreset)
    assert.ok(Math.abs(s.motor.velocity.z - speed) < 0.001, 'releasing movement does not brake in midair')
    assert.ok(Math.abs(s.motor.velocity.y - (csMovementPreset.jumpSpeed - csMovementPreset.gravity / 6)) < 0.001)
  } finally { s.close() }
})

test('movement presets restore multiplier, jump tuning and air-control mode together', async () => {
  const { useMovementSettings } = await import('../src/store/MovementSettingsStore.ts')
  const state = useMovementSettings.getState()
  state.setShiftMultiplier(2)
  state.setJumpForce(3)
  state.parkourPreset()
  assert.equal(useMovementSettings.getState().shiftMultiplier, 1.8)
  assert.equal(useMovementSettings.getState().classicAirControl, false)
  state.reset()
  assert.equal(useMovementSettings.getState().shiftMultiplier, 0.52)
  assert.equal(useMovementSettings.getState().jumpForce, 1)
  assert.equal(useMovementSettings.getState().toonzForce, 0)
  assert.equal(useMovementSettings.getState().classicAirControl, true)
})

test('parkour gaps remain reachable with the default CS-style running jump', async () => {
  const { csMovementPreset } = await import('../src/physics/FirstPersonMotor.ts')
  const { parkourPads, standingOnPad } = await import('../src/physics/ParkourCourse.ts')
  for (let i = 0; i < parkourPads.length - 1; i++) {
    const s = setup({ floor: false })
    try {
      for (const pad of parkourPads) s.box(pad.x, pad.top - 0.6, pad.z, pad.width / 2, 0.6, pad.depth / 2)
      const from = parkourPads[i]
      const to = parkourPads[i + 1]
      const distance = Math.hypot(to.x - from.x, to.z - from.z)
      const dx = (to.x - from.x) / distance
      const dz = (to.z - from.z) / distance
      const edge = Math.min((from.width / 2 - 0.7) / Math.abs(dx), (from.depth / 2 - 0.7) / Math.abs(dz))
      s.motor.reset({ x: from.x + dx * edge, y: from.top + 2, z: from.z + dz * edge })
      s.step(idle, 30, csMovementPreset)
      // Arrive at the takeoff edge at full running speed, then jump across.
      s.motor.velocity.x = dx * csMovementPreset.speed
      s.motor.velocity.z = dz * csMovementPreset.speed
      let landed = false
      for (let frame = 0; frame < 100; frame++) {
        s.step({ ...idle, right: dx, forward: -dz, jumpPressed: frame === 0 }, 1, csMovementPreset)
        if (s.motor.grounded && standingOnPad(s.body.translation(), i + 1)) { landed = true; break }
      }
      assert.equal(landed, true, `default jump ${i + 1} → ${i + 2}`)
    } finally { s.close() }
  }
})
