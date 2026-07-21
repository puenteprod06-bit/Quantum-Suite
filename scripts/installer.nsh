; SolaroTrade Quantum Suite — NSIS Custom Installer Script
; Se ejecuta durante el proceso de instalación/desinstalación

!macro customHeader
  !system "echo '' > ${BUILD_RESOURCES_DIR}/customHeader"
!macroend

!macro customInit
  ; Verificar si hay una versión anterior instalada y cerrarla
  nsExec::ExecToLog 'taskkill /F /IM "SolaroTrade Quantum Suite.exe"'
!macroend

!macro customInstall
  ; Crear acceso directo en el escritorio
  CreateShortcut "$DESKTOP\SolaroTrade Quantum Suite.lnk" "$INSTDIR\SolaroTrade Quantum Suite.exe"
  
  ; Registrar en "Programas y características" de Windows
  WriteRegStr HKCU "Software\SolaroTrade\Quantum Suite" "InstallPath" "$INSTDIR"
  WriteRegStr HKCU "Software\SolaroTrade\Quantum Suite" "Version" "${VERSION}"
!macroend

!macro customUnInstall
  ; Limpiar registro
  DeleteRegKey HKCU "Software\SolaroTrade\Quantum Suite"
  ; Eliminar acceso directo del escritorio
  Delete "$DESKTOP\SolaroTrade Quantum Suite.lnk"
!macroend
