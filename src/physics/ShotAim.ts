import type { RapierContext } from '@react-three/rapier'
import { Vector3, type PerspectiveCamera } from 'three'
import { projectileDefaults, projectileGroups } from './ProjectilePool.ts'

/** Match the muzzle's screen position across the viewmodel and world cameras. */
export function muzzleToCameraSpace(point: Vector3, viewFov: number, worldCamera: PerspectiveCamera) {
  const ratio = Math.tan(worldCamera.getEffectiveFOV() * Math.PI / 360) / Math.tan(viewFov * Math.PI / 360)
  point.x *= ratio
  point.y *= ratio
  return point
}

/** Reusable query scratch data; run only when a shot is ready. */
export class ShotAim {
  readonly origin = new Vector3()
  readonly direction = new Vector3()
  readonly target = new Vector3()
  private readonly travel = new Vector3()
  private readonly shape: InstanceType<RapierContext['rapier']['Ball']>
  private readonly ray: InstanceType<RapierContext['rapier']['Ray']>
  private readonly world: RapierContext['world']
  private readonly flags: number
  private readonly rotation = { x: 0, y: 0, z: 0, w: 1 }

  constructor(world: RapierContext['world'], rapier: RapierContext['rapier']) {
    this.world = world
    this.shape = new rapier.Ball(projectileDefaults.radius)
    this.ray = new rapier.Ray(new Vector3(), new Vector3())
    this.flags = rapier.QueryFilterFlags.EXCLUDE_SENSORS
  }

  resolve(eye: Vector3, forward: Vector3, muzzle: Vector3, distance: number) {
    Object.assign(this.ray.origin, eye)
    Object.assign(this.ray.dir, forward)
    const hit = this.world.castRay(this.ray, distance, true, this.flags, projectileGroups)
    this.target.copy(eye).addScaledVector(forward, hit?.timeOfImpact ?? distance)
    this.origin.copy(muzzle)
    this.travel.subVectors(muzzle, eye)
    // Sweep the full projectile volume: a ray alone misses corner overlaps.
    const obstruction = this.world.castShape(eye, this.rotation, this.travel, this.shape,
      0.01, 1, true, this.flags, projectileGroups)
    if (obstruction) return false
    this.direction.subVectors(this.target, muzzle)
    // Don't launch backwards when the crosshair is closer than the muzzle.
    if (this.direction.dot(forward) <= 0.001) return false
    this.direction.normalize()
    return true
  }
}
