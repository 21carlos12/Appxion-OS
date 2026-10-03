# AppXionOS

Bienvenido a **AppXionOS**, un sistema operativo de escritorio simulado, diseñado con tecnología web y empaquetado para escritorio moderno.

## Características Principales

- **Arquitectura basada en Electron:** Utiliza las últimas capacidades de Electron, integrando Chromium y Node.js para un entorno de escritorio rápido, seguro y eficiente.
- **Compatibilidad:** Diseñado específicamente para funcionar de manera óptima en entornos **Windows 10 y Windows 11**.

## Estructura del Proyecto

El núcleo de la aplicación se mantiene sólido y optimizado con los siguientes componentes esenciales:

- `main.js`: Proceso principal de Electron.
- `preload.js`: Puente de seguridad (Context Isolation) entre el proceso principal y el renderizador.
- `renderer.js`: Lógica del lado del cliente.
- `index.html`: Estructura principal de la interfaz de usuario.
- `styles.css`: Hojas de estilo que dan vida a la estética Caelestia/Hyprland.

## Compilación y Ejecución

Para iniciar el proyecto en entorno de desarrollo:

```bash
npm start
```

Para compilar la versión portable para Windows:

```bash
npm run dist
```
