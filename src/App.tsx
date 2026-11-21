import { Suspense, useEffect, useRef, useState } from 'react'
import { Leva } from 'leva'
import { Canvas } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import { PhysicsPlayground } from './components/PhysicsPlayground'
import { PlaygroundHUD } from './components/PlaygroundHUD'
import { useSessionStore } from './store/SessionStore'

export default function App() {
  const paused = useSessionStore((state) => state.paused)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState('')
  const setPaused = useSessionStore((state) => state.setPaused)

  useEffect(() => {
    const failed = () => {
      setPaused(true)
      setError('Mouse capture failed. Click Enter to retry, or use a desktop browser.')
    }
    const suspend = () => {
      setPaused(true)
      if (document.pointerLockElement === canvas.current) document.exitPointerLock()
    }
    const visibilityChanged = () => { if (document.hidden) suspend() }
    document.addEventListener('pointerlockerror', failed)
    document.addEventListener('visibilitychange', visibilityChanged)
    window.addEventListener('blur', suspend)
    return () => {
      document.removeEventListener('pointerlockerror', failed)
      document.removeEventListener('visibilitychange', visibilityChanged)
      window.removeEventListener('blur', suspend)
    }
  }, [setPaused])

  const enter = async () => {
    setError('')
    try {
      await canvas.current?.requestPointerLock()
    } catch {
      setPaused(true)
      setError('Mouse capture failed. Click Enter to retry, or use a desktop browser.')
    }
  }

  return (
    <main className="app">
      <Canvas style={{ isolation: 'isolate' }} frameloop={paused ? 'demand' : 'always'} ref={canvas} dpr={[1, 1.5]} camera={{ fov: 75, near: 0.05 }}>
        <Suspense fallback={null}>
          <PhysicsPlayground />
        </Suspense>
        <PointerLockControls
          // Only the explicit Enter button requests capture.
          selector="[data-pointer-lock-auto]"
          onLock={() => { setError(''); setPaused(false) }}
          onUnlock={() => setPaused(true)}
        />
      </Canvas>
      <PlaygroundHUD onPlay={enter} />
      <Leva hidden={!paused} theme={{ sizes: { rootWidth: '340px' } }} titleBar={{ title: 'Projectile tuning · Esc to edit' }} />
      {error && <p role="alert" className="capture-error">{error}</p>}
    </main>
  )
}
