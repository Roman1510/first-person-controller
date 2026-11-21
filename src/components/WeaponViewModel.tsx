import { createPortal, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import { Group, MathUtils, PerspectiveCamera, Scene, Vector3 } from 'three'
import { muzzleToCameraSpace } from '../physics/ShotAim'
import { useWeaponStore } from '../store/WeaponStore'
import { useMovementDebug } from '../store/MovementDebugStore'
import { useSessionStore } from '../store/SessionStore'

type Triple = [number, number, number]
function Part({ position, size, color, rotation = [0, 0, 0] }: {
  position: Triple; size: Triple; color: string; rotation?: Triple
}) {
  return <mesh position={position} rotation={rotation}>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={0.55} metalness={0.25} />
  </mesh>
}

function Arm({ left = false }: { left?: boolean }) {
  return <group position={left ? [-0.24, -0.3, -0.12] : [0.19, -0.34, 0.12]}
    rotation={left ? [0.12, -0.65, -0.22] : [-0.15, 0.1, 0.12]}>
    <Part position={[0, 0, 0.1]} size={[0.15, 0.17, 0.43]} color="#304b58" />
    <Part position={[0, 0.015, -0.11]} size={[0.16, 0.18, 0.07]} color="#b8c5c6" />
    <Part position={[0, 0.01, -0.21]} size={[0.12, 0.14, 0.14]} color="#bd8b68" />
    <Part position={[0, 0.015, -0.3]} size={[0.15, 0.15, 0.14]} color="#202d38" />
    <Part position={[0.07, 0.055, -0.3]} size={[0.055, 0.07, 0.11]} color="#344957" />
  </group>
}

/** Separate depth pass keeps the cosmetic hands out of world collision and walls. */
export function WeaponViewModel({ shots, muzzle }: { shots: RefObject<number>; muzzle: RefObject<Vector3> }) {
  const selected = useWeaponStore((state) => state.selected)
  const { size } = useThree()
  const scene = useMemo(() => new Scene(), [])
  const camera = useMemo(() => new PerspectiveCamera(60, 1, 0.01, 10), [])
  const rig = useRef<Group>(null)
  const flash = useRef<Group>(null)
  const animation = useRef({ shot: 0, kick: 0, flash: 0, phase: 0, equip: 0, weapon: selected })
  const heavy = selected === 2
  const rapid = selected === 1
  const barrelLength = heavy ? 0.48 : rapid ? 0.62 : 0.4
  const muzzleZ = -0.35 - barrelLength
  const accent = heavy ? '#f1aa53' : rapid ? '#70d6cc' : '#8eafff'

  useFrame(({ gl, scene: world, camera: worldCamera }, delta) => {
    const state = animation.current
    if (state.weapon !== selected) { state.weapon = selected; state.equip = 0.18; state.kick = 0; state.flash = 0 }
    if (!useSessionStore.getState().paused) {
      const dt = Math.min(delta, 0.05)
      state.flash = Math.max(0, state.flash - dt)
      if (state.shot !== shots.current) {
        state.shot = shots.current
        state.kick = heavy ? 0.12 : rapid ? 0.035 : 0.065
        state.flash = 0.045
      }
      state.kick = MathUtils.damp(state.kick, 0, 16, dt)
      state.equip = MathUtils.damp(state.equip, 0, 12, dt)
      const movement = useMovementDebug.getState()
      const stride = movement.grounded ? Math.min(movement.speed / 20, 1.5) : 0
      state.phase += dt * (8 + stride * 4)
      if (rig.current) {
        rig.current.position.set(0.23 + Math.sin(state.phase) * stride * 0.009,
          -0.17 + Math.cos(state.phase * 2) * stride * 0.008 - state.equip, -0.5 + state.kick)
        rig.current.rotation.x = state.kick * 0.7
      }
    }
    if (flash.current) flash.current.visible = state.flash > 0
    const aspect = size.width / size.height
    if (camera.aspect !== aspect) { camera.aspect = aspect; camera.updateProjectionMatrix() }
    if (rig.current && worldCamera instanceof PerspectiveCamera) {
      rig.current.updateWorldMatrix(true, false)
      muzzle.current.set(0, 0, muzzleZ).applyMatrix4(rig.current.matrixWorld)
      muzzleToCameraSpace(muzzle.current, camera.fov, worldCamera)
    }
    // Taking over rendering at priority 1 lets the player camera update first.
    const autoClear = gl.autoClear
    gl.autoClear = true
    gl.render(world, worldCamera)
    gl.autoClear = false
    gl.clearDepth()
    gl.render(scene, camera)
    gl.autoClear = autoClear
  }, 1)

  return createPortal(<>
    <ambientLight intensity={1.5} />
    <directionalLight position={[-2, 4, 3]} intensity={2.5} />
    <group ref={rig} position={[0.23, -0.17, -0.5]}>
      <Arm />
      <Arm left />
      <Part position={[0.07, -0.12, -0.19]} size={[0.12, 0.25, 0.13]} color="#202b36" rotation={[-0.2, 0, 0]} />
      <Part position={[0, 0, -0.3]} size={[heavy ? 0.25 : 0.18, heavy ? 0.23 : 0.17, 0.45]} color="#344757" />
      <Part position={[0, 0.095, -0.32]} size={[0.12, 0.035, 0.35]} color={accent} />
      <Part position={[0.1, 0, -0.26]} size={[0.025, 0.065, 0.18]} color={accent} />
      <Part position={[0, -0.15, -0.4]} size={[0.1, rapid ? 0.27 : 0.13, 0.14]} color="#1d2933" rotation={[0.15, 0, 0]} />
      <mesh position={[0, 0, -0.35 - barrelLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[heavy ? 0.1 : 0.045, heavy ? 0.1 : 0.055, barrelLength, 12]} />
        <meshStandardMaterial color="#192632" metalness={0.65} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, muzzleZ]}>
        <torusGeometry args={[heavy ? 0.09 : 0.045, 0.015, 6, 12]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      <Part position={[0, 0.14, -0.22]} size={[0.035, 0.06, 0.045]} color="#15212a" />
      <Part position={[0, 0.145, -0.51]} size={[0.025, 0.04, 0.025]} color={accent} />
      <group ref={flash} position={[0, 0, muzzleZ - 0.05]} visible={false}>
        <mesh scale={[0.09, 0.09, 0.18]}>
          <octahedronGeometry args={[1]} />
          <meshBasicMaterial color="#ffe4a1" toneMapped={false} />
        </mesh>
      </group>
    </group>
  </>, scene)
}
