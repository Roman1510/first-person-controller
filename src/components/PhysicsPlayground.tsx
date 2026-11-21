import { memo, useCallback, useRef, useState } from 'react'
import { CuboidCollider, Physics, RapierRigidBody, RigidBody, useBeforePhysicsStep, useRapier } from '@react-three/rapier'
import { Block, Sign } from './PlaygroundPrimitives'
import { boxGeometry, blockMaterial } from './playgroundResources'
import { ParkourTrack } from './ParkourTrack'
import { ProjectileLauncher } from './ShootingRange'
import { Player } from './Player'
import { usePause } from '../store/SessionStore'

function Shuttle() {
  const body = useRef<RapierRigidBody>(null)
  const time = useRef(0)
  const { world } = useRapier()
  useBeforePhysicsStep(() => {
    time.current += world.timestep
    body.current?.setNextKinematicTranslation({ x: 21 + Math.sin(time.current * 0.55) * 7, y: 0.25, z: -25 })
  })
  return <RigidBody ref={body} type="kinematicPosition" position={[21, 0.25, -25]} colliders={false}>
    <CuboidCollider args={[3, 0.25, 3]} friction={1} />
    <mesh geometry={boxGeometry} material={blockMaterial('#38bda9')} scale={[6, 0.5, 6]} dispose={null} />
  </RigidBody>
}
export function PhysicsPlayground() {
  const pause = usePause()
  return <>
    <color attach="background" args={['#101b2d']} />
    <fog attach="fog" args={['#101b2d', 90, 180]} />
    <ambientLight intensity={1.2} />
    <directionalLight position={[20, 40, 20]} intensity={2.5} />
    <gridHelper args={[120, 60, '#4b718c', '#293d53']} position={[0, 0.012, -15]} />
    <Physics paused={pause} timeStep={1 / 60} updatePriority={-1} gravity={[0, -20, 0]}>
      <Course />
    </Physics>
  </>
}

const Course = memo(function Course() {
  return <>
      <Block position={[0, -0.5, -15]} size={[120, 1, 120]} color="#172a3d" />
      <Sign position={[-20, 5, 0]}>01 / STAIRS · 0.35 units</Sign>
      {Array.from({ length: 8 }, (_, i) => <Block key={i} position={[-20, (i + 1) * 0.175, -4 - i * 1.5]} size={[7, (i + 1) * 0.35, 1.5]} color={i % 2 ? '#db9d4e' : '#b77b38'} />)}
      <Sign position={[-7, 5, -8]}>02 / WALKABLE · 25°</Sign>
      <Block position={[-7, 2.35, -14]} size={[7, 0.5, 12]} rotation={[25 * Math.PI / 180, 0, 0]} color="#5486cc" />
      <Sign position={[5, 5, -8]}>03 / TOO STEEP · 60°</Sign>
      <Block position={[5, 4.9, -14]} size={[6, 0.5, 12]} rotation={[Math.PI / 3, 0, 0]} color="#d36871" />
      <Sign position={[21, 5, -20]}>04 / MOVING PLATFORM</Sign>
      <Shuttle />
      <Sign position={[21, 5, 3]}>05 / PUSHABLE BOXES</Sign>
      {[0, 1, 2].map(i => <Block key={i} position={[17 + i * 3, 0.8, -3]} size={[1.5, 1.5, 1.5]} color="#a68ce0" dynamic />)}
      <Sign position={[-20, 5, -29]}>06 / CEILING + WALL SLIDE</Sign>
      <Block position={[-24, 2.5, -36]} size={[1, 5, 12]} />
      <Block position={[-16, 2.5, -36]} size={[1, 5, 12]} />
      <Block position={[-20, 4.5, -36]} size={[9, 0.5, 12]} color="#de8461" />
      <Sign position={[0, 6, -34]}>07 / JUMP GAPS · 2 units</Sign>
      {[0, 1, 2].map(i => <Block key={i} position={[-5 + i * 7, 1, -40]} size={[5, 2, 7]} color="#48a5b6" />)}
      <Sign position={[-12, 5, 12]}>CTRL / CROUCH TUNNEL</Sign>
      <Block position={[-14.5, 1.5, 7]} size={[0.5, 3, 8]} />
      <Block position={[-9.5, 1.5, 7]} size={[0.5, 3, 8]} />
      <Block position={[-12, 2.7, 7]} size={[5.5, 0.5, 8]} color="#70d6cc" />
      <ParkourTrack />
      <Targets />
      <Player debug />
  </>
})

function Targets() {
  const [generation, setGeneration] = useState(0)
  const reset = useCallback(() => setGeneration((value) => value + 1), [])
  return <>
    <Sign position={[0, 7, -1]}>08 / BOX TARGETS · Click to shoot · T rebuild</Sign>
    <Sign position={[-36, 8, -15]}>09 / TALL STACKS</Sign>
    <Sign position={[35, 7, -12]}>10 / BOX WALL</Sign>
    <Sign position={[0, 7, -58]}>11 / LONG RANGE</Sign>
    <group key={generation}>
      {[-1, 1].flatMap((side) => Array.from({ length: 3 }, (_, row) =>
        Array.from({ length: 3 - row }, (_, column) => <Block
          key={`${side}-${row}-${column}`}
          position={[side * 3.5 + (column - (2 - row) / 2) * 1.55, 0.75 + row * 1.51, -1]}
          size={[1.5, 1.5, 1.5]} color={row % 2 ? '#ffe29a' : '#e7784d'} dynamic />)))}
      {[-40, -34].flatMap((x) => Array.from({ length: 5 }, (_, row) => <Block
        key={`tower-${x}-${row}`} position={[x, 0.75 + row * 1.51, -15]}
        size={[1.5, 1.5, 1.5]} color={row % 2 ? '#70d6cc' : '#386e81'} dynamic />))}
      {Array.from({ length: 4 }, (_, row) => Array.from({ length: 5 }, (_, column) => <Block
        key={`wall-${row}-${column}`} position={[31 + column * 1.55 + (row % 2) * 0.3, 0.75 + row * 1.51, -14]}
        size={[1.5, 1.5, 1.5]} color={row % 2 ? '#bc99e4' : '#75569a'} dynamic />))}
      {[-12, 0, 12].flatMap((x) => Array.from({ length: 3 }, (_, row) =>
        Array.from({ length: 3 - row }, (_, column) => <Block
          key={`distant-${x}-${row}-${column}`}
          position={[x + (column - (2 - row) / 2) * 1.55, 0.75 + row * 1.51, -60]}
          size={[1.5, 1.5, 1.5]} color={row % 2 ? '#ffe29a' : '#d58742'} dynamic />)))}
    </group>
    <ProjectileLauncher onReset={reset} />
  </>
}
