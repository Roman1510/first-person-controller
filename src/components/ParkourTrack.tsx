import { parkourPads } from '../physics/ParkourCourse'
import { Block, Sign } from './PlaygroundPrimitives'

export function ParkourTrack() {
  return <>
    <Sign position={[48, 6, 18]}>PARKOUR → Esc · Start parkour</Sign>
    {parkourPads.map((pad, index) => {
      const next = parkourPads[index + 1]
      const color = index === parkourPads.length - 1 ? '#f7cb62' : pad.checkpoint ? '#47d9b2' : '#448cbd'
      return <group key={index}>
        <Block position={[pad.x, pad.top - 0.6, pad.z]} size={[pad.width, 1.2, pad.depth]} color={color} />
        <Sign position={[pad.x, pad.top + 2.5, pad.z - pad.depth / 2]}>
          {`${String(index + 1).padStart(2, '0')} / ${index === 0 ? 'START' : !next ? 'FINISH' : pad.checkpoint ? 'CHECKPOINT' : index < 4 ? 'WARM UP' : index < 8 ? 'STRAFE HOPS' : 'PRECISION'}`}
        </Sign>
        {next && <group position={[pad.x, pad.top + 0.025, pad.z]} rotation={[0, Math.atan2(next.x - pad.x, next.z - pad.z), 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.3, 2]} />
            <meshBasicMaterial color="#eafff5" />
          </mesh>
          <mesh position={[0, 0.01, 1]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.65, 0.9, 3]} />
            <meshBasicMaterial color="#eafff5" />
          </mesh>
        </group>}
        {pad.checkpoint && <>
          <Block position={[pad.x - pad.width / 2 + 0.2, pad.top + 2, pad.z]} size={[0.15, 4, 0.15]} color="#c6fff0" />
          <Block position={[pad.x + pad.width / 2 - 0.2, pad.top + 2, pad.z]} size={[0.15, 4, 0.15]} color="#c6fff0" />
        </>}
      </group>
    })}
  </>
}
