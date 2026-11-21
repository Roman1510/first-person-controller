import { useEffect, useRef } from 'react'

export interface PlayerInput {
  keys: Set<string>
  jumpPressed: boolean
  resetPressed: boolean
}

export function usePhysicalKeyboard() {
  const input = useRef<PlayerInput>({ keys: new Set(), jumpPressed: false, resetPressed: false })
  useEffect(() => {
    const clear = () => {
      input.current.keys.clear()
      input.current.jumpPressed = false
      input.current.resetPressed = false
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (!document.pointerLockElement || (target instanceof HTMLElement &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))) return
      if (event.ctrlKey || ['ControlLeft', 'ControlRight', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault()
      input.current.keys.add(event.code)
      if (!event.repeat && event.code === 'Space') input.current.jumpPressed = true
      if (!event.repeat && event.code === 'KeyR') input.current.resetPressed = true
    }
    const handleKeyUp = (event: KeyboardEvent) => { input.current.keys.delete(event.code) }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', clear)
    document.addEventListener('visibilitychange', clear)
    document.addEventListener('pointerlockchange', clear)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', clear)
      document.removeEventListener('visibilitychange', clear)
      document.removeEventListener('pointerlockchange', clear)
    }
  }, [])
  return input
}
