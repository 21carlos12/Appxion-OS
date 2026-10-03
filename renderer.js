/**
 * Este archivo se carga mediante la etiqueta <script> en el archivo index.html y
 * se ejecutará en el proceso de renderizado de esa ventana. Las APIs de Node.js no
 * están disponibles en este proceso porque `nodeIntegration` está desactivado y
 * `contextIsolation` está activado. Utiliza la API contextBridge en `preload.js`
 * para exponer la funcionalidad de Node.js desde el proceso principal.
 *
 * NOTA: el index.html actual usa un script en línea y NO carga este archivo.
 * Si lo cargas con <script src="renderer.js"></script>, quita el bloque de
 * lanzamiento en línea del index.html para no ejecutar todo dos veces.
 */

async function lanzarComando (comando) {
  try {
    const resultado = await window.api.ejecutarPrograma(comando)
    console.log(resultado)
    return resultado
  } catch (error) {
    console.error('Error al ejecutar:', error.message || error)
    throw error
  }
}

// Expuesto para usarlo desde otros scripts o desde la consola de DevTools
window.lanzarComando = lanzarComando

document.addEventListener('DOMContentLoaded', () => {
  // Cualquier elemento con data-cmd lanza ese comando exacto
  document.querySelectorAll('[data-cmd]').forEach((el) => {
    el.addEventListener('click', () => {
      lanzarComando(el.dataset.cmd).catch(() => {})
    })
  })
})