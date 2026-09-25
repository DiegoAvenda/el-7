import { isWall } from "./map.js"

/**
 * Estados del FSM para el Cyber-Cuatrero:
 * - IDLE / PATROL: esperando o patrullando entre puntos de guardia
 * - CHASE: persigue al jugador esquivando muros
 * - ATTACK: a corta distancia dispara periódicamente al jugador
 * - DEAD: inactivo, muestra cadáver en el suelo, sin colisiones
 */
export const ENEMY_STATES = {
  IDLE: "IDLE",
  PATROL: "PATROL",
  CHASE: "CHASE",
  ATTACK: "ATTACK",
  DEAD: "DEAD",
}

export class Enemy {
  constructor({ id, x, y, patrolPoints = [] }) {
    this.id = id
    this.x = x
    this.y = y
    this.radius = 16
    this.state = ENEMY_STATES.PATROL
    this.health = 50
    this.maxHealth = 50
    this.speed = 1.3
    this.patrolPoints = patrolPoints
    this.currentPatrolIndex = 0
    this.viewRange = 360
    this.attackRange = 160
    this.attackCooldown = 0
    this.attackRate = 70
    this.damagePerHit = 12
    this.hurtFlashTimer = 0
    this.angle = 0
    this.isDead = false
    this.idleTimer = 0
  }

  takeDamage(amount) {
    if (this.state === ENEMY_STATES.DEAD) return false

    this.health = Math.max(0, this.health - amount)
    this.hurtFlashTimer = 10

    if (this.state !== ENEMY_STATES.ATTACK) {
      this.state = ENEMY_STATES.CHASE
    }

    if (this.health <= 0) {
      this.die()
      return true
    }
    return false
  }

  die() {
    this.state = ENEMY_STATES.DEAD
    this.isDead = true
  }

  update({ playerX, playerY, squareSize, timeScale, onDamagePlayer, hasLineOfSight }) {
    if (this.hurtFlashTimer > 0) {
      this.hurtFlashTimer -= timeScale
    }

    if (this.state === ENEMY_STATES.DEAD) {
      return
    }

    if (this.attackCooldown > 0) {
      this.attackCooldown -= timeScale
    }

    const dx = playerX - this.x
    const dy = playerY - this.y
    const distToPlayer = Math.hypot(dx, dy)
    this.angle = Math.atan2(dy, dx)

    const canSeePlayer =
      distToPlayer <= this.viewRange &&
      hasLineOfSight(this.x, this.y, playerX, playerY)

    switch (this.state) {
      case ENEMY_STATES.IDLE:
        if (canSeePlayer) {
          this.state = distToPlayer <= this.attackRange ? ENEMY_STATES.ATTACK : ENEMY_STATES.CHASE
          break
        }
        this.idleTimer -= timeScale
        if (this.idleTimer <= 0) {
          this.state = ENEMY_STATES.PATROL
        }
        break

      case ENEMY_STATES.PATROL:
        if (canSeePlayer) {
          this.state = distToPlayer <= this.attackRange ? ENEMY_STATES.ATTACK : ENEMY_STATES.CHASE
          break
        }
        this._handlePatrol(squareSize, timeScale)
        break

      case ENEMY_STATES.CHASE:
        if (!canSeePlayer && distToPlayer > this.viewRange * 1.5) {
          this.state = ENEMY_STATES.IDLE
          this.idleTimer = 90
          break
        }
        if (distToPlayer <= this.attackRange && canSeePlayer) {
          this.state = ENEMY_STATES.ATTACK
          break
        }
        this._moveTowards(playerX, playerY, this.speed * timeScale, squareSize)
        break

      case ENEMY_STATES.ATTACK:
        if (distToPlayer > this.attackRange * 1.3 || !canSeePlayer) {
          this.state = ENEMY_STATES.CHASE
          break
        }
        if (this.attackCooldown <= 0) {
          this.attackCooldown = this.attackRate
          onDamagePlayer(this.damagePerHit)
        }
        break
    }
  }

  _handlePatrol(squareSize, timeScale) {
    if (!this.patrolPoints || this.patrolPoints.length === 0) return

    const targetPoint = this.patrolPoints[this.currentPatrolIndex]
    const targetX = targetPoint.x * squareSize
    const targetY = targetPoint.y * squareSize

    const dist = Math.hypot(targetX - this.x, targetY - this.y)
    if (dist < 14) {
      this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length
      this.state = ENEMY_STATES.IDLE
      this.idleTimer = 60
      return
    }

    this._moveTowards(targetX, targetY, (this.speed * 0.6) * timeScale, squareSize)
  }

  _moveTowards(targetX, targetY, step, squareSize) {
    const dx = targetX - this.x
    const dy = targetY - this.y
    const dist = Math.hypot(dx, dy)
    if (dist === 0) return

    const vx = (dx / dist) * step
    const vy = (dy / dist) * step
    const margin = this.radius

    if (!isWall(this.x + vx + (vx > 0 ? margin : -margin), this.y, squareSize)) {
      this.x += vx
    }
    if (!isWall(this.x, this.y + vy + (vy > 0 ? margin : -margin), squareSize)) {
      this.y += vy
    }
  }


  render(ctx, { screenX, screenY, spriteWidth, spriteHeight }, assetManager) {
    const spriteX = screenX - spriteWidth / 2
    const spriteY = screenY - spriteHeight / 2

    const assetKey = this.isDead ? "enemy_dead" : "enemy_cyber_cuatrero"
    const image = assetManager?.getImage(assetKey)

    if (image) {
      ctx.save()
      if (this.hurtFlashTimer > 0) {
        ctx.filter = "brightness(2) contrast(1.5)"
      }
      ctx.drawImage(image, spriteX, spriteY, spriteWidth, spriteHeight)
      ctx.restore()
      this._renderHealthBar(ctx, spriteX, spriteY, spriteWidth, spriteHeight)
      return
    }

    // Fallback Canvas Primitives
    ctx.save()
    if (this.isDead) {
      this._renderDeadFallback(ctx, screenX, screenY, spriteWidth, spriteHeight)
    } else {
      this._renderLivingFallback(ctx, screenX, screenY, spriteWidth, spriteHeight)
      this._renderHealthBar(ctx, spriteX, spriteY, spriteWidth, spriteHeight)
    }
    ctx.restore()
  }

  _renderLivingFallback(ctx, cx, cy, width, height) {
    const isAttacking = this.state === ENEMY_STATES.ATTACK
    const isChasing = this.state === ENEMY_STATES.CHASE
    const isFlashing = this.hurtFlashTimer > 0

    let bodyColor = "#7c3aed"
    let armorColor = "#3b0764"
    let eyeColor = "#00f0ff"

    if (isAttacking) {
      bodyColor = "#ef4444"
      eyeColor = "#facc15"
    } else if (isChasing) {
      bodyColor = "#f97316"
    }

    if (isFlashing) {
      bodyColor = "#ffffff"
      armorColor = "#fbbf24"
      eyeColor = "#ffffff"
    }

    const radius = Math.min(width, height) * 0.35

    // Sombra
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)"
    ctx.beginPath()
    ctx.ellipse(cx, cy + height * 0.38, width * 0.35, height * 0.09, 0, 0, Math.PI * 2)
    ctx.fill()

    // Torso cilíndrico
    ctx.fillStyle = armorColor
    ctx.beginPath()
    ctx.roundRect(cx - radius * 0.75, cy - radius * 0.4, radius * 1.5, radius * 1.7, radius * 0.25)
    ctx.fill()
    ctx.strokeStyle = "#1e1b4b"
    ctx.lineWidth = Math.max(1, width * 0.025)
    ctx.stroke()

    // Cabeza
    ctx.fillStyle = bodyColor
    ctx.beginPath()
    ctx.arc(cx, cy - radius * 0.45, radius * 0.7, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Sombrero vaquero cibernético (Cyber-Cuatrero)
    ctx.fillStyle = "#111827"
    ctx.beginPath()
    ctx.ellipse(cx, cy - radius * 0.85, radius * 1.15, radius * 0.28, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    ctx.beginPath()
    ctx.roundRect(cx - radius * 0.45, cy - radius * 1.5, radius * 0.9, radius * 0.7, [radius * 0.2, radius * 0.2, 0, 0])
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = isAttacking ? "#ef4444" : "#a855f7"
    ctx.fillRect(cx - radius * 0.45, cy - radius * 0.95, radius * 0.9, radius * 0.15)

    // Visor cibernético
    ctx.fillStyle = eyeColor
    ctx.shadowColor = eyeColor
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.roundRect(cx - radius * 0.4, cy - radius * 0.55, radius * 0.8, radius * 0.24, 3)
    ctx.fill()
    ctx.shadowBlur = 0

    // Disparo si está atacando
    if (isAttacking) {
      ctx.fillStyle = "#ef4444"
      ctx.beginPath()
      ctx.arc(cx + radius * 0.9, cy + radius * 0.1, radius * 0.22, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = "#fef08a"
      ctx.beginPath()
      ctx.arc(cx + radius * 0.9, cy + radius * 0.1, radius * 0.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  _renderDeadFallback(ctx, cx, cy, width, height) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)"
    ctx.beginPath()
    ctx.ellipse(cx, cy + height * 0.3, width * 0.42, height * 0.12, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = "#4b5563"
    ctx.strokeStyle = "#1f2937"
    ctx.lineWidth = Math.max(1, width * 0.02)
    ctx.beginPath()
    ctx.ellipse(cx, cy + height * 0.28, width * 0.35, height * 0.16, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = "#1e293b"
    ctx.beginPath()
    ctx.arc(cx - width * 0.22, cy + height * 0.25, width * 0.1, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }

  _renderHealthBar(ctx, x, y, width) {
    if (this.health <= 0 || this.health >= this.maxHealth) return
    const barW = Math.max(26, width * 0.7)
    const barH = 5
    const barX = x + (width - barW) / 2
    const barY = y - 10

    ctx.fillStyle = "rgba(0,0,0,0.6)"
    ctx.fillRect(barX, barY, barW, barH)

    const pct = Math.max(0, this.health / this.maxHealth)
    ctx.fillStyle = pct > 0.4 ? "#22c55e" : "#ef4444"
    ctx.fillRect(barX, barY, barW * pct, barH)
    ctx.strokeStyle = "#000"
    ctx.lineWidth = 1
    ctx.strokeRect(barX, barY, barW, barH)
  }
}

