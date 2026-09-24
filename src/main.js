import "./style.css"

// 1. Inyectar la estructura en el contenedor de Vite
document.querySelector("#app").innerHTML = `
  <div class="game-stage">
    <canvas id="gameCanvas"></canvas>

    <!-- Enemigo: figura hecha con CSS (sustituye a /boss.png) -->
    <div
      id="enemyFigure"
      class="figure figure--enemy"
      data-state="walking"
      aria-hidden="true"
    >
      <span class="enemy__horn enemy__horn--left"></span>
      <span class="enemy__horn enemy__horn--right"></span>
      <span class="enemy__body">
        <span class="enemy__eye enemy__eye--left"></span>
        <span class="enemy__eye enemy__eye--right"></span>
      </span>
    </div>

    <!-- Arma: figura hecha con CSS (sustituye a /weapon.png) -->
    <div id="weaponFigure" class="figure figure--weapon" aria-hidden="true">
      <span class="weapon__recoil">
        <span class="weapon__flash"></span>
        <span class="weapon__barrel"></span>
        <span class="weapon__body"></span>
        <span class="weapon__grip"></span>
      </span>
    </div>

    <!-- HUD: barra de vida + botón de reinicio -->
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
      <button id="restartButton" class="hud__button" type="button">
        Reiniciar
      </button>
    </div>

    <!-- Fin de partida -->
    <div id="gameOverPanel" class="game-over" hidden>
      <p class="game-over__title">Has muerto</p>
      <button
        id="gameOverRestart"
        class="hud__button hud__button--big"
        type="button"
      >
        Reiniciar partida
      </button>
    </div>
  </div>
`

// ========================================
// CONSTANTES Y CONFIGURACIÓN
// ========================================
const VELOCITY = 3
const FOV = Math.PI / 3 // 60° campo de visión
const RAYS = 100
const STAGGER_FRAME = 6

// Configuración de figuras y animaciones (todo con CSS, sin imágenes)
const ROTATION_SPEED = 0.05 // radianes por fotograma a 60 Hz
const FIRE_DURATION = STAGGER_FRAME * 3 // fotogramas que dura el disparo
const ENEMY_DAMAGE_DURATION = STAGGER_FRAME * 4 // daño recibido por el enemigo
const MAX_HEALTH = 100 // salud máxima del jugador
const ENEMY_DAMAGE = 10 // daño que hace cada golpe del enemigo
const ENEMY_HIT_INTERVAL = 60 // fotogramas entre golpes (1 s a 60 Hz)

// ========================================
// REFERENCIAS DOM (canvas + figuras CSS)
// ========================================
const canvas = document.getElementById("gameCanvas")
const ctx = canvas.getContext("2d")

// Figuras hechas con CSS: reemplazan por completo a weapon.png y boss.png
const enemyFigure = document.getElementById("enemyFigure")
const weaponFigure = document.getElementById("weaponFigure")

// HUD: barra de vida y botones de reinicio
const healthBar = document.getElementById("healthBar")
const healthFill = document.getElementById("healthFill")
const restartButton = document.getElementById("restartButton")
const gameOverPanel = document.getElementById("gameOverPanel")
const gameOverRestart = document.getElementById("gameOverRestart")

// ========================================
// ESTADOS DEL JUEGO
// ========================================
let canvasWidth = 0
let canvasHeight = 0
let squareSize = 0
let playerRadius = 0
let middleY = 0
let angle = 0
let enemyX = 0
let enemyY = 0
let gameFrame = 0
let playerX = 0
let playerY = 0
let isPlayerFiring = false
let fireStartFrame = 0
let currentEnemyState = "walking"
let enemyStateStartFrame = 0
let lastRenderedEnemyState = ""
let playerHealth = MAX_HEALTH
let lastEnemyHitFrame = 0
let isGameOver = false
let lastRenderedHealth = -1 // fuerza el primer pintado de la barra
let timeScale = 1 // factor para que el movimiento no dependa del refresco
let lastTimestamp = 0

const keysPressed = {
  ArrowRight: false,
  ArrowLeft: false,
  ArrowUp: false,
  ArrowDown: false,
}

// ========================================
// MAPA
// ========================================
const map = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
]

// ========================================
// FUNCIONES AUXILIARES
// ========================================
const cos = (a) => Math.cos(a)
const sin = (a) => Math.sin(a)

function calculateDistance(x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.sqrt(dx * dx + dy * dy)
}

function getEnemyDistanceAndDirection() {
  const dx = playerX - enemyX
  const dy = playerY - enemyY
  const distance = calculateDistance(enemyX, enemyY, playerX, playerY)
  return { dx, dy, distance }
}

function detectCollision(x, y) {
  const cellX = Math.floor(x / squareSize)
  const cellY = Math.floor(y / squareSize)
  return map[cellY]?.[cellX] === 1
}

function checkCircleCollision(newX, newY) {
  const numPoints = 8
  for (let i = 0; i < numPoints; i++) {
    const checkAngle = (i / numPoints) * 2 * Math.PI
    const checkX = newX + cos(checkAngle) * playerRadius
    const checkY = newY + sin(checkAngle) * playerRadius

    if (detectCollision(checkX, checkY)) {
      return true
    }
  }
  return false
}

// ========================================
// CONTROLES Y REAJUSTE DE TAMAÑO
// ========================================
function handleKeydown(event) {
  if (event.key in keysPressed) {
    // Sin preventDefault la página puede desplazarse con las flechas
    event.preventDefault()
    keysPressed[event.key] = true
  }
  if (event.key === "f" || event.key === "F") {
    startFiring()
  }
}

function handleKeyup(event) {
  if (event.key in keysPressed) {
    keysPressed[event.key] = false
  }
}

function handleWindowBlur() {
  // Si la pestaña pierde el foco se sueltan todas las teclas
  // para que ninguna quedé "pegada" y el jugador se quede moviéndose
  for (const key of Object.keys(keysPressed)) {
    keysPressed[key] = false
  }
}

// ========================================
// HUD: SALUD DEL JUGADOR Y REINICIO
// ========================================
function renderHud() {
  if (playerHealth === lastRenderedHealth) return
  lastRenderedHealth = playerHealth

  const percent = (playerHealth / MAX_HEALTH) * 100
  healthFill.style.width = `${percent}%`
  healthFill.dataset.level = percent <= 30 ? "low" : "ok"
  healthBar.setAttribute("aria-valuenow", String(playerHealth))
}

function damagePlayer(amount) {
  if (isGameOver) return

  playerHealth = Math.max(0, playerHealth - amount)

  if (playerHealth === 0) {
    isGameOver = true
    isPlayerFiring = false
    weaponFigure.classList.remove("is-firing")
    gameOverPanel.hidden = false
  }

  renderHud()
}

function restartGame() {
  // Jugador
  playerX = squareSize * 1.5
  playerY = squareSize * 1.5
  angle = 0
  playerHealth = MAX_HEALTH
  lastRenderedHealth = -1 // fuerza el redibujado de la barra
  isPlayerFiring = false
  fireStartFrame = 0
  weaponFigure.classList.remove("is-firing")

  // Enemigo
  enemyX = squareSize * 8.5
  enemyY = squareSize * 7.5
  setEnemyState("walking")
  lastEnemyHitFrame = gameFrame

  // Interfaz
  isGameOver = false
  gameOverPanel.hidden = true
  enemyFigure.dataset.state = "walking"
  lastRenderedEnemyState = "walking"
  enemyFigure.classList.remove("is-visible")

  renderHud()
}

function handleRestartClick(event) {
  restartGame()
  // Se suelta el foco para que Espacio/Intro no activen el botón otra vez
  event.currentTarget.blur()
}

function updateCanvasSize() {
  canvasWidth = window.innerWidth
  canvasHeight = window.innerHeight

  canvas.width = canvasWidth
  canvas.height = canvasHeight

  const minDimension = Math.min(canvasWidth, canvasHeight)
  squareSize = minDimension / map.length
  playerRadius = squareSize / 4
  middleY = canvasHeight / 2

  if (playerX === 0 && playerY === 0) {
    playerX = squareSize * 1.5
    playerY = squareSize * 1.5
  }

  if (enemyX === 0 && enemyY === 0) {
    // Celda libre (8,7): antes el enemigo aparecía dentro de un muro
    enemyX = squareSize * 8.5
    enemyY = squareSize * 7.5
  }
}

// ========================================
// MÁQUINA DE ESTADOS DEL ENEMIGO
// (cada estado se pinta en CSS con [data-state])
// ========================================
function setEnemyState(nextState) {
  currentEnemyState = nextState
  enemyStateStartFrame = gameFrame
}

const enemyStateHandlers = {
  walking: () => {
    const { dx, dy, distance } = getEnemyDistanceAndDirection()
    const ENEMY_VELOCITY = 1.5 * timeScale

    if (distance <= playerRadius + 15) {
      setEnemyState("attacking")
      return
    }

    if (distance > 0) {
      const normalizedDx = dx / distance
      const normalizedDy = dy / distance

      const newEnemyX = enemyX + normalizedDx * ENEMY_VELOCITY
      const newEnemyY = enemyY + normalizedDy * ENEMY_VELOCITY

      if (!detectCollision(newEnemyX, enemyY)) {
        enemyX = newEnemyX
      }
      if (!detectCollision(enemyX, newEnemyY)) {
        enemyY = newEnemyY
      }
    }
  },

  attacking: () => {
    const { distance } = getEnemyDistanceAndDirection()
    if (distance > playerRadius + 20) {
      setEnemyState("walking")
    }
  },

  taking_damage: () => {
    if (gameFrame - enemyStateStartFrame >= ENEMY_DAMAGE_DURATION) {
      setEnemyState("dead")
    }
  },

  // Estado final: la figura CSS queda tumbada y gris
  dead: () => {},
}

// ========================================
// LÓGICA DEL JUGADOR
// ========================================
function updatePlayerRotation() {
  // ← → giran la vista
  if (keysPressed.ArrowRight) angle += ROTATION_SPEED * timeScale
  if (keysPressed.ArrowLeft) angle -= ROTATION_SPEED * timeScale
}

function updatePlayerMovement() {
  // ↑ avanza y ↓ retrocede; si están pulsadas a la vez se anulan
  const direction =
    (keysPressed.ArrowUp ? 1 : 0) - (keysPressed.ArrowDown ? 1 : 0)
  if (direction === 0) return

  const step = VELOCITY * timeScale * direction
  const nextX = playerX + cos(angle) * step
  const nextY = playerY + sin(angle) * step

  // X e Y se comprueban por separado para poder deslizarse por los muros
  if (!checkCircleCollision(nextX, playerY)) playerX = nextX
  if (!checkCircleCollision(playerX, nextY)) playerY = nextY
}

function startFiring() {
  if (isPlayerFiring) return

  isPlayerFiring = true
  fireStartFrame = gameFrame
  // La clase activa las animaciones CSS de retroceso y fogonazo
  weaponFigure.classList.add("is-firing")
}

function updateWeapon() {
  if (!isPlayerFiring) return
  if (gameFrame - fireStartFrame < FIRE_DURATION) return

  isPlayerFiring = false
  weaponFigure.classList.remove("is-firing")
}

// ========================================
// LÓGICA DEL ENEMIGO Y DISPARO
// ========================================
function damageEnemy() {
  if (currentEnemyState !== "dead") {
    setEnemyState("taking_damage")
  }
}

function processPlayerShooting() {
  if (
    !isPlayerFiring ||
    currentEnemyState === "dead" ||
    currentEnemyState === "taking_damage"
  )
    return

  const dx = enemyX - playerX
  const dy = enemyY - playerY
  const enemyAngle = Math.atan2(dy, dx)
  const angleDifference = enemyAngle - angle

  if (angleDifference < FOV / 32) {
    damageEnemy()
  }
}

function renderEnemy() {
  processPlayerShooting()

  const enemyDistance = calculateDistance(playerX, playerY, enemyX, enemyY)
  const enemyAngle = Math.atan2(enemyY - playerY, enemyX - playerX)

  let angleDifference = enemyAngle - angle
  while (angleDifference > Math.PI) angleDifference -= 2 * Math.PI
  while (angleDifference < -Math.PI) angleDifference += 2 * Math.PI

  // Fuera de campo de visión: la figura CSS no se muestra
  if (Math.abs(angleDifference) >= FOV / 2 || enemyDistance <= 0) {
    enemyFigure.classList.remove("is-visible")
    return
  }

  // Se limita al alto de la pantalla para no crear nodos gigantes
  const enemySize = Math.min(
    (squareSize * canvasHeight) / enemyDistance,
    canvasHeight,
  )

  enemyFigure.style.left = `${(angleDifference / FOV + 0.5) * canvasWidth}px`
  enemyFigure.style.top = `${middleY}px`
  enemyFigure.style.width = `${enemySize}px`
  enemyFigure.style.height = `${enemySize}px`

  if (currentEnemyState !== lastRenderedEnemyState) {
    enemyFigure.dataset.state = currentEnemyState
    lastRenderedEnemyState = currentEnemyState
  }

  enemyFigure.classList.add("is-visible")
}

// ========================================
// RAYCASTING
// ========================================
function castRay(rayAngle) {
  const rayDirX = cos(rayAngle)
  const rayDirY = sin(rayAngle)

  const deltaDistX = Math.abs(1 / rayDirX)
  const deltaDistY = Math.abs(1 / rayDirY)

  let mapX = Math.floor(playerX / squareSize)
  let mapY = Math.floor(playerY / squareSize)

  let stepX, stepY
  let sideDistX, sideDistY

  if (rayDirX < 0) {
    stepX = -1
    sideDistX = (playerX / squareSize - mapX) * deltaDistX
  } else {
    stepX = 1
    sideDistX = (mapX + 1.0 - playerX / squareSize) * deltaDistX
  }

  if (rayDirY < 0) {
    stepY = -1
    sideDistY = (playerY / squareSize - mapY) * deltaDistY
  } else {
    stepY = 1
    sideDistY = (mapY + 1.0 - playerY / squareSize) * deltaDistY
  }

  let hit = false
  let side

  while (!hit) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX
      mapX += stepX
      side = 0
    } else {
      sideDistY += deltaDistY
      mapY += stepY
      side = 1
    }

    if (map[mapY]?.[mapX] === 1) {
      hit = true
    }
  }

  let perpWallDist
  if (side === 0) {
    perpWallDist = (mapX - playerX / squareSize + (1 - stepX) / 2) / rayDirX
  } else {
    perpWallDist = (mapY - playerY / squareSize + (1 - stepY) / 2) / rayDirY
  }

  const hitX = playerX + perpWallDist * rayDirX * squareSize
  const hitY = playerY + perpWallDist * rayDirY * squareSize

  const distance = perpWallDist * squareSize
  const correctedDistance = distance * cos(rayAngle - angle)

  return {
    x: hitX,
    y: hitY,
    distance: correctedDistance,
    side: side,
  }
}

function drawWallColumn(columnIndex, wallDistance) {
  const columnHeight = (squareSize * canvasHeight) / wallDistance
  const columnWidth = canvasWidth / RAYS
  const columnX = columnIndex * columnWidth

  ctx.fillRect(
    columnX,
    canvasHeight / 2 - columnHeight / 2,
    columnWidth,
    columnHeight,
  )
}

function performRaycasting() {
  const rayStep = FOV / RAYS

  for (let i = 0; i < RAYS; i++) {
    const rayAngle = angle - FOV / 2 + i * rayStep
    const wallResult = castRay(rayAngle)
    drawWallColumn(i, wallResult.distance)
  }

  renderEnemy()
}

// ========================================
// MINIMAPA
// ========================================
function drawMiniMap() {
  const MINI_MAP_SIZE = 200
  const miniMapScale = MINI_MAP_SIZE / canvasWidth

  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      const cellX = squareSize * x * miniMapScale
      const cellY = squareSize * y * miniMapScale
      const cellSize = squareSize * miniMapScale

      if (map[y][x] === 1) {
        ctx.fillRect(cellX, cellY, cellSize, cellSize)
      }
      ctx.strokeRect(cellX, cellY, cellSize, cellSize)
    }
  }

  ctx.beginPath()
  ctx.arc(
    playerX * miniMapScale,
    playerY * miniMapScale,
    playerRadius * miniMapScale,
    0,
    2 * Math.PI,
  )
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(playerX * miniMapScale, playerY * miniMapScale)
  ctx.lineTo(
    (playerX + playerRadius * 2 * cos(angle)) * miniMapScale,
    (playerY + playerRadius * 2 * sin(angle)) * miniMapScale,
  )
  ctx.stroke()
}

// ========================================
// BUCLE PRINCIPAL
// ========================================
function gameLoop(timestamp = 0) {
  // Se reprograma ANTES de dibujar: así un fallo de renderizado
  // nunca deja el bucle muerto y los controles dejan de responder
  requestAnimationFrame(gameLoop)

  // Escala el movimiento para pantallas de 60, 120 o 144 Hz
  timeScale =
    lastTimestamp === 0
      ? 1
      : Math.min((timestamp - lastTimestamp) / (1000 / 60), 3)
  lastTimestamp = timestamp

  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  updatePlayerRotation()
  updatePlayerMovement()
  enemyStateHandlers[currentEnemyState]?.()
  updateWeapon()
  gameFrame++

  performRaycasting()
  drawMiniMap()
}

// ========================================
// INICIALIZACIÓN
// ========================================
function init() {
  updateCanvasSize()
  restartGame()

  restartButton.addEventListener("click", handleRestartClick)
  gameOverRestart.addEventListener("click", handleRestartClick)

  window.addEventListener("resize", updateCanvasSize)
  window.addEventListener("keydown", handleKeydown)
  window.addEventListener("keyup", handleKeyup)
  window.addEventListener("blur", handleWindowBlur)

  requestAnimationFrame(gameLoop)
}

init()
