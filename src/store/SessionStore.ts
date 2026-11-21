import { create } from 'zustand'

interface SessionState {
  paused: boolean
  setPaused: (paused: boolean) => void
}

export const useSessionStore = create<SessionState>((set) => ({
  paused: true,
  setPaused: (paused) => set({ paused }),
}))

export const usePause = () => useSessionStore((state) => state.paused)
