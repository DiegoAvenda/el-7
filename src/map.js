/**
 * Matriz del nivel (16 x 16).
 * 0: Espacio libre
 * 1: Muro perimetral o muro de piedra
 * 2: Muro de ladrillo / tecnológico
 * 3: Muro reforzado / puertas de seguridad
 */
export const MAP_WIDTH = 16
export const MAP_HEIGHT = 16

export const LEVEL_MAP = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 2, 2, 0, 0, 1, 0, 3, 3, 3, 0, 0, 0, 0, 1],
  [1, 0, 2, 0, 0, 0, 0, 0, 3, 0, 3, 0, 2, 2, 0, 1],
  [1, 0, 2, 0, 1, 1, 1, 0, 3, 0, 3, 0, 0, 2, 0, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 1],
  [1, 0, 0, 0, 1, 0, 2, 2, 2, 0, 0, 1, 0, 0, 0, 1],
  [1, 1, 0, 1, 1, 0, 2, 0, 2, 0, 0, 1, 1, 0, 1, 1],
  [1, 0, 0, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 3, 3, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1],
  [1, 0, 3, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 0, 1],
  [1, 0, 3, 0, 0, 1, 0, 0, 1, 0, 0, 0, 2, 2, 0, 1],
  [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 2, 2, 0, 1],
  [1, 0, 2, 2, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
]

/**
 * Puntos iniciales del nivel
 */
export const PLAYER_START = {
  gridX: 1.5,
  gridY: 1.5,
  angle: 0, // Mirando hacia el este en pasillo despejado
}

export const ENEMIES_SPAWN = [
  { id: "cyber_cuatrero_1", gridX: 7.5, gridY: 4.5, patrolPoints: [{ x: 7.5, y: 4.5 }, { x: 7.5, y: 2.5 }] },
  { id: "cyber_cuatrero_2", gridX: 13.5, gridY: 8.5, patrolPoints: [{ x: 13.5, y: 8.5 }, { x: 13.5, y: 13.5 }] },
  { id: "cyber_cuatrero_3", gridX: 3.5, gridY: 12.5, patrolPoints: [{ x: 3.5, y: 12.5 }, { x: 1.5, y: 12.5 }] },
]

/**
 * Verifica si una coordenada del mundo colisiona con un muro.
 * @param {number} x - Coordenada X en píxeles del mundo
 * @param {number} y - Coordenada Y en píxeles del mundo
 * @param {number} squareSize - Tamaño en píxeles de una celda
 * @returns {boolean}
 */
export function isWall(x, y, squareSize) {
  const cellX = Math.floor(x / squareSize)
  const cellY = Math.floor(y / squareSize)
  if (cellY < 0 || cellY >= MAP_HEIGHT || cellX < 0 || cellX >= MAP_WIDTH) {
    return true
  }
  return LEVEL_MAP[cellY][cellX] > 0
}

/**
 * Retorna el tipo de bloque en una celda de la grilla (0 = vacío, >0 = muro).
 */
export function getWallType(gridX, gridY) {
  const gx = Math.floor(gridX)
  const gy = Math.floor(gridY)
  if (gy < 0 || gy >= MAP_HEIGHT || gx < 0 || gx >= MAP_WIDTH) {
    return 1
  }
  return LEVEL_MAP[gy][gx]
}
