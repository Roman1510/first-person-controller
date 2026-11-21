import { create } from 'zustand'
export const useMovementDebug = create(() => ({ grounded: false, crouched: false, speed: 0, height: 0, shotBlocked: false }))
