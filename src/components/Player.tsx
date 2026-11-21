import { useRef } from 'react'
import { CapsuleCollider, RapierRigidBody, RigidBody } from '@react-three/rapier'
import { Group } from 'three'
import { playerGroups } from '../physics/ProjectilePool'
import { playerShape } from '../physics/FirstPersonMotor'
import { usePhysicalKeyboard } from '../hooks/usePhysicalKeyboard'
import { usePlayerControl } from '../hooks/usePlayerControl'

interface PlayerProps {
  spawn?: [number, number, number]
  initialYaw?: number
  debug?: boolean
}

export function Player({ spawn = [0, 2, 15], initialYaw = 0, debug = false }: PlayerProps) {
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const input = usePhysicalKeyboard()
  usePlayerControl(body, visual, input, spawn, initialYaw, debug)

  return (
    <RigidBody ref={body} type="kinematicPosition" position={spawn} colliders={false} lockRotations>
      <CapsuleCollider
        args={[playerShape.halfHeight, playerShape.radius]}
        collisionGroups={playerGroups}
        friction={0}
        restitution={0}
      />
      <group ref={visual} />
    </RigidBody>
  )
}
