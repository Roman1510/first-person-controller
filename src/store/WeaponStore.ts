import { create } from 'zustand'
import { weapons } from '../physics/Weapons.ts'

interface WeaponState {
  selected: number
  cycle: (direction: number) => void
}

export const useWeaponStore = create<WeaponState>((set) => ({
  selected: 0,
  cycle: (direction) => {
    if (!Number.isFinite(direction) || direction === 0) return
    set(({ selected }) => ({ selected: (selected + Math.sign(direction) + weapons.length) % weapons.length }))
  },
}))
