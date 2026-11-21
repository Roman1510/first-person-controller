import { create } from 'zustand'

interface ParkourState {
  active: boolean
  checkpoint: number
  progress: number
  falls: number
  finished: boolean
  request: 'start' | 'lab' | null
  start: () => void
  leave: () => void
}
export const useParkourStore = create<ParkourState>((set) => ({
  active: false, checkpoint: 0, progress: 0, falls: 0, finished: false, request: null,
  start: () => set({ request: 'start' }),
  leave: () => set({ request: 'lab' }),
}))
