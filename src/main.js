import "./style.css"
import { LEVEL_MAP, MAP_WIDTH, MAP_HEIGHT, PLAYER_START, ENEMIES_SPAWN, isWall } from "./map.js"
import { assetManager } from "./assetManager.js"
import { Raycaster } from "./raycaster.js"
import { Enemy } from "./enemy.js"
import { PlasmaRevolver } from "./weapon.js"

// Inyección del DOM
document.querySelector("#app").innerHTML = `
  <div class="game-stage">
    <canvas id="gameCanvas"></canvas>

    <div class="hud">
      <div
        id="healthBar"
        class="hud__health"
        role="progressbar"
        aria-label="Salud del jugador"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow="100"
      >
        <span id="healthFill" class="hud__health-fill"></span>
      </div>

      <div class="hud__info">
        <span>HP: <b id="healthText">100</b></span>
        <span>ENEMIGOS: <b id="enemiesCount">3</b></span>
      </div>

      <button id="restartButton" class="hud__button" type="button">
        Reiniciar
      </button>
    </div>

    <div id="gameOverPanel" class="game-over" hidden>
      <div class="level-complete__content">
        <p class="game-over__title">HAS MUERTO</p>
        <p class="level-complete__subtitle">El Cyber-Cuatrero te ha neutralizado.</p>
        <button id="gameOverRestart" class="hud__button hud__button--big" type="button">
          Reintentar Partida
        </button>

    <!-- AYUDA / CONTROLES EN PANTALLA -->
    <div class="hud__controls-hint" aria-hidden="true">
      <span><b>W, A, S, D / Flechas:</b> Mover y Girar</span>
      <span><b>Espacio / F / Click:</b> Disparar Revólver de Plasma</span>
    </div>

      </div>
    </div>

    <div id="victoryPanel" class="level-complete" hidden>
      <div class="level-complete__content">
        <p class="level-complete__title">¡NIVEL COMPLETADO!</p>
        <p class="level-complete__subtitle">Has eliminado a todos los Cyber-Cuatreros.</p>
        <button id="victoryRestart" class="hud__button hud__button--big" type="button">
          Jugar de Nuevo
        </button>
      </div>
    </div>
  </div>
`

const VELOCITY = 3.2
const ROTATION_SPEED = 0.045
const FOV = Math.PI / 3
const RAYS = 180
const MAX_HEALTH = 100

const canvas = document.getElementById("gameCanvas")
const ctx = canvas.getContext("2d")
const healthBar = document.getElementById("healthBar")
const healthFill = document.getElementById("healthFill")
const healthText = document.getElementById("healthText")
const enemiesCountEl = document.getElementById("enemiesCount")
const restartButton = document.getElementById("restartButton")
const gameOverPanel = document.getElementById("gameOverPanel")
const gameOverRestart = document.getElementById("gameOverRestart")
const victoryPanel = document.getElementById("victoryPanel")
const victoryRestart = document.getElementById("victoryRestart")

const raycaster = new Raycaster({ fov: FOV, numRays: RAYS })
const weapon = new PlasmaRevolver()

let canvasWidth = window.innerWidth
let canvasHeight = window.innerHeight
let squareSize = 64
let playerRadius = 16

const player = {
  x: 0,
  y: 0,
  angle: 0,
  health: MAX_HEALTH,
}

let enemies = []
let isGameOver = false
let isLevelCompleted = false
let timeScale = 1
let lastTimestamp = 0
let hurtOverlayTimer = 0

const keysPressed = {
  ArrowRight: false,
  ArrowLeft: false,
  ArrowUp: false,
  ArrowDown: false,
  KeyW: false,
  KeyS: false,
  KeyA: false,
  KeyD: false,
}

function handleKeydown(e) {
  if (e.code in keysPressed) {
    e.preventDefault()
    keysPressed[e.code] = true
  }
  if (e.code === "ArrowRight" || e.code === "KeyD") keysPressed.ArrowRight = true
  if (e.code === "ArrowLeft" || e.code === "KeyA") keysPressed.ArrowLeft = true
  if (e.code === "ArrowUp" || e.code === "KeyW") keysPressed.ArrowUp = true
  if (e.code === "ArrowDown" || e.code === "KeyS") keysPressed.ArrowDown = true

  // Disparo con tecla F o Espacio
  if (e.code === "KeyF" || e.code === "Space") {
    e.preventDefault()
    fireWeapon()
  }
}

function handleKeyup(e) {
  if (e.code in keysPressed) {
    keysPressed[e.code] = false
  }
  if (e.code === "ArrowRight" || e.code === "KeyD") keysPressed.ArrowRight = false
  if (e.code === "ArrowLeft" || e.code === "KeyA") keysPressed.ArrowLeft = false
  if (e.code === "ArrowUp" || e.code === "KeyW") keysPressed.ArrowUp = false
  if (e.code === "ArrowDown" || e.code === "KeyS") keysPressed.ArrowDown = false
}

function handleMouseDown(e) {
  if (e.button === 0) {
    fireWeapon()
  }
}

function handleWindowBlur() {
  for (const k in keysPressed) {
    keysPressed[k] = false
  }
}

function fireWeapon() {
  if (isGameOver || isLevelCompleted) return
  weapon.shoot(player, enemies, (angle) =>
    raycaster.castRay(angle, player.x, player.y, squareSize)
  )
}


function damagePlayer(amount) {
  if (isGameOver || isLevelCompleted) return
  player.health = Math.max(0, player.health - amount)
  hurtOverlayTimer = 14

  renderHud()

  if (player.health <= 0) {
    isGameOver = true
    gameOverPanel.hidden = false
  }
}

function updateHudStats() {
  const aliveEnemies = enemies.filter((e) => !e.isDead).length
  enemiesCountEl.textContent = String(aliveEnemies)

  if (aliveEnemies === 0 && !isLevelCompleted && !isGameOver) {
    isLevelCompleted = true
    victoryPanel.hidden = false
  }
}

function renderHud() {
  const pct = (player.health / MAX_HEALTH) * 100
  healthFill.style.width = `${pct}%`
  healthFill.dataset.level = pct <= 30 ? "low" : "ok"
  healthBar.setAttribute("aria-valuenow", String(player.health))
  healthText.textContent = String(player.health)
}

function updatePlayerRotation() {
  if (keysPressed.ArrowRight) player.angle += ROTATION_SPEED * timeScale
  if (keysPressed.ArrowLeft) player.angle -= ROTATION_SPEED * timeScale
}

function updatePlayerMovement() {
  const dir = (keysPressed.ArrowUp ? 1 : 0) - (keysPressed.ArrowDown ? 1 : 0)
  if (dir === 0) return

  const step = VELOCITY * timeScale * dir
  const nextX = player.x + Math.cos(player.angle) * step
  const nextY = player.y + Math.sin(player.angle) * step

  const margin = playerRadius
  if (!isWall(nextX + (step > 0 ? margin : -margin) * Math.cos(player.angle), player.y, squareSize)) {
    player.x = nextX
  }
  if (!isWall(player.x, nextY + (step > 0 ? margin : -margin) * Math.sin(player.angle), squareSize)) {
    player.y = nextY
  }
}

function drawMiniMap() {
  const MINI_MAP_SIZE = Math.min(180, canvasWidth * 0.22)
  const miniMapScale = MINI_MAP_SIZE / (MAP_WIDTH * squareSize)

  ctx.save()
  ctx.fillStyle = "rgba(15, 23, 42, 0.75)"
  ctx.fillRect(16, 16, MINI_MAP_SIZE, MINI_MAP_SIZE)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"
  ctx.strokeRect(16, 16, MINI_MAP_SIZE, MINI_MAP_SIZE)

  // Celdas del mapa
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const type = LEVEL_MAP[y][x]
      if (type > 0) {
        ctx.fillStyle = type === 1 ? "#64748b" : type === 2 ? "#0284c7" : "#7c3aed"
        ctx.fillRect(
          16 + x * squareSize * miniMapScale,
          16 + y * squareSize * miniMapScale,
          squareSize * miniMapScale,
          squareSize * miniMapScale
        )
      }
    }
  }

  // Enemigos en minimapa
  for (const enemy of enemies) {
    ctx.fillStyle = enemy.isDead ? "#6b7280" : "#ef4444"
    ctx.beginPath()
    ctx.arc(
      16 + enemy.x * miniMapScale,
      16 + enemy.y * miniMapScale,
      3,
      0,
      Math.PI * 2
    )
    ctx.fill()
  }

  // Jugador en minimapa
  const px = 16 + player.x * miniMapScale
  const py = 16 + player.y * miniMapScale
  ctx.fillStyle = "#22c55e"
  ctx.beginPath()
  ctx.arc(px, py, 4, 0, Math.PI * 2)
  ctx.fill()

  // Cono / línea de visión
  ctx.strokeStyle = "#4ade80"
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(px, py)
  ctx.lineTo(
    px + Math.cos(player.angle) * 14,
    py + Math.sin(player.angle) * 14
  )
  ctx.stroke()
  ctx.restore()
}

function restartGame() {
  player.x = PLAYER_START.gridX * squareSize
  player.y = PLAYER_START.gridY * squareSize
  player.angle = PLAYER_START.angle
  player.health = MAX_HEALTH

  enemies = ENEMIES_SPAWN.map(
    (cfg) =>
      new Enemy({
        id: cfg.id,
        x: cfg.gridX * squareSize,
        y: cfg.gridY * squareSize,
        patrolPoints: cfg.patrolPoints,
      })
  )

  isGameOver = false
  isLevelCompleted = false
  hurtOverlayTimer = 0
  gameOverPanel.hidden = true
  victoryPanel.hidden = true

  renderHud()
  updateHudStats()
}

function updateCanvasSize() {
  canvasWidth = window.innerWidth
  canvasHeight = window.innerHeight
  canvas.width = canvasWidth
  canvas.height = canvasHeight

  squareSize = 64
  playerRadius = squareSize * 0.22

  if (player.x === 0 && player.y === 0) {
    player.x = PLAYER_START.gridX * squareSize
    player.y = PLAYER_START.gridY * squareSize
  }
}

function gameLoop(timestamp = 0) {
  requestAnimationFrame(gameLoop)

  timeScale =
    lastTimestamp === 0 ? 1 : Math.min((timestamp - lastTimestamp) / (1000 / 60), 3)
  lastTimestamp = timestamp

  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  if (!isGameOver && !isLevelCompleted) {
    updatePlayerRotation()
    updatePlayerMovement()

    // Actualizar IA de cada enemigo
    for (const enemy of enemies) {
      enemy.update({
        playerX: player.x,
        playerY: player.y,
        squareSize,
        timeScale,
        onDamagePlayer: damagePlayer,
        hasLineOfSight: (x1, y1, x2, y2) =>
          raycaster.hasLineOfSight(x1, y1, x2, y2, squareSize),
      })
    }

    weapon.update(timeScale)
    updateHudStats()
  }

  // Render 3D del Raycaster: Mundo (Muros) + Sprites ordenados por Z-Buffer
  raycaster.renderWorld(ctx, canvasWidth, canvasHeight, player, squareSize, assetManager)
  raycaster.renderSprites(ctx, canvasWidth, canvasHeight, player, squareSize, enemies, assetManager)

  // Render del Arma (Hitscan plasma revolver en primera persona)
  weapon.render(ctx, canvasWidth, canvasHeight, assetManager)

  // Minimapa 2D
  drawMiniMap()

  // Overlay de daño recibido
  if (hurtOverlayTimer > 0) {
    hurtOverlayTimer -= timeScale
    ctx.save()
    ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.4, hurtOverlayTimer / 20)})`
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    ctx.restore()
  }
}

function init() {
  updateCanvasSize()
  restartGame()

  // Pre-carga asíncrona segura con fallback garantizado
  assetManager.loadManifest({
    wall_tech: "/assets/wall.png",
    enemy_sheet: "/assets/enemy-sheet.png",
    enemy_cyber_cuatrero: "/assets/enemy.png",
    enemy_dead: "/assets/enemy_dead.png",
    weapon_plasma_revolver: "/assets/weapon.png",
  })

  restartButton.addEventListener("click", (e) => {
    restartGame()
    e.currentTarget.blur()
  })

  gameOverRestart.addEventListener("click", (e) => {
    restartGame()
    e.currentTarget.blur()
  })

  victoryRestart.addEventListener("click", (e) => {
    restartGame()
    e.currentTarget.blur()
  })

  window.addEventListener("resize", updateCanvasSize)
  window.addEventListener("keydown", handleKeydown)
  window.addEventListener("keyup", handleKeyup)
  window.addEventListener("mousedown", handleMouseDown)
  window.addEventListener("blur", handleWindowBlur)

  requestAnimationFrame(gameLoop)
}

init()


