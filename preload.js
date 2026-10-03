/**
 * El script de precarga se ejecuta antes de que `index.html` se cargue
 * en el renderizador. Tiene acceso a las APIs web, así como a los
 * módulos del proceso de renderizado de Electron y algunas funciones
 * de Node.js integradas.
 *
 * https://www.electronjs.org/docs/latest/tutorial/sandbox
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  obtenerAplicaciones: () => ipcRenderer.invoke('get-apps'),
  lanzarAplicacion: (idEscritorio, comandoEjecucion) => ipcRenderer.invoke('launch-app', String(idEscritorio), String(comandoEjecucion)),
  seleccionarImagen: () => ipcRenderer.invoke('select-image'),
  ejecutarPrograma: (comando) => ipcRenderer.invoke('run-command', String(comando)),
  obtenerBateria: () => ipcRenderer.invoke('get-battery'),
  obtenerWifi: () => ipcRenderer.invoke('get-wifi'),
  obtenerConfiguracion: (user) => ipcRenderer.invoke('get-config', user),
  guardarConfiguracion: (user, config) => ipcRenderer.invoke('save-config', user, config),
  autenticar: (user, pass) => ipcRenderer.invoke('auth-login', String(user), String(pass)),
  crearUsuario: (user, pass) => ipcRenderer.invoke('auth-create', String(user), String(pass)),
  obtenerUsuarios: () => ipcRenderer.invoke('get-users'),
  accionEnergia: (accion) => ipcRenderer.invoke('power-action', String(accion)),
  obtenerIconoApp: (appId, execPath) => ipcRenderer.invoke('get-app-icon', String(appId), String(execPath || ''))
})

window.addEventListener('DOMContentLoaded', () => {
  const reemplazarTexto = (selector, texto) => {
    const elemento = document.getElementById(selector)
    if (elemento) elemento.innerText = texto
  }

  for (const tipo of ['chrome', 'node', 'electron']) {
    reemplazarTexto(`${tipo}-version`, process.versions[tipo])
  }
})