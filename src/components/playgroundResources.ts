import { BoxGeometry, MeshStandardMaterial } from 'three'

// Shared for the lifetime of the scene module; meshes must not dispose them.
export const boxGeometry = new BoxGeometry(1, 1, 1)
const materials = new Map<string, MeshStandardMaterial>()
export function blockMaterial(color: string) {
  let material = materials.get(color)
  if (!material) {
    material = new MeshStandardMaterial({ color, roughness: 0.8 })
    materials.set(color, material)
  }
  return material
}

