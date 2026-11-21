import { playerShape } from './FirstPersonMotor.ts'

export type ParkourPad = { x: number; z: number; top: number; width: number; depth: number; checkpoint?: boolean }
// Isolated from the lab floor so missed jumps have a real consequence.
export const parkourPads: ParkourPad[] = [
  { x: 80, z: 18, top: 2, width: 10, depth: 10, checkpoint: true },
  { x: 80, z: 6, top: 2.5, width: 8, depth: 8 },
  { x: 80, z: -6, top: 3, width: 8, depth: 8 },
  { x: 84, z: -18, top: 3.5, width: 8, depth: 8 },
  { x: 80, z: -30, top: 4, width: 10, depth: 10, checkpoint: true },
  { x: 75, z: -43, top: 4.5, width: 7, depth: 8 },
  { x: 82, z: -55, top: 5, width: 7, depth: 8 },
  { x: 87, z: -67, top: 5.5, width: 7, depth: 8 },
  { x: 80, z: -80, top: 6, width: 10, depth: 10, checkpoint: true },
  { x: 80, z: -94, top: 6.5, width: 5, depth: 10 },
  { x: 86, z: -108, top: 7, width: 6, depth: 8 },
  { x: 78, z: -121, top: 7.5, width: 6, depth: 8 },
  { x: 80, z: -135, top: 8, width: 12, depth: 12, checkpoint: true },
]

export function standingOnPad(position: { x: number; y: number; z: number }, index: number) {
  const pad = parkourPads[index]
  const feet = position.y - playerShape.halfHeight - playerShape.radius
  return Math.abs(position.x - pad.x) < pad.width / 2 && Math.abs(position.z - pad.z) < pad.depth / 2 &&
    feet >= pad.top - 0.1 && feet < pad.top + 0.2
}

export function parkourSpawn(index: number) {
  const pad = parkourPads[index]
  return { x: pad.x, y: pad.top + playerShape.halfHeight + playerShape.radius + 0.1, z: pad.z + pad.depth / 4 }
}
