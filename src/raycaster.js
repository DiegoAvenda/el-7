import { LEVEL_MAP, MAP_WIDTH, MAP_HEIGHT } from "./map.js"

export class Raycaster {
  constructor({ fov = Math.PI / 3, numRays = 160 } = {}) {
    this.fov = fov
    this.numRays = numRays
    this.zBuffer = new Float32Array(numRays)
  }

  setRays(numRays) {
    this.numRays = numRays
    this.zBuffer = new Float32Array(numRays)
  }

  castRay(rayAngle, playerX, playerY, squareSize) {
    const cosAngle = Math.cos(rayAngle)
    const sinAngle = Math.sin(rayAngle)

    const rayDirX = cosAngle === 0 ? 0.00001 : cosAngle
    const rayDirY = sinAngle === 0 ? 0.00001 : sinAngle

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
    let side = 0
    let wallType = 1

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

      if (mapY < 0 || mapY >= MAP_HEIGHT || mapX < 0 || mapX >= MAP_WIDTH) {
        hit = true
        wallType = 1
        break
      }

      const cell = LEVEL_MAP[mapY][mapX]
      if (cell > 0) {
        hit = true
        wallType = cell
      }
    }

    let perpWallDist
    if (side === 0) {
      perpWallDist = (mapX - playerX / squareSize + (1 - stepX) / 2) / rayDirX
    } else {
      perpWallDist = (mapY - playerY / squareSize + (1 - stepY) / 2) / rayDirY
    }

    const distance = Math.max(0.01, perpWallDist * squareSize)

    let wallHitCoord
    if (side === 0) {
      wallHitCoord = playerY / squareSize + perpWallDist * rayDirY
    } else {
      wallHitCoord = playerX / squareSize + perpWallDist * rayDirX
    }
    wallHitCoord -= Math.floor(wallHitCoord)

    return {
      distance,
      side,
      wallType,
      wallHitCoord,
      hitX: playerX + cosAngle * distance,
      hitY: playerY + sinAngle * distance,
    }
  }

  hasLineOfSight(x1, y1, x2, y2, squareSize) {
    const dx = x2 - x1
    const dy = y2 - y1
    const dist = Math.hypot(dx, dy)
    if (dist === 0) return true

    const angle = Math.atan2(dy, dx)
    const result = this.castRay(angle, x1, y1, squareSize)
    return result.distance >= dist - 2
  }


  renderWorld(ctx, canvasWidth, canvasHeight, player, squareSize, assetManager) {
    // Techo
    ctx.fillStyle = "#1e1b2e"
    ctx.fillRect(0, 0, canvasWidth, canvasHeight / 2)

    // Suelo
    ctx.fillStyle = "#2d3748"
    ctx.fillRect(0, canvasHeight / 2, canvasWidth, canvasHeight / 2)

    const rayStep = this.fov / this.numRays
    const halfFov = this.fov / 2
    const columnWidth = canvasWidth / this.numRays
    const wallImg = assetManager?.getImage("wall_tech")

    for (let i = 0; i < this.numRays; i++) {
      const rayAngle = player.angle - halfFov + i * rayStep
      const rayResult = this.castRay(rayAngle, player.x, player.y, squareSize)

      const correctedDistance = rayResult.distance * Math.cos(rayAngle - player.angle)
      this.zBuffer[i] = correctedDistance

      const columnHeight = (squareSize * canvasHeight) / correctedDistance
      const columnX = i * columnWidth
      const columnY = canvasHeight / 2 - columnHeight / 2

      if (wallImg) {
        const texX = Math.floor(rayResult.wallHitCoord * wallImg.naturalWidth)
        ctx.drawImage(
          wallImg,
          texX,
          0,
          1,
          wallImg.naturalHeight,
          columnX,
          columnY,
          columnWidth + 0.5,
          columnHeight
        )
        if (rayResult.side === 1) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.3)"
          ctx.fillRect(columnX, columnY, columnWidth + 0.5, columnHeight)
        }
      } else {
        this._renderWallFallbackColumn(
          ctx,
          columnX,
          columnY,
          columnWidth,
          columnHeight,
          rayResult,
          correctedDistance
        )
      }
    }
  }

  _renderWallFallbackColumn(ctx, x, y, width, height, rayResult, dist) {
    let baseColor
    switch (rayResult.wallType) {
      case 2:
        baseColor = rayResult.side === 0 ? "#0284c7" : "#0369a1"
        break
      case 3:
        baseColor = rayResult.side === 0 ? "#7c3aed" : "#6d28d9"
        break
      default:
        baseColor = rayResult.side === 0 ? "#475569" : "#334155"
        break
    }

    ctx.fillStyle = baseColor
    ctx.fillRect(x, y, width + 0.5, height)

    // Sombra de profundidad
    const fog = Math.min(0.75, dist / 800)
    if (fog > 0) {
      ctx.fillStyle = `rgba(10, 10, 20, ${fog})`
      ctx.fillRect(x, y, width + 0.5, height)
    }

    if (rayResult.wallHitCoord < 0.03 || rayResult.wallHitCoord > 0.97) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)"
      ctx.fillRect(x, y, width + 0.5, height)
    }
  }

  renderSprites(ctx, canvasWidth, canvasHeight, player, squareSize, enemies, assetManager) {
    const spriteList = enemies.map((enemy) => {
      const dx = enemy.x - player.x
      const dy = enemy.y - player.y
      const dist = Math.hypot(dx, dy)
      return { enemy, dist, dx, dy }
    })

    spriteList.sort((a, b) => b.dist - a.dist)
    const halfFov = this.fov / 2

    for (const { enemy, dist, dx, dy } of spriteList) {
      if (dist < 4) continue

      const enemyAngle = Math.atan2(dy, dx)
      let angleDiff = enemyAngle - player.angle
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI

      if (Math.abs(angleDiff) > halfFov + 0.3) continue

      const screenX = (0.5 + angleDiff / this.fov) * canvasWidth
      const screenY = canvasHeight / 2

      const correctedDist = dist * Math.cos(angleDiff)
      const spriteSize = Math.min(
        canvasHeight * 1.5,
        (squareSize * canvasHeight) / correctedDist
      )

      // Comprobar con Z-Buffer
      const centerColumn = Math.floor((screenX / canvasWidth) * this.numRays)
      if (centerColumn >= 0 && centerColumn < this.numRays) {
        if (this.zBuffer[centerColumn] < correctedDist - 5) {
          continue
        }
      }

      enemy.render(
        ctx,
        {
          screenX,
          screenY,
          spriteWidth: spriteSize,
          spriteHeight: spriteSize,
        },
        assetManager,
        { playerX: player.x, playerY: player.y }
      )
    }
  }
}

