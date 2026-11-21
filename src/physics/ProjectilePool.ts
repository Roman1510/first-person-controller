import { weapons, type Weapon } from './Weapons.ts'
import type { RapierContext, RapierRigidBody } from '@react-three/rapier'

type Vector = { x: number; y: number; z: number }
export const projectileDefaults = { capacity: 32, radius: 0.22, speed: 65, mass: 1.5, lifetime: 6, cooldown: 0.15 }
// World uses group 0, player group 1, projectiles group 2.
export const projectileGroups = (1 << 2) << 16 | 1
export const playerGroups = (1 << 1) << 16 | 1

/** Bounded, reusable rigid bodies. All timers advance with simulation time. */
export class ProjectilePool {
  readonly slots: { body: RapierRigidBody; remaining: number }[] = []
  private cursor = 0
  private cooldown = 0
  private readonly world: RapierContext['world']
  private readonly rapier: RapierContext['rapier']

  constructor(world: RapierContext['world'], rapier: RapierContext['rapier']) {
    this.world = world
    this.rapier = rapier
  }

  get ready() { return this.cooldown <= 0 }

  fire(origin: Vector, direction: Vector, weapon: Weapon = weapons[0]) {
    if (this.cooldown > 0) return false
    const length = Math.hypot(direction.x, direction.y, direction.z)
    if (!Number.isFinite(length) || length === 0) return false
    let slot = this.slots[this.cursor]
    if (!slot) {
      const body = this.world.createRigidBody(this.rapier.RigidBodyDesc.dynamic().setCcdEnabled(true))
      this.world.createCollider(this.rapier.ColliderDesc.ball(projectileDefaults.radius)
        .setMass(projectileDefaults.mass).setRestitution(0.35).setFriction(0.5)
        .setCollisionGroups(projectileGroups), body)
      slot = { body, remaining: 0 }
      this.slots.push(slot)
    }
    slot.body.collider(0).setMass(weapon.mass)
    slot.body.recomputeMassPropertiesFromColliders()
    slot.body.setEnabled(true)
    slot.body.setTranslation(origin, true)
    slot.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
    slot.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    const speed = weapon.speed / length
    slot.body.setLinvel({ x: direction.x * speed, y: direction.y * speed, z: direction.z * speed }, true)
    slot.remaining = projectileDefaults.lifetime
    this.cursor = (this.cursor + 1) % projectileDefaults.capacity
    this.cooldown = weapon.cooldown
    return true
  }

  step(dt: number) {
    this.cooldown = Math.max(0, this.cooldown - dt)
    for (const slot of this.slots) {
      if (slot.remaining <= 0) continue
      slot.remaining -= dt
      if (slot.remaining <= 0 || slot.body.translation().y < -50) {
        slot.remaining = 0
        slot.body.setEnabled(false)
      }
    }
  }

  reset() {
    for (const slot of this.slots) {
      slot.remaining = 0
      slot.body.setEnabled(false)
    }
    this.cursor = 0
    this.cooldown = 0
  }

  dispose() {
    for (const slot of this.slots) this.world.removeRigidBody(slot.body)
    this.slots.length = 0
  }
}
