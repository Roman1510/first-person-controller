export const weapons = [
  { name: 'Blaster', speed: 65, mass: 1.5, cooldown: 0.15 },
  { name: 'Rapid fire', speed: 85, mass: 0.6, cooldown: 0.07 },
  { name: 'Heavy cannon', speed: 45, mass: 6, cooldown: 0.6 },
] as const

export type Weapon = typeof weapons[number]
