// Módulos para controlar el ciclo de vida de la aplicación y crear la ventana nativa del navegador
const { app, BrowserWindow, ipcMain, nativeImage } = require('electron')
const path = require('node:path')
const { exec, spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const crypto = require('node:crypto')

function hashPass(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

let ventanaPrincipal = null

function crearVentana () {
  ventanaPrincipal = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  ventanaPrincipal.maximize()
  ventanaPrincipal.setMenuBarVisibility(false)

  // Bloquea navegación y ventanas nuevas: la ventana solo muestra tu index.html
  ventanaPrincipal.webContents.on('will-navigate', (e) => e.preventDefault())
  ventanaPrincipal.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  ventanaPrincipal.on('closed', () => { ventanaPrincipal = null })

  ventanaPrincipal.loadFile('index.html')

  // mainWindow.webContents.openDevTools()
}

// Solo acepta mensajes que vengan del frame principal de la ventana del lanzador
function esRemitenteConfiable (event) {
  return !!ventanaPrincipal &&
    event.sender === ventanaPrincipal.webContents &&
    event.senderFrame === ventanaPrincipal.webContents.mainFrame
}

app.whenReady().then(() => {

  // --- Sistema de Configuración Persistente ---
  const configDir = path.join(app.getPath('documents'), 'Appxion OS')
  const configFile = path.join(configDir, 'config.json')

  // Crear carpeta si no existe
  if (!fs.existsSync(configDir)) {
    try {
      fs.mkdirSync(configDir, { recursive: true })
    } catch (e) {
      console.error('Error al crear la carpeta de configuración:', e)
    }
  }

  // Cargar configuración
  ipcMain.handle('get-config', (event, user) => {
    if (!esRemitenteConfiable(event)) throw new Error('Remitente no autorizado.')
    try {
      if (fs.existsSync(configFile)) {
        const conf = JSON.parse(fs.readFileSync(configFile, 'utf8'))
        if (user && conf.users && conf.users[user]) {
          return conf.users[user].config || {}
        }
        return conf
      }
    } catch (e) {
      console.error('Error leyendo config.json:', e)
    }
    return {}
  })

  // Guardar configuración
  ipcMain.handle('save-config', (event, user, newConfig) => {
    if (!esRemitenteConfiable(event)) throw new Error('Remitente no autorizado.')
    try {
      let currentConfig = {}
      if (fs.existsSync(configFile)) {
        try {
          currentConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'))
        } catch (e) {} // Ignorar error de parseo, se sobreescribirá
      }
      if (user) {
        if (!currentConfig.users) currentConfig.users = {}
        if (!currentConfig.users[user]) currentConfig.users[user] = { hash: '' }
        if (typeof currentConfig.users[user] === 'string') {
          currentConfig.users[user] = { hash: currentConfig.users[user], config: {} }
        }
        currentConfig.users[user].config = { ...(currentConfig.users[user].config || {}), ...newConfig }
      } else {
        currentConfig = { ...currentConfig, ...newConfig }
      }
      fs.writeFileSync(configFile, JSON.stringify(currentConfig, null, 2), 'utf8')
      return true
    } catch (e) {
      console.error('Error guardando config.json:', e)
      return false
    }
  })
  // --- Autenticación y Usuarios ---
  ipcMain.handle('get-users', (event) => {
    if (!esRemitenteConfiable(event)) throw new Error('Remitente no autorizado.')
    try {
      if (fs.existsSync(configFile)) {
        const conf = JSON.parse(fs.readFileSync(configFile, 'utf8'))
        if (conf.users) return Object.keys(conf.users)
      }
    } catch(e) {}
    return []
  })

  ipcMain.handle('auth-login', (event, user, pass) => {
    if (!esRemitenteConfiable(event)) throw new Error('Remitente no autorizado.')
    try {
      if (fs.existsSync(configFile)) {
        const conf = JSON.parse(fs.readFileSync(configFile, 'utf8'))
        if (!conf.users || Object.keys(conf.users).length === 0) return { ok: true, noUsers: true }
        
        const userData = conf.users[user]
        const savedHash = typeof userData === 'string' ? userData : (userData ? userData.hash : null)

        if (savedHash && savedHash === hashPass(pass)) return { ok: true }
      } else {
        return { ok: true, noUsers: true }
      }
    } catch(e) {
      console.error(e)
    }
    return { ok: false }
  })

  ipcMain.handle('auth-create', (event, user, pass) => {
    if (!esRemitenteConfiable(event)) throw new Error('Remitente no autorizado.')
    try {
      let conf = {}
      if (fs.existsSync(configFile)) {
        try { conf = JSON.parse(fs.readFileSync(configFile, 'utf8')) } catch(e){}
      }
      if (!conf.users) conf.users = {}
      conf.users[user] = { hash: hashPass(pass), config: {} }
      fs.writeFileSync(configFile, JSON.stringify(conf, null, 2), 'utf8')
      return true
    } catch (e) {
      return false
    }
  })

  // --- Energía ---
  ipcMain.handle('power-action', (event, action) => {
    if (!esRemitenteConfiable(event)) throw new Error('Remitente no autorizado.')
    if (action === 'shutdown') {
      app.quit()
    } else if (action === 'restart') {
      app.relaunch()
      app.quit()
    }
  })

  // --- Listar todas las aplicaciones del sistema (Windows) ---
  ipcMain.handle('get-apps', (event) => {
    if (!esRemitenteConfiable(event)) throw new Error('Remitente no autorizado.')
    return new Promise((resolve) => {
      // Obtener apps del menú Inicio con sus rutas de ícono cuando sean .exe clásicos
      const cmd = `powershell -NoProfile -Command "$ErrorActionPreference='SilentlyContinue'; $apps = Get-StartApps; $result = @(); foreach ($a in $apps) { $appID = $a.AppID; $exePath = ''; if ($appID -notmatch '^[A-Za-z0-9.]+_[A-Za-z0-9]+![A-Za-z.]+$') { if (Test-Path $appID) { $exePath = $appID } else { $lnkSearch = Get-ChildItem -Path \"$env:APPDATA\\Microsoft\\Windows\\Start Menu\", \"C:\\ProgramData\\Microsoft\\Windows\\Start Menu\" -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | Where-Object { $_.BaseName -eq $a.Name } | Select-Object -First 1; if ($lnkSearch) { $exePath = $lnkSearch.FullName } } }; $result += [PSCustomObject]@{ Name = $a.Name; AppID = $appID; ExePath = $exePath } }; $result | ConvertTo-Json -Compress"`
      exec(cmd, { maxBuffer: 8 * 1024 * 1024, timeout: 30000 }, (error, stdout) => {
        if (error || !stdout) {
          resolve([])
          return
        }
        try {
          let parsed = JSON.parse(stdout.trim())
          if (!Array.isArray(parsed)) parsed = [parsed]
          const result = parsed.map(a => ({
            id: a.AppID,
            name: a.Name,
            exec: `explorer.exe shell:AppsFolder\\${a.AppID}`,
            execPath: a.ExePath || null,  // ruta .exe o .lnk para extraer icono
            icon: null
          }))
          result.sort((a, b) => a.name.localeCompare(b.name))
          resolve(result)
        } catch (e) {
          resolve([])
        }
      })
    })
  })

  // --- Extraer icono real de una app (Windows) ---
  // Devuelve data-URI PNG base64 o null
  const iconCache = new Map()
  ipcMain.handle('get-app-icon', async (event, appId, execPath) => {
    if (!esRemitenteConfiable(event)) throw new Error('Remitente no autorizado.')
    const cacheKey = execPath || appId
    if (iconCache.has(cacheKey)) return iconCache.get(cacheKey)

    // Estrategia 1: nativeImage.createFromPath para .exe o .lnk
    if (execPath && (execPath.toLowerCase().endsWith('.exe') || execPath.toLowerCase().endsWith('.lnk'))) {
      try {
        const img = await app.getFileIcon(execPath, { size: 'large' })
        if (img && !img.isEmpty()) {
          const dataUrl = img.toDataURL()
          iconCache.set(cacheKey, dataUrl)
          return dataUrl
        }
      } catch (_) { /* continuar con siguiente estrategia */ }
    }

    // Estrategia 2: buscar el .exe en archivos del menú Inicio y extraer el icono
    return new Promise((resolve) => {
      // Script PowerShell que busca el .exe vinculado a la AppID, extrae su ícono
      // como PNG usando System.Drawing y lo devuelve como base64
      const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$appId = '${(appId || '').replace(/'/g, "''")}'
$exePath = '${(execPath || '').replace(/'/g, "''")}'
$iconBase64 = $null

Add-Type -AssemblyName System.Drawing

function Get-IconBase64($path) {
  try {
    if ($path -match '\\.lnk$') {
      $shell = New-Object -ComObject WScript.Shell
      $lnk = $shell.CreateShortcut($path)
      $targetPath = $lnk.TargetPath
      if ($targetPath -and (Test-Path $targetPath)) { $path = $targetPath }
    }
    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($path)
    if ($icon) {
      $bmp = $icon.ToBitmap()
      $ms = New-Object System.IO.MemoryStream
      $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
      $bytes = $ms.ToArray()
      $ms.Dispose(); $bmp.Dispose(); $icon.Dispose()
      return [Convert]::ToBase64String($bytes)
    }
  } catch {}
  return $null
}

if ($exePath -and (Test-Path $exePath)) {
  $iconBase64 = Get-IconBase64 $exePath
}

if (-not $iconBase64) {
  $startMenuPaths = @(
    [System.Environment]::GetFolderPath('StartMenu'),
    [System.Environment]::GetFolderPath('CommonStartMenu')
  )
  foreach ($smp in $startMenuPaths) {
    $found = Get-ChildItem -Path $smp -Recurse -Include *.lnk,*.exe -ErrorAction SilentlyContinue |
      Where-Object { $_.BaseName -like "*$($appId.Split('!')[-1].Split('.')[-1])*" -or $_.BaseName -like "*$($appId.Split('_')[0])*" } |
      Select-Object -First 1
    if ($found) { $iconBase64 = Get-IconBase64 $found.FullName; break }
  }
}

Write-Output $iconBase64
`.trim()

      exec(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
        { maxBuffer: 2 * 1024 * 1024, timeout: 10000 },
        (err, stdout) => {
          const b64 = (stdout || '').trim()
          if (!err && b64 && b64.length > 100) {
            const dataUrl = 'data:image/png;base64,' + b64
            iconCache.set(cacheKey, dataUrl)
            resolve(dataUrl)
          } else {
            iconCache.set(cacheKey, null)
            resolve(null)
          }
        }
      )
    })
  })

  // --- Lanzar una aplicación ---
  ipcMain.handle('launch-app', (event, idEscritorio, comandoEjecucion) => {
    if (!esRemitenteConfiable(event)) throw new Error('Remitente no autorizado.')
    if (typeof idEscritorio !== 'string' || !idEscritorio.trim()) throw new Error('ID inválido')

    return new Promise((resolve, reject) => {
      let terminado = false
      let temporizador = null

      const finalizar = (fn, valor) => {
        if (terminado) return
        terminado = true
        clearTimeout(temporizador)
        fn(valor)
      }

      temporizador = setTimeout(() => finalizar(resolve, 'Lanzado'), 1500)

      if (comandoEjecucion && typeof comandoEjecucion === 'string' && comandoEjecucion.trim()) {
        exec(comandoEjecucion, { windowsHide: false }, (err) => {
          if (err) finalizar(reject, new Error(err.message))
          else finalizar(resolve, 'Lanzado con éxito')
        })
      } else {
        finalizar(reject, new Error('No se pudo lanzar la aplicación'))
      }
    })
  })

  // --- Seleccionar imagen de fondo ---
  ipcMain.handle('select-image', async (event) => {
    if (!esRemitenteConfiable(event)) throw new Error('Remitente no autorizado.')
    const { dialog } = require('electron')
    const resultado = await dialog.showOpenDialog(ventanaPrincipal, {
      properties: ['openFile'],
      filters: [{ name: 'Imágenes', extensions: ['jpg', 'png', 'gif', 'webp', 'jpeg'] }]
    })
    if (!resultado.canceled && resultado.filePaths.length > 0) {
      return 'file://' + resultado.filePaths[0].replace(/\\/g, '/')
    }
    return null
  })

  // --- Ejecutar comando genérico ---
  ipcMain.handle('run-command', (event, comando) => {
    if (!esRemitenteConfiable(event)) throw new Error('Remitente no autorizado.')
    if (typeof comando !== 'string' || !comando.trim() || comando.length > 4000) {
      throw new Error('Comando inválido: debe ser un texto no vacío.')
    }

    return new Promise((resolve, reject) => {
      let terminado = false
      let temporizador = null

      const finalizar = (fn, valor) => {
        if (terminado) return
        terminado = true
        clearTimeout(temporizador)
        fn(valor)
      }

      temporizador = setTimeout(() => finalizar(resolve, 'Lanzado'), 1500)

      exec(comando, { windowsHide: false, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          finalizar(reject, new Error((stderr || error.message).toString().trim()))
        } else {
          finalizar(resolve, stdout ? stdout.toString() : 'Ejecutado con éxito')
        }
      })
    })
  })

  // --- Batería real (Windows: PowerShell Win32_Battery) ---
  ipcMain.handle('get-battery', (event) => {
    if (!esRemitenteConfiable(event)) throw new Error('Remitente no autorizado.')
    return new Promise((resolve) => {
      const cmd = 'powershell -NoProfile -Command "Get-WmiObject -Class Win32_Battery | Select-Object -First 1 EstimatedChargeRemaining,BatteryStatus | ConvertTo-Json -Compress"'
      exec(cmd, { timeout: 8000 }, (error, stdout) => {
        if (error || !stdout || !stdout.trim()) {
          resolve({ porcentaje: null, estado: 'Sin batería', nombre: null })
          return
        }
        try {
          const d = JSON.parse(stdout.trim())
          const pct = typeof d.EstimatedChargeRemaining === 'number' ? d.EstimatedChargeRemaining : null
          const s = d.BatteryStatus
          let estado = 'Discharging'
          if (s === 2 || s === 3) estado = 'Full'
          else if (s >= 6 && s <= 9) estado = 'Charging'
          resolve({ porcentaje: pct, estado, nombre: 'Battery' })
        } catch {
          resolve({ porcentaje: null, estado: 'Error', nombre: null })
        }
      })
    })
  })

  // --- Redes WiFi reales (Windows: netsh wlan) ---
  ipcMain.handle('get-wifi', (event) => {
    if (!esRemitenteConfiable(event)) throw new Error('Remitente no autorizado.')
    return new Promise((resolve) => {
      exec('netsh wlan show interfaces', { timeout: 5000 }, (e1, ifaces) => {
        let ssidConectado = ''
        if (!e1 && ifaces) {
          for (const linea of ifaces.split(/\r?\n/)) {
            const m = linea.match(/^\s{1,10}SSID\s+:\s+(.+)$/)
            if (m) { ssidConectado = m[1].trim(); break }
          }
        }
        exec('netsh wlan show networks mode=bssid', { timeout: 8000 }, (error, stdout) => {
          if (error || !stdout || !stdout.trim()) {
            resolve({ redes: [], error: error ? error.message : 'Sin resultados' })
            return
          }
          const redes = []
          const vistas = new Set()
          const partes = stdout.split(/\r?\nSSID \d+\s+:/)
          for (let i = 1; i < partes.length; i++) {
            const bloque = partes[i]
            const primeraLinea = bloque.split(/\r?\n/)[0]
            const ssid = primeraLinea.trim()
            if (!ssid || vistas.has(ssid)) continue
            vistas.add(ssid)

            let mejorSenal = 0
            for (const m of bloque.matchAll(/Signal\s+:\s+(\d+)%/g)) {
              const s = parseInt(m[1], 10)
              if (s > mejorSenal) mejorSenal = s
            }

            const authMatch = bloque.match(/Authentication\s+:\s+(.+)/)
            const auth = authMatch ? authMatch[1].trim() : ''
            const abierta = auth.toLowerCase() === 'open' || auth === ''

            redes.push({
              ssid,
              senal: mejorSenal,
              seguridad: abierta ? 'Abierta' : auth,
              conectada: ssid === ssidConectado
            })
          }
          redes.sort((a, b) => (b.conectada - a.conectada) || (b.senal - a.senal))
          resolve({ redes })
        })
      })
    })
  })

  crearVentana()
})

// Windows: cerrar todas las ventanas = salir de la app
app.on('window-all-closed', () => app.quit())