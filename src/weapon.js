/**
 * Revólver de Plasma - Arma Única con sistema Hitscan y Fallback de Canvas
 */
export class PlasmaRevolver {
  constructor() {
    this.name = "Revólver de Plasma"
    this.damage = 25 // 2 disparos para eliminar al Cyber-Cuatrero (50 HP)
    this.fireRate = 18 // Tiempo entre disparos en frames (~300ms a 60fps)
    this.cooldown = 0
    this.isFiring = false
    this.animTimer = 0
    this.animDuration = 12 // Duración del retroceso y destello
    this.lastHitResult = null
    this.hitMarkerTimer = 0
  }

  canShoot() {
    return this.cooldown <= 0
  }

  shoot(player, enemies, castRayFn) {
    if (!this.canShoot()) return null

    this.cooldown = this.fireRate
    this.isFiring = true
    this.animTimer = this.animDuration

    const wallHit = castRayFn(player.angle)
    const wallDist = wallHit.distance

    let hitEnemy = null
    let closestDist = wallDist

    for (const enemy of enemies) {
      if (enemy.isDead) continue

      const dx = enemy.x - player.x
      const dy = enemy.y - player.y
      const dist = Math.hypot(dx, dy)

      const enemyAngle = Math.atan2(dy, dx)
      let angleDiff = enemyAngle - player.angle
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI

      const angularRadius = Math.atan2(enemy.radius * 1.3, dist)

      if (Math.abs(angleDiff) <= angularRadius && dist < closestDist) {
        closestDist = dist
        hitEnemy = enemy
      }
    }

    if (hitEnemy) {
      hitEnemy.takeDamage(this.damage)
      this.hitMarkerTimer = 10
      this.lastHitResult = { hit: true, enemy: hitEnemy, dist: closestDist, wallDist }
    } else {
      this.lastHitResult = { hit: false, wallDist }
    }

    return this.lastHitResult
  }

  update(timeScale) {
    if (this.cooldown > 0) {
      this.cooldown -= timeScale
    }
    if (this.animTimer > 0) {
      this.animTimer -= timeScale
      if (this.animTimer <= 0) {
        this.isFiring = false
      }
    }
    if (this.hitMarkerTimer > 0) {
      this.hitMarkerTimer -= timeScale
    }
  }


  render(ctx, canvasWidth, canvasHeight, assetManager) {
    this._renderCrosshair(ctx, canvasWidth / 2, canvasHeight / 2)

    if (this.isFiring && this.animTimer > this.animDuration * 0.4) {
      ctx.save()
      ctx.fillStyle = "rgba(0, 240, 255, 0.12)"
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)
      ctx.restore()
    }

    const weaponImage = assetManager?.getImage("weapon_plasma_revolver")
    const progress = Math.max(0, this.animTimer / this.animDuration)
    const recoilY = Math.sin(progress * Math.PI) * 40
    const recoilX = Math.sin(progress * Math.PI) * 8

    if (weaponImage) {
      ctx.save()
      const w = Math.min(360, canvasWidth * 0.45)
      const h = (w * weaponImage.naturalHeight) / weaponImage.naturalWidth
      const x = canvasWidth / 2 - w / 2 + recoilX
      const y = canvasHeight - h + recoilY
      ctx.drawImage(weaponImage, x, y, w, h)
      ctx.restore()
      return
    }

    this._renderWeaponFallback(ctx, canvasWidth, canvasHeight, recoilX, recoilY, progress)
  }

  _renderCrosshair(ctx, cx, cy) {
    ctx.save()
    const size = 10
    const gap = 4
    const isHitting = this.hitMarkerTimer > 0

    ctx.strokeStyle = isHitting ? "#ef4444" : "#00f0ff"
    ctx.lineWidth = isHitting ? 2.5 : 1.5

    ctx.beginPath()
    ctx.moveTo(cx - size, cy)
    ctx.lineTo(cx - gap, cy)
    ctx.moveTo(cx + gap, cy)
    ctx.lineTo(cx + size, cy)

    ctx.moveTo(cx, cy - size)
    ctx.lineTo(cx, cy - gap)
    ctx.moveTo(cx, cy + gap)
    ctx.lineTo(cx, cy + size)
    ctx.stroke()

    ctx.fillStyle = isHitting ? "#ff2222" : "#ffffff"
    ctx.beginPath()
    ctx.arc(cx, cy, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  _renderWeaponFallback(ctx, canvasWidth, canvasHeight, recoilX, recoilY, progress) {
    ctx.save()
    const scale = Math.min(canvasWidth / 800, canvasHeight / 600) * 1.1
    const baseW = 180 * scale
    const baseH = 240 * scale
    const x = canvasWidth / 2 + 100 * scale + recoilX
    const y = canvasHeight - baseH + recoilY + 20 * scale

    // Empuñadura
    ctx.fillStyle = "#1e293b"
    ctx.beginPath()
    ctx.roundRect(x - baseW * 0.15, y + baseH * 0.5, baseW * 0.35, baseH * 0.45, 12 * scale)
    ctx.fill()
    ctx.strokeStyle = "#0f172a"
    ctx.lineWidth = 3
    ctx.stroke()

    // Cuerpo principal
    const gunGrad = ctx.createLinearGradient(x - baseW * 0.5, y, x + baseW * 0.5, y + baseH)
    gunGrad.addColorStop(0, "#475569")
    gunGrad.addColorStop(0.5, "#1e293b")
    gunGrad.addColorStop(1, "#0f172a")
    ctx.fillStyle = gunGrad
    ctx.beginPath()
    ctx.roundRect(x - baseW * 0.45, y + baseH * 0.2, baseW * 0.75, baseH * 0.45, 8 * scale)
    ctx.fill()
    ctx.stroke()

    // Cañón
    ctx.fillStyle = "#64748b"
    ctx.beginPath()
    ctx.roundRect(x - baseW * 0.25, y - baseH * 0.25, baseW * 0.45, baseH * 0.5, 6 * scale)
    ctx.fill()
    ctx.stroke()

    // Núcleo de Plasma pulsante
    const plasmaGlow = ctx.createRadialGradient(
      x - baseW * 0.05,
      y + baseH * 0.32,
      2,
      x - baseW * 0.05,
      y + baseH * 0.32,
      baseW * 0.24
    )
    plasmaGlow.addColorStop(0, "#ffffff")
    plasmaGlow.addColorStop(0.3, "#00f0ff")
    plasmaGlow.addColorStop(0.8, "#0284c7")
    plasmaGlow.addColorStop(1, "rgba(2, 132, 199, 0)")
    ctx.fillStyle = plasmaGlow
    ctx.beginPath()
    ctx.arc(x - baseW * 0.05, y + baseH * 0.32, baseW * 0.22, 0, Math.PI * 2)
    ctx.fill()

    // Fogonazo al disparar
    if (progress > 0.3) {
      const flashX = x - baseW * 0.02
      const flashY = y - baseH * 0.28
      const flashSize = (40 + progress * 50) * scale

      const flashGrad = ctx.createRadialGradient(flashX, flashY, 4, flashX, flashY, flashSize)
      flashGrad.addColorStop(0, "#ffffff")
      flashGrad.addColorStop(0.3, "#67e8f9")
      flashGrad.addColorStop(0.8, "#06b6d4")
      flashGrad.addColorStop(1, "rgba(6, 182, 212, 0)")

      ctx.fillStyle = flashGrad
      ctx.beginPath()
      ctx.arc(flashX, flashY, flashSize, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }
}

