/**
 * enemySprites.js - Animación del Cyber-Cuatrero desde la sprite sheet.
 *
 * La hoja que pasaste contiene (de arriba a abajo):
 *  1. IDLE 8 direcciones (8 columnas)
 *  2. MENACING POSE frontal (1 sprite centrado)
 *  3. WALK CYCLE frontal 6 frames (6 columnas)
 *  4. QUICK DRAW + FIRE frontal 4 frames (4 columnas)
 *  5. TAKING DAMAGE frontal 2 frames (2 columnas, mitad izq. abajo)
 *  6. DEATH frontal 5 frames (5 columnas, mitad der. abajo)
 *
 * Guarda la imagen como: public/assets/enemy-sheet.png
 * (Vite la sirve en /assets/enemy-sheet.png)
 *
 * Como la hoja viene con fondo oscuro sólido, se aplica chroma-key
 * muestreando la esquina (0,0) para volver ese color transparente.
 * Si recortas los sprites con fondo transparente, el chroma no hace nada.
 */

// Bandas relativas (0-1) calibradas sobre tu imagen. Si cambias la hoja,
// ajusta solo estos números.
export const SHEET_LAYOUT = {
  idle: { x0: 0.0, y0: 0.015, x1: 1.0, y1: 0.185, cols: 8 },
  menace: { x0: 0.375, y0: 0.195, x1: 0.625, y1: 0.365 },
  walk: { x0: 0.0, y0: 0.385, x1: 1.0, y1: 0.55, cols: 6 },
  fire: { x0: 0.0, y0: 0.565, x1: 1.0, y1: 0.74, cols: 4 },
  hit: { x0: 0.0, y0: 0.775, x1: 0.29, y1: 0.95, cols: 2 },
  death: { x0: 0.31, y0: 0.775, x1: 1.0, y1: 0.95, cols: 5 },
}

// Orden de la fila 1 en tu hoja:
// FRONT, FRONT45, RIGHT, RIGHT45, BACK, LEFT45, LEFT, FRONT135(back-left)
const IDLE_ORDER = [0, 1, 2, 3, 4, 5, 6, 7]

const processedCache = new WeakMap()

function sampleBgColor(img) {
  try {
    const c = document.createElement("canvas")
    c.width = 1
    c.height = 1
    const g = c.getContext("2d", { willReadFrequently: true })
    g.drawImage(img, 0, 0, 1, 1)
    const d = g.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2]]
  } catch {
    return null
  }
}

/** Devuelve un canvas con el fondo sólido vuelto transparente (cacheado). */
export function getKeyedSprite(image) {
  if (!image || !image.naturalWidth) return image
  const cached = processedCache.get(image)
  if (cached) return cached

  const bg = sampleBgColor(image)
  const c = document.createElement("canvas")
  c.width = image.naturalWidth
  c.height = image.naturalHeight
  const g = c.getContext("2d", { willReadFrequently: true })
  g.drawImage(image, 0, 0)

  // Si la esquina es casi transparente ya (PNG recortado), no tocar nada.
  try {
    const data = g.getImageData(0, 0, c.width, c.height)
    const px = data.data
    if (bg) {
      const [br, bgg, bb] = bg
      // Solo aplica key si el fondo es oscuro opaco (la hoja original)
      const isDarkSolidBg = br < 60 && bgg < 60 && bb < 70
      if (isDarkSolidBg) {
        const TOL = 22
        for (let i = 0; i < px.length; i += 4) {
          const dr = px[i] - br
          const dg = px[i + 1] - bgg
          const db = px[i + 2] - bb
          if (dr * dr + dg * dg + db * db < TOL * TOL * 3) {
            px[i + 3] = 0
          }
        }
        g.putImageData(data, 0, 0)
      }
    }
  } catch {
    // Canvas tainted (CORS) -> devolver original
    return image
  }

  processedCache.set(image, c)
  return c
}

function colRect(band, index, pad = 0.012) {
  const w = (band.x1 - band.x0) / band.cols
  return {
    x0: band.x0 + w * index + pad * 0.4,
    x1: band.x0 + w * (index + 1) - pad * 0.4,
    y0: band.y0 + pad,
    y1: band.y1 - pad,
  }
}

/**
 * Elige el frame (rectángulo relativo) según estado del enemigo.
 * @param {object} enemy - instancia de Enemy (lee state, animTime, etc.)
 * @param {number} angleToPlayer - ángulo mundo enemigo->jugador (para idle direccional)
 * @param {number} enemyFacing - hacia dónde mira el enemigo (enemy.angle)
 */
export function getEnemyFrame(enemy, angleToPlayer, enemyFacing) {
  const L = SHEET_LAYOUT
  const t = enemy.animTime || 0

  // Muerte: 5 frames, se queda en el último (tumbado)
  if (enemy.state === "DEAD" || enemy.isDead) {
    const dt = enemy.deathTime || 0
    const idx = Math.min(4, Math.floor(dt / 9))
    return { ...colRect(L.death, idx), kind: "death", idx }
  }

  // Daño: 2 frames alternados mientras hitTimer activo
  if (enemy.hitTimer > 0) {
    const idx = Math.floor(t / 5) % 2
    return { ...colRect(L.hit, idx), kind: "hit", idx }
  }

  // Ataque: secuencia REACH(0) -> DRAW(1) -> AIM(2) -> FIRE(3, sostenido)
  if (enemy.state === "ATTACK") {
    const at = enemy.attackAnim || 0
    let idx
    if (at < 8) idx = 0
    else if (at < 14) idx = 1
    else if (at < 20) idx = 2
    else idx = 3
    return { ...colRect(L.fire, idx), kind: "fire", idx }
  }

  // Caminando (patrulla / persecución): ciclo de 6 a ~9fps
  if (enemy.state === "CHASE" || enemy.state === "PATROL") {
    const idx = Math.floor(t / 7) % 6
    return { ...colRect(L.walk, idx), kind: "walk", idx }
  }

  // Idle / resto: sprite direccional de 8. Se elige según de dónde
  // se ve al jugador respecto al facing del enemigo.
  let rel = angleToPlayer - enemyFacing
  while (rel > Math.PI) rel -= Math.PI * 2
  while (rel < -Math.PI) rel += Math.PI * 2
  // 0 = frente, + = derecha... mapeo a 8 sectores.
  // Orden hoja: [FRONT, FRONT45, RIGHT, RIGHT45, BACK, LEFT45, LEFT, FRONT135]
  // Lo convertimos a índice: sector 0=front, 1=front-right, 2=right...
  const sector = Math.round(rel / (Math.PI / 4))
  // sector: 0 front, 1 right45? Ajuste de signo: en pantalla y+ es abajo,
  // atan2 crece en sentido horario visto desde arriba del mapa 2D.
  const map = [0, 1, 2, 3, 4, 7, 6, 5]
  const normalized = ((sector % 8) + 8) % 8
  const idx = IDLE_ORDER[map[normalized]]
  return { ...colRect(L.idle, idx), kind: "idle", idx }
}

/** Dibuja el frame recortado de la hoja sobre el billboard. */
export function drawEnemyFrame(ctx, sheet, frame, dx, dy, dw, dh) {
  const W = sheet.naturalWidth || sheet.width
  const H = sheet.naturalHeight || sheet.height
  const sx = Math.floor(frame.x0 * W)
  const sy = Math.floor(frame.y0 * H)
  const sw = Math.ceil((frame.x1 - frame.x0) * W)
  const sh = Math.ceil((frame.y1 - frame.y0) * H)
  if (sw <= 0 || sh <= 0) return
  ctx.drawImage(sheet, sx, sy, sw, sh, dx, dy, dw, dh)
}
