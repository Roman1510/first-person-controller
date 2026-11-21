import type { RapierContext, RapierRigidBody } from '@react-three/rapier'

type World = RapierContext['world']
export const playerShape = { halfHeight: 1.4, radius: 0.5, eyeOffset: 1.55, crouchHalfHeight: 0.5, crouchEyeOffset: -0.25 }
export const movementDefaults = {
  speed: 20, sprintSpeed: 38, acceleration: 100, airAcceleration: 25,
  braking: 140, gravity: 20, jumpSpeed: 10, terminalSpeed: 55,
  stepHeight: 0.45, groundSnap: 0.3, maxSlope: Math.PI / 4,
  coyoteTime: 0.1, jumpBuffer: 0.12,
}
export interface MovementSpeeds {
  speed: number
  sprintSpeed?: number // Legacy absolute Shift speed; prefer shiftMultiplier.
  shiftMultiplier?: number
  crouchMultiplier?: number
  toonzForce?: number
  jumpForce?: number
  gravity?: number
  jumpSpeed?: number
  classicAirControl?: boolean
}

// CS-inspired proportions scaled for this world, not a GoldSrc engine emulation.
export const csMovementPreset = {
  speed: 12.5, shiftMultiplier: 0.52, crouchMultiplier: 0.34,
  gravity: 40, jumpSpeed: 13.4, classicAirControl: true, toonzForce: 0, jumpForce: 1,
}
export const easyParkourPreset = {
  ...csMovementPreset, speed: 10, shiftMultiplier: 1.8,
  gravity: 20, jumpSpeed: 10, classicAirControl: false, toonzForce: 0.65,
}

export interface MovementInput {
  forward: number
  right: number
  yaw: number
  sprint?: boolean
  shift?: boolean
  crouch?: boolean
  jumpPressed: boolean
  jumpHeld?: boolean
}

/** Physics-only motor: no camera, DOM, React state, or game-store dependencies. */
export class FirstPersonMotor {
  readonly controller: ReturnType<World['createCharacterController']>
  readonly body: RapierRigidBody
  readonly world: World
  grounded = false
  crouched = false
  velocity = { x: 0, y: 0, z: 0 }
  private readonly standingShape: ReturnType<RapierRigidBody['collider']>['shape']
  private support: RapierRigidBody | null = null
  private groundGrace = 0
  private bufferedJump = 0
  private readonly desired = { x: 0, y: 0, z: 0 }
  private readonly nextPosition = { x: 0, y: 0, z: 0 }
  private readonly solidCollider = (collider: ReturnType<RapierRigidBody['collider']>) =>
    !collider.isSensor() && collider.parent()?.handle !== this.body.handle

  constructor(world: World, body: RapierRigidBody) {
    this.world = world
    this.body = body
    this.standingShape = body.collider(0).shape
    this.controller = world.createCharacterController(0.025)
    this.controller.setMaxSlopeClimbAngle(movementDefaults.maxSlope)
    this.controller.setMinSlopeSlideAngle(movementDefaults.maxSlope)
    this.controller.enableAutostep(movementDefaults.stepHeight, 0.25, false)
    this.controller.enableSnapToGround(movementDefaults.groundSnap)
    this.controller.setApplyImpulsesToDynamicBodies(true)
    this.controller.setCharacterMass(80)
  }

  private updateCrouch(requested: boolean) {
    if (requested === this.crouched) return
    const collider = this.body.collider(0)
    if (!requested && this.world.intersectionWithShape(this.body.translation(), this.body.rotation(),
      this.standingShape, undefined, collider.collisionGroups(), collider, this.body, this.solidCollider)) return
    this.crouched = requested
    collider.setHalfHeight(requested ? playerShape.crouchHalfHeight : playerShape.halfHeight)
    // Keep feet fixed; body coordinates and checkpoint detection stay consistent.
    const offset = requested ? playerShape.crouchHalfHeight - playerShape.halfHeight : 0
    collider.setTranslationWrtParent({ x: 0, y: offset, z: 0 })
    // Rapier applies parent-relative edits on the next world step. Synchronize now
    // so this step's character query doesn't use the old collider center.
    const position = this.body.translation()
    collider.setTranslation({ x: position.x, y: position.y + offset, z: position.z })
  }

  get eyeOffset() { return this.crouched ? playerShape.crouchEyeOffset : playerShape.eyeOffset }

  reset(position: { x: number; y: number; z: number }) {
    this.crouched = false
    this.body.collider(0).setHalfHeight(playerShape.halfHeight)
    this.body.collider(0).setTranslationWrtParent({ x: 0, y: 0, z: 0 })
    this.body.setTranslation(position, true)
    this.body.setNextKinematicTranslation(position)
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    this.velocity = { x: 0, y: 0, z: 0 }
    this.grounded = false
    this.support = null
    this.groundGrace = 0
    this.bufferedJump = 0
  }

  step(input: MovementInput, dt: number, speeds: MovementSpeeds = movementDefaults) {
    this.updateCrouch(!!input.crouch)
    const config = movementDefaults
    const force = Number.isFinite(speeds.toonzForce) ? Math.min(1, Math.max(0, speeds.toonzForce ?? 0)) : 0
    const jumpForce = Number.isFinite(speeds.jumpForce) ? Math.min(3, Math.max(0.25, speeds.jumpForce ?? 1)) : 1
    const coyoteTime = config.coyoteTime + force * 0.15
    const jumpBuffer = config.jumpBuffer + force * 0.13
    const gravity = (speeds.gravity ?? config.gravity) * (1 - force * 0.2)
    this.groundGrace = this.grounded ? coyoteTime : Math.max(0, this.groundGrace - dt)
    this.bufferedJump = input.jumpPressed ? jumpBuffer : Math.max(0, this.bufferedJump - dt)
    // Yaw only: pitch never changes ground speed. Normalize diagonal input.
    const length = Math.max(1, Math.hypot(input.forward, input.right))
    const shiftSpeed = speeds.shiftMultiplier === undefined
      ? speeds.sprintSpeed ?? config.sprintSpeed
      : speeds.speed * Math.min(3, Math.max(0.1, speeds.shiftMultiplier))
    const desiredSpeed = (input.shift ?? input.sprint) ? shiftSpeed : speeds.speed
    const speed = this.crouched ? Math.min(desiredSpeed, speeds.speed * (speeds.crouchMultiplier ?? 0.34)) : desiredSpeed
    const sin = Math.sin(input.yaw)
    const cos = Math.cos(input.yaw)
    const x = (input.right * cos - input.forward * sin) / length * speed
    const z = (-input.right * sin - input.forward * cos) / length * speed
    const moving = input.forward !== 0 || input.right !== 0
    const acceleration = this.grounded ? (moving ? config.acceleration : config.braking) : config.airAcceleration + force * (moving ? 100 : 160)
    if (!this.grounded && speeds.classicAirControl && force === 0) {
      // Preserve momentum in flight; accelerate only along the requested direction.
      const wishSpeed = Math.hypot(x, z)
      if (wishSpeed > 0) {
        const along = (this.velocity.x * x + this.velocity.z * z) / wishSpeed
        const added = Math.max(0, Math.min(Math.min(wishSpeed, 1.5) - along, 10 * wishSpeed * dt))
        this.velocity.x += x / wishSpeed * added
        this.velocity.z += z / wishSpeed * added
      }
    } else {
      const difference = Math.hypot(x - this.velocity.x, z - this.velocity.z)
      const blend = difference === 0 ? 1 : Math.min(1, acceleration * dt / difference)
      this.velocity.x += (x - this.velocity.x) * blend
      this.velocity.z += (z - this.velocity.z) * blend
    }

    const platformVelocity = this.support?.isValid() ? this.support.linvel() : { x: 0, y: 0, z: 0 }
    const jumping = (this.bufferedJump > 0 || (force >= 0.5 && input.jumpHeld)) && this.groundGrace > 0
    if (jumping) {
      this.velocity.y = ((speeds.jumpSpeed ?? config.jumpSpeed) + force * 8) * jumpForce + Math.max(0, platformVelocity.y)
      this.velocity.x += platformVelocity.x
      this.velocity.z += platformVelocity.z
      this.bufferedJump = 0
      this.groundGrace = 0
      this.grounded = false
    } else {
      this.velocity.y = this.grounded ? -2 : Math.max(-config.terminalSpeed, this.velocity.y - gravity * dt)
    }
    // No stair assistance or snapping in flight.
    if (this.grounded && !jumping) {
      this.controller.enableAutostep(config.stepHeight, 0.25, false)
      this.controller.enableSnapToGround(config.groundSnap)
    } else {
      this.controller.disableAutostep()
      this.controller.disableSnapToGround()
    }
    // Rapier already transfers supporting-platform motion during movement correction.
    const desired = this.desired
    desired.x = this.velocity.x * dt
    desired.y = this.velocity.y * dt
    desired.z = this.velocity.z * dt
    this.controller.computeColliderMovement(this.body.collider(0), desired, undefined, this.body.collider(0).collisionGroups(),
      this.solidCollider)
    const movement = this.controller.computedMovement()
    const position = this.body.translation()
    this.nextPosition.x = position.x + movement.x
    this.nextPosition.y = position.y + movement.y
    this.nextPosition.z = position.z + movement.z
    this.body.setNextKinematicTranslation(this.nextPosition)
    this.grounded = this.controller.computedGrounded() && !jumping
    this.support = null
    for (let i = 0; i < this.controller.numComputedCollisions(); i++) {
      const hit = this.controller.computedCollision(i)
      if (!hit) continue
      if (this.grounded && hit.normal1.y >= Math.cos(config.maxSlope)) this.support = hit.collider?.parent() ?? null
      if (hit.normal1.y < -0.5 && this.velocity.y > 0) this.velocity.y = 0
    }
    if (this.grounded) this.velocity.y = 0
  }

  dispose() { this.world.removeCharacterController(this.controller) }
}
