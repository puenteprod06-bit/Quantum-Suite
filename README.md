# SolaroTrade Quantum Suite — Desktop App

App de escritorio Windows construida con Electron. Datos reales FRED, motor Hamiltoniano φ⁴, IA Pollinations, auto-actualización vía GitHub Releases.

## Estructura del proyecto

```
solaro-electron/
├── main.js              ← Proceso principal Electron (ventana, proxy FRED, updater)
├── preload.js           ← Bridge seguro main ↔ renderer
├── package.json         ← Dependencias y configuración de build
├── src/
│   └── index.html       ← La app completa (HTML+CSS+JS embebidos)
├── assets/
│   ├── icon.ico         ← Ícono Windows (256x256, formato .ico)
│   ├── icon.png         ← Ícono PNG (512x512)
│   └── tray.png         ← Ícono para la bandeja del sistema (16x16 o 32x32)
├── scripts/
│   └── installer.nsh    ← Script NSIS para el instalador
└── .github/
    └── workflows/
        └── release.yml  ← GitHub Actions: build automático al crear un tag
```

## Setup inicial

### 1. Prerrequisitos
- Node.js 18+ → https://nodejs.org
- Git → https://git-scm.com

### 2. Instalar dependencias
```bash
npm install
```

### 3. Agregar íconos
Necesitás 3 archivos en la carpeta `assets/`:

| Archivo     | Tamaño    | Uso                        |
|-------------|-----------|----------------------------|
| `icon.ico`  | 256×256   | Instalador y exe en Windows |
| `icon.png`  | 512×512   | Referencia general          |
| `tray.png`  | 32×32     | Icono en la bandeja (tray)  |

Podés generarlos desde el logo ST dorado con cualquier editor o con:
```bash
# Con ImageMagick (si lo tenés):
convert icon.png -resize 256x256 icon.ico
convert icon.png -resize 32x32 tray.png
```

### 4. Correr en modo desarrollo
```bash
npm start
# o con DevTools abiertos:
npm run dev
```

### 5. Build para Windows
```bash
npm run build:win
```
Genera en `/dist/`:
- `SolaroTrade Quantum Suite Setup 1.0.0.exe` → instalador NSIS
- `SolaroTrade Quantum Suite 1.0.0.exe` → portable (sin instalar)
- `latest.yml` → metadata para auto-updater

---

## Configurar GitHub para auto-updates

### 1. Crear el repositorio
```bash
git init
git add .
git commit -m "Initial release"
git remote add origin https://github.com/TU_USUARIO/solarotrade-quantum-suite.git
git push -u origin main
```

### 2. Editar `package.json` con tu usuario
```json
"publish": {
  "provider": "github",
  "owner": "TU_USUARIO_GITHUB",    ← cambiar esto
  "repo": "solarotrade-quantum-suite"
}
```

### 3. Crear un release (activa el build automático)
```bash
# Subir cambios
git add .
git commit -m "Nueva versión"

# Crear tag (esto dispara el GitHub Action)
git tag v1.0.1
git push origin v1.0.1
```

El GitHub Action:
1. Hace el build de Windows automáticamente en GitHub's servers
2. Crea el Release en GitHub con los `.exe` adjuntos
3. Genera el `latest.yml` que la app usa para detectar actualizaciones

### 4. Token de GitHub
El GitHub Action usa `GITHUB_TOKEN` automáticamente (no necesitás configurar nada extra para repos públicos).

Para repos privados, agregá un secret `GH_TOKEN` con un Personal Access Token con permisos de `repo`.

---

## Cómo funciona el auto-updater

```
App arranca
    ↓
Espera 5 segundos (para que la UI cargue)
    ↓
autoUpdater.checkForUpdates()
    ↓
Descarga latest.yml de GitHub Releases
    ↓
¿Hay versión más nueva?
    ├── NO  → nada (silencioso)
    └── SÍ  → Diálogo "¿Descargar v1.0.1?"
                  ├── NO   → nada
                  └── SÍ   → Descarga en background + barra de progreso
                                  ↓
                             Diálogo "¿Instalar ahora?"
                                  ├── NO   → Se instala al cerrar la app
                                  └── SÍ   → Cierra y reinstala automáticamente
```

Además, verifica actualizaciones cada 4 horas mientras la app está abierta.

---

## Notas técnicas

- **Proxy FRED integrado**: El `main.js` levanta un servidor HTTP en `localhost:8765` que hace de proxy hacia la API de FRED, resolviendo el problema de CORS sin necesitar `server.py` externo.
- **Single instance**: Si ya hay una instancia abierta, la segunda se cierra y enfoca la primera.
- **Tray icon**: La app se minimiza a la bandeja del sistema, no se cierra.
- **TitleBar overlay**: Usa el titlebar nativo de Windows con colores personalizados (fondo oscuro, ícono dorado).
