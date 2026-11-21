import { create } from 'zustand'
import { csMovementPreset, easyParkourPreset } from '../physics/FirstPersonMotor.ts'

interface MovementSettings {
  jumpForce: number
  setJumpForce: (value: number) => void
  toonzForce: number
  setToonzForce: (value: number) => void
  parkourPreset: () => void
  speed: number
  shiftMultiplier: number
  crouchMultiplier: number
  gravity: number
  jumpSpeed: number
  classicAirControl: boolean
  setSpeed: (speed: number) => void
  setShiftMultiplier: (value: number) => void
  reset: () => void
}

export const useMovementSettings = create<MovementSettings>((set) => ({
  ...csMovementPreset,
  setJumpForce: (value) => {
    if (Number.isFinite(value)) set({ jumpForce: Math.min(3, Math.max(0.25, value)) })
  },
  setToonzForce: (value) => {
    if (Number.isFinite(value)) set({ toonzForce: Math.min(1, Math.max(0, value)) })
  },
  parkourPreset: () => set(easyParkourPreset),
  setSpeed: (value) => {
    if (Number.isFinite(value)) set({ speed: Math.min(80, Math.max(1, value)) })
  },
  setShiftMultiplier: (value) => {
    if (Number.isFinite(value)) set({ shiftMultiplier: Math.min(3, Math.max(0.1, value)) })
  },
  reset: () => set(csMovementPreset),
}))
