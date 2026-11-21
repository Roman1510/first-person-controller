import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useBeforePhysicsStep, useRapier } from '@react-three/rapier'
import { button, useControls } from 'leva'
import { ShotAim } from '../physics/ShotAim'
import { useMovementDebug } from '../store/MovementDebugStore'
import { InstancedMesh, Matrix4, Vector3 } from 'three'
import { ProjectilePool, projectileDefaults } from '../physics/ProjectilePool'
import { weapons } from '../physics/Weapons'
import { useWeaponStore } from '../store/WeaponStore'
import { WeaponViewModel } from './WeaponViewModel'
import { useSessionStore } from '../store/SessionStore'

export function ProjectileLauncher({ onReset }: { onReset: () => void }) {
  const { world, rapier } = useRapier()
  const { camera, gl } = useThree()
  const aim = useMemo(() => new ShotAim(world, rapier), [world, rapier])
  const muzzle = useRef(new Vector3(0.306, -0.226, -1.25))
  const origin = useRef(new Vector3())
  const [settings, setSettings] = useControls('Projectile launch', () => ({
    origin: { value: 'Muzzle', options: ['Muzzle', 'Camera'] },
    offsetX: { label: 'Right offset', value: 0, min: -1, max: 1, step: 0.01 },
    offsetY: { label: 'Up offset', value: 0, min: -1, max: 1, step: 0.01 },
    offsetZ: { label: 'Forward offset', value: 0, min: -1, max: 1, step: 0.01 },
    aimDistance: { label: 'Fallback distance', value: 100, min: 5, max: 250, step: 1 },
    'Reset launch': button(() => setSettings({ origin: 'Muzzle', offsetX: 0, offsetY: 0, offsetZ: 0, aimDistance: 100 })),
  }))
  const pool = useRef<ProjectilePool | null>(null)
  const mesh = useRef<InstancedMesh>(null)
  const shots = useRef(0)
  const held = useRef(false)
  const pressed = useRef(false)
  const direction = useRef(new Vector3())
  const matrix = useRef(new Matrix4())

  useEffect(() => {
    const projectiles = new ProjectilePool(world, rapier)
    pool.current = projectiles
    const active = () => !useSessionStore.getState().paused && document.pointerLockElement === gl.domElement
    const clear = () => { held.current = false; pressed.current = false }
    const down = (event: MouseEvent) => {
      if (event.button === 0 && active()) { held.current = true; pressed.current = true }
    }
    const up = (event: MouseEvent) => { if (event.button === 0) held.current = false }
    let lastWheelTime = -Infinity
    const wheel = (event: WheelEvent) => {
      if (!active() || event.ctrlKey || event.deltaY === 0) return
      event.preventDefault()
      // Trackpads emit many small events; avoid cycling several weapons per gesture.
      if (event.timeStamp - lastWheelTime < 150) return
      lastWheelTime = event.timeStamp
      useWeaponStore.getState().cycle(event.deltaY)
    }
    const reset = (event: KeyboardEvent) => {
      if (event.code === 'KeyT' && !event.repeat && active()) {
        clear()
        projectiles.reset()
        onReset()
      }
    }
    const contextMenu = (event: MouseEvent) => { if (active()) event.preventDefault() }
    gl.domElement.addEventListener('contextmenu', contextMenu)
    window.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('mousedown', down)
    window.addEventListener('mouseup', up)
    window.addEventListener('keydown', reset)
    window.addEventListener('blur', clear)
    document.addEventListener('pointerlockchange', clear)
    document.addEventListener('visibilitychange', clear)
    return () => {
      gl.domElement.removeEventListener('contextmenu', contextMenu)
      window.removeEventListener('wheel', wheel)
      window.removeEventListener('mousedown', down)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('keydown', reset)
      window.removeEventListener('blur', clear)
      document.removeEventListener('pointerlockchange', clear)
      document.removeEventListener('visibilitychange', clear)
      pool.current = null
      projectiles.dispose()
    }
  }, [world, rapier, camera, gl, onReset])

  useBeforePhysicsStep(() => {
    const projectiles = pool.current
    if (!projectiles) return
    projectiles.step(world.timestep)
    const firing = (held.current || pressed.current) && !useSessionStore.getState().paused && document.pointerLockElement === gl.domElement
    if (firing && projectiles.ready) {
      camera.getWorldDirection(direction.current)
      if (settings.origin === 'Muzzle') origin.current.copy(muzzle.current)
      else origin.current.set(0, 0, 0)
      origin.current.x += settings.offsetX
      origin.current.y += settings.offsetY
      origin.current.z -= settings.offsetZ
      origin.current.applyQuaternion(camera.quaternion).add(camera.position)
      const clear = aim.resolve(camera.position, direction.current, origin.current, settings.aimDistance)
      if (useMovementDebug.getState().shotBlocked === clear) useMovementDebug.setState({ shotBlocked: !clear })
      if (clear && projectiles.fire(aim.origin, aim.direction, weapons[useWeaponStore.getState().selected])) shots.current++
    }
    if (!firing && useMovementDebug.getState().shotBlocked) useMovementDebug.setState({ shotBlocked: false })
    pressed.current = false
  })

  useFrame(() => {
    if (!mesh.current) return
    const slots = pool.current?.slots ?? []
    mesh.current.count = slots.length
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      if (slot.remaining > 0) {
        const position = slot.body.translation()
        matrix.current.makeTranslation(position.x, position.y, position.z)
      } else matrix.current.makeScale(0, 0, 0)
      mesh.current.setMatrixAt(i, matrix.current)
    }
    if (slots.length) mesh.current.instanceMatrix.needsUpdate = true
  })

  return <>
    <WeaponViewModel shots={shots} muzzle={muzzle} />
    <instancedMesh ref={mesh} args={[undefined, undefined, projectileDefaults.capacity]} frustumCulled={false}>
    <sphereGeometry args={[projectileDefaults.radius, 12, 8]} />
    <meshStandardMaterial color="#ffe29a" emissive="#d97719" emissiveIntensity={0.6} roughness={0.4} />
  </instancedMesh>
  </>
}
