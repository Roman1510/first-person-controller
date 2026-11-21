import { useFrame, useThree } from '@react-three/fiber'
import { RefObject, useEffect, useRef } from 'react'
import { Euler, Group, MathUtils, Vector3 } from 'three'
import { RapierRigidBody, useBeforePhysicsStep, useRapier } from '@react-three/rapier'
import { FirstPersonMotor, playerShape } from '../physics/FirstPersonMotor'
import { PlayerInput } from './usePhysicalKeyboard'
import { useSessionStore } from '../store/SessionStore'
import { useMovementSettings } from '../store/MovementSettingsStore'
import { parkourPads, parkourSpawn, standingOnPad } from '../physics/ParkourCourse'
import { useParkourStore } from '../store/ParkourStore'
import { useMovementDebug } from '../store/MovementDebugStore'

export const usePlayerControl = (
  body: RefObject<RapierRigidBody | null>, visual: RefObject<Group | null>,
  input: RefObject<PlayerInput>,
  spawn: [number, number, number], initialYaw: number, debug: boolean,
) => {
  const { world } = useRapier()
  const { camera, gl } = useThree()
  const motor = useRef<FirstPersonMotor | null>(null)
  const rotation = useRef(new Euler(0, 0, 0, 'YXZ'))
  const eye = useRef(new Vector3())
  const cameraHeight = useRef(playerShape.eyeOffset)
  const reportTime = useRef(0)
  const spawnRef = useRef(spawn)
  spawnRef.current = spawn

  useEffect(() => {
    if (!body.current) return
    const controller = new FirstPersonMotor(world, body.current)
    motor.current = controller
    camera.rotation.set(0, initialYaw, 0, 'YXZ')
    return () => { motor.current = null; controller.dispose() }
  }, [world, body, camera, initialYaw])

  useBeforePhysicsStep(() => {
    const controller = motor.current
    if (!controller) return
    const active = !useSessionStore.getState().paused && document.pointerLockElement === gl.domElement
    const keys = input.current.keys
    const course = useParkourStore.getState()
    const position = controller.body.translation()
    const fell = position.y < (course.active ? -4 : -100)
    if (course.request || input.current.resetPressed || fell) {
      const starting = course.request === 'start'
      const leaving = course.request === 'lab'
      const inCourse = starting || (course.active && !leaving)
      const [x, y, z] = spawnRef.current
      cameraHeight.current = playerShape.eyeOffset
      controller.reset(inCourse ? parkourSpawn(starting ? 0 : course.checkpoint) : { x, y, z })
      camera.rotation.set(0, inCourse ? 0 : initialYaw, 0, 'YXZ')
      if (starting || leaving) useParkourStore.setState({ active: starting, checkpoint: 0, progress: 0, falls: 0, finished: false, request: null })
      else if (course.active) useParkourStore.setState({ progress: course.checkpoint, finished: course.checkpoint === parkourPads.length - 1, falls: course.falls + (fell ? 1 : 0) })
      input.current.resetPressed = false
      input.current.jumpPressed = false
      input.current.keys.clear()
      return
    }
    if (course.active && !course.finished && controller.grounded) {
      const next = course.progress + 1
      if (next < parkourPads.length && standingOnPad(position, next)) {
        useParkourStore.setState({ progress: next,
          checkpoint: parkourPads[next].checkpoint ? next : course.checkpoint,
          finished: next === parkourPads.length - 1 })
      }
    }
    rotation.current.setFromQuaternion(camera.quaternion, 'YXZ')
    const down = (a: string, b: string) => Number(keys.has(a) || keys.has(b))
    controller.step({
      forward: active ? down('KeyW', 'ArrowUp') - down('KeyS', 'ArrowDown') : 0,
      right: active ? down('KeyD', 'ArrowRight') - down('KeyA', 'ArrowLeft') : 0,
      yaw: rotation.current.y, shift: active && !!down('ShiftLeft', 'ShiftRight'),
      jumpPressed: active && input.current.jumpPressed,
      jumpHeld: active && keys.has('Space'),
      crouch: active && !!down('ControlLeft', 'ControlRight'),
    }, world.timestep, useMovementSettings.getState())
    input.current.jumpPressed = false
    if (debug) {
      reportTime.current += world.timestep
      if (reportTime.current >= 0.1) {
        reportTime.current = 0
        const velocity = controller.body.linvel()
        useMovementDebug.setState({ grounded: controller.grounded, crouched: controller.crouched, speed: Math.hypot(velocity.x, velocity.z), height: controller.body.translation().y - playerShape.halfHeight - playerShape.radius })
      }
    }
  })

  // Physics runs at priority -1; follow its interpolated object at priority 0.
  useFrame((_, delta) => {
    if (!visual.current) return
    visual.current.getWorldPosition(eye.current)
    if (!useSessionStore.getState().paused) cameraHeight.current = MathUtils.damp(cameraHeight.current,
      motor.current?.eyeOffset ?? playerShape.eyeOffset, 22, Math.min(delta, 0.05))
    eye.current.y += cameraHeight.current
    camera.position.copy(eye.current)
    camera.updateMatrixWorld()
  })
}
