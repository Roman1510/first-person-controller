import { boxGeometry, blockMaterial } from './playgroundResources'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Html } from '@react-three/drei'

type Triple = [number, number, number]
export function Block({ position, size, color = '#334b63', rotation = [0, 0, 0], dynamic = false }: {
  position: Triple; size: Triple; color?: string; rotation?: Triple; dynamic?: boolean
}) {
  return <RigidBody type={dynamic ? 'dynamic' : 'fixed'} position={position} rotation={rotation} colliders={false} restitution={0} friction={0.7}>
    <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
    <mesh geometry={boxGeometry} material={blockMaterial(color)} scale={size} dispose={null} />
  </RigidBody>
}
export function Sign({ position, children }: { position: Triple; children: string }) {
  return <Html position={position} center distanceFactor={35} style={{ pointerEvents: 'none', whiteSpace: 'nowrap', color: '#e2f4ff', background: '#101b2de6', border: '1px solid #57748d', borderRadius: 6, padding: '8px 12px', font: '600 13px monospace' }}>{children}</Html>
}
