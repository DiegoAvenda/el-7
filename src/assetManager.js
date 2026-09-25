/**
 * AssetManager con Sistema de Fallback Seguro.
 * Carga imágenes de manera asíncrona y segura. Si un recurso falla o no existe,
 * el estado se marca como 'error' sin arrojar excepciones no controladas,
 * permitiendo que el motor de renderizado use Primitivas de Canvas como fallback.
 */
export class AssetManager {
  constructor() {
    this.assets = new Map()
    this.listeners = new Set()
  }

  /**
   * Registra y carga una imagen por su clave.
   * @param {string} key - Identificador único del asset (ej: 'wall', 'enemy_idle', 'weapon')
   * @param {string} src - Ruta de la imagen
   * @returns {Promise<boolean>} Resuelve true si cargó, false si falló (nunca hace reject)
   */
  loadImage(key, src) {
    if (this.assets.has(key)) {
      const existing = this.assets.get(key)
      if (existing.status === "loaded") return Promise.resolve(true)
      if (existing.status === "error") return Promise.resolve(false)
    }

    const entry = {
      image: new Image(),
      status: "loading",
      src,
    }
    this.assets.set(key, entry)

    return new Promise((resolve) => {
      entry.image.onload = () => {
        entry.status = "loaded"
        this._notify(key, "loaded")
        resolve(true)
      }
      entry.image.onerror = () => {
        entry.status = "error"
        // Log informativo indicando que entra en acción el fallback
        console.info(`[AssetManager] Fallback activo para "${key}": la imagen no está disponible en "${src}". Se usarán Canvas Primitives.`)
        this._notify(key, "error")
        resolve(false)
      }
      entry.image.src = src
    })
  }

  /**
   * Carga múltiples assets en paralelo de forma segura.
   * @param {Record<string, string>} manifest - Objeto clave-valor con { key: ruta }
   */
  async loadManifest(manifest) {
    const promises = Object.entries(manifest).map(([key, src]) =>
      this.loadImage(key, src)
    )
    return Promise.all(promises)
  }

  /**
   * Comprueba si una imagen cargó correctamente y está lista para dibujarse.
   * @param {string} key
   * @returns {boolean}
   */
  isReady(key) {
    const entry = this.assets.get(key)
    return Boolean(
      entry &&
        entry.status === "loaded" &&
        entry.image &&
        entry.image.naturalWidth > 0
    )
  }

  /**
   * Obtiene la imagen si está lista, o null en caso de fallback.
   * @param {string} key
   * @returns {HTMLImageElement | null}
   */
  getImage(key) {
    return this.isReady(key) ? this.assets.get(key).image : null
  }

  /**
   * Obtiene el estado actual de un asset ('unloaded' | 'loading' | 'loaded' | 'error').
   * @param {string} key
   * @returns {string}
   */
  getStatus(key) {
    return this.assets.get(key)?.status || "unloaded"
  }

  onChange(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  _notify(key, status) {
    for (const listener of this.listeners) {
      try {
        listener(key, status)
      } catch (err) {
        console.error("[AssetManager] Error en listener:", err)
      }
    }
  }
}

export const assetManager = new AssetManager()
