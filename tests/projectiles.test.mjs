import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { ProjectilePool, projectileDefaults, playerGroups } from '../src/physics/ProjectilePool.ts'
const require = createRequire(import.meta.url)
const R = createRequire(require.resolve('@react-three/rapier'))('@dimforge/rapier3d-compat')
await R.init()

function setup() {
  const world = new R.World({ x: 0, y: -20, z: 0 })
  const pool = new ProjectilePool(world, R)
  const step = (count) => {
    for (let i = 0; i < count; i++) { pool.step(1 / 60); world.step() }
  }
  return { world, pool, step, close: () => { pool.dispose(); world.free() } }
}
const forward = { x: 0, y: 0, z: -1 }

test('shots obey gravity, ignore the player, and transfer momentum to boxes', () => {
  const s = setup()
  try {
    const player = s.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 2, 0))
    s.world.createCollider(R.ColliderDesc.capsule(1.4, 0.5).setCollisionGroups(playerGroups), player)
    const target = s.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, 2, -5))
    s.world.createCollider(R.ColliderDesc.cuboid(0.75, 0.75, 0.75), target)
    s.pool.fire({ x: 0, y: 2, z: 0 }, forward)
    s.step(20)
    assert.ok(target.translation().z < -5.5, 'box receives a physical impact')
    assert.ok(s.pool.slots[0].body.translation().y < 2, 'shot falls under gravity')
    assert.equal(player.translation().z, 0)
  } finally { s.close() }
})

test('CCD prevents a fast projectile from passing through a thin wall', () => {
  const s = setup()
  try {
    s.world.createCollider(R.ColliderDesc.cuboid(5, 5, 0.025).setTranslation(0, 2, -0.6))
    s.pool.fire({ x: 0, y: 2, z: 0 }, forward)
    s.step(5)
    assert.ok(s.pool.slots[0].body.translation().z > -0.6)
  } finally { s.close() }
})

test('fire rate, body count, expiry, reset and reuse remain bounded', () => {
  const s = setup()
  try {
    const origin = { x: 0, y: 5, z: 0 }
    assert.equal(s.pool.fire(origin, forward), true)
    assert.equal(s.pool.fire(origin, forward), false)
    for (let i = 0; i < 100; i++) {
      s.step(10)
      assert.equal(s.pool.fire(origin, forward), true)
    }
    assert.equal(s.pool.slots.length, projectileDefaults.capacity)
    s.step(370)
    assert.ok(s.pool.slots.every((slot) => !slot.body.isEnabled()))
    s.pool.reset()
    assert.equal(s.pool.fire(origin, forward), true)
    assert.equal(s.pool.slots.length, projectileDefaults.capacity)
    s.pool.reset()
    assert.ok(s.pool.slots.every((slot) => slot.remaining === 0 && !slot.body.isEnabled()))
    s.pool.dispose()
    assert.equal(s.world.bodies.len(), 0)
  } finally { s.close() }
})

test('weapon switching changes speed and mass but cannot bypass shot cooldown', async () => {
  const { weapons } = await import('../src/physics/Weapons.ts')
  const s = setup()
  try {
    const origin = { x: 0, y: 5, z: 0 }
    assert.equal(s.pool.fire(origin, forward, weapons[2]), true)
    assert.equal(s.pool.fire(origin, forward, weapons[1]), false)
    s.step(10)
    assert.equal(s.pool.fire(origin, forward, weapons[1]), false)
    s.step(30)
    assert.equal(s.pool.fire(origin, forward, weapons[1]), true)
    assert.ok(Math.abs(s.pool.slots[1].body.linvel().z + weapons[1].speed) < 0.01)
    assert.ok(Math.abs(s.pool.slots[1].body.mass() - weapons[1].mass) < 0.01)
    s.pool.reset()
    assert.equal(s.pool.fire(origin, forward, weapons[0]), true)
    assert.ok(Math.abs(s.pool.slots[0].body.mass() - weapons[0].mass) < 0.01, 'reused heavy shot receives blaster mass')
  } finally { s.close() }
})

test('weapon wheel selection wraps in both directions and ignores empty input', async () => {
  const { useWeaponStore } = await import('../src/store/WeaponStore.ts')
  useWeaponStore.setState({ selected: 0 })
  const cycle = useWeaponStore.getState().cycle
  cycle(-1)
  assert.equal(useWeaponStore.getState().selected, 2)
  cycle(1)
  assert.equal(useWeaponStore.getState().selected, 0)
  cycle(100)
  assert.equal(useWeaponStore.getState().selected, 1)
  cycle(0)
  cycle(NaN)
  assert.equal(useWeaponStore.getState().selected, 1)
  useWeaponStore.setState({ selected: 0 })
})

test('muzzle launch converges on the crosshair hit and ignores the player', async () => {
  const { ShotAim } = await import('../src/physics/ShotAim.ts')
  const { Vector3 } = await import('three')
  const s = setup()
  try {
    const player = s.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 2, 0))
    s.world.createCollider(R.ColliderDesc.capsule(1.4, 0.5).setCollisionGroups(playerGroups), player)
    s.world.createCollider(R.ColliderDesc.cuboid(2, 2, 0.1).setTranslation(0, 2, -10))
    s.world.step()
    const aim = new ShotAim(s.world, R)
    const eye = new Vector3(0, 2, 0)
    const muzzle = new Vector3(0.3, 1.8, -1.25)
    assert.equal(aim.resolve(eye, new Vector3(0, 0, -1), muzzle, 100), true)
    assert.ok(Math.abs(aim.target.z + 9.9) < 0.01)
    assert.ok(aim.origin.distanceTo(muzzle) < 0.001)
    const arrival = aim.origin.clone().addScaledVector(aim.direction, aim.origin.distanceTo(aim.target))
    assert.ok(arrival.distanceTo(aim.target) < 0.001)
    assert.equal(aim.resolve(eye, new Vector3(0, 0, -1), eye, 100), true, 'camera mode also works')
  } finally { s.close() }
})

test('muzzle sweep blocks thin walls and corners before spawning', async () => {
  const { ShotAim } = await import('../src/physics/ShotAim.ts')
  const { Vector3 } = await import('three')
  for (const x of [0, 0.35]) {
    const s = setup()
    try {
      s.world.createCollider(R.ColliderDesc.cuboid(0.1, 2, 0.025).setTranslation(x, 2, -0.6))
      s.world.step()
      const aim = new ShotAim(s.world, R)
      assert.equal(aim.resolve(new Vector3(0, 2, 0), new Vector3(0, 0, -1), new Vector3(0.3, 1.8, -1.25), 100), false)
    } finally { s.close() }
  }
})

test('empty-space aim uses fallback range and muzzle projection matches both cameras', async () => {
  const { ShotAim, muzzleToCameraSpace } = await import('../src/physics/ShotAim.ts')
  const { Vector3, PerspectiveCamera } = await import('three')
  const s = setup()
  try {
    const aim = new ShotAim(s.world, R)
    assert.equal(aim.resolve(new Vector3(0, 2, 0), new Vector3(0, 0, -1), new Vector3(0.3, 1.8, -1.25), 80), true)
    assert.equal(aim.target.z, -80)
    for (const aspect of [1, 16 / 9]) {
      const view = new PerspectiveCamera(60, aspect, 0.01, 10)
      const world = new PerspectiveCamera(75, aspect, 0.05, 1000)
      const point = new Vector3(0.23, -0.17, -1.25)
      const expected = point.clone().project(view)
      const actual = muzzleToCameraSpace(point.clone(), 60, world).project(world)
      assert.ok(Math.abs(expected.x - actual.x) < 1e-6)
      assert.ok(Math.abs(expected.y - actual.y) < 1e-6)
    }
  } finally { s.close() }
})
