/**
 * Bóveda (español): configuración, pantalla de bloqueo, explorador de
 * archivos protegidos y ajustes de la bóveda.
 */
export default {
  "vault.title": "Bóveda",
  "vault.exit": "Salir de la bóveda",
  "vault.loading": "Cargando…",

  "vault.method.pin": "código PIN",
  "vault.method.password": "contraseña",
  "vault.method.pattern": "patrón",

  "vault.setup.title": "Configurar la bóveda",
  "vault.setup.desc":
    "Tus archivos sensibles permanecen sin conexión y ocultos del resto de GeniusFiles mientras estén protegidos.",
  "vault.setup.done": "Bóveda configurada",
  "vault.setup.failed": "Error al configurar",
  "vault.setup.step.method": "Método",
  "vault.setup.step.secret": "Código",
  "vault.setup.step.confirm": "Confirmación",
  "vault.setup.method.pin.label": "Código PIN",
  "vault.setup.method.pin.desc": "Al menos 4 dígitos, rápido de escribir en el móvil.",
  "vault.setup.method.pattern.label": "Patrón",
  "vault.setup.method.pattern.desc": "Conecta al menos 4 puntos en una cuadrícula de 3×3.",
  "vault.setup.method.password.label": "Contraseña",
  "vault.setup.method.password.desc": "Al menos 6 caracteres, para máxima seguridad.",
  "vault.setup.secret.pattern.label": "Dibuja tu patrón",
  "vault.setup.secret.choose": "Elige tu {method}",
  "vault.setup.pattern.recorded": "Patrón registrado ({count} puntos)",
  "vault.setup.pattern.hint": "Conecta al menos 4 puntos sin levantar el dedo.",
  "vault.setup.hint.pin": "Al menos 4 dígitos. Evita secuencias obvias como 0000 o 1234.",
  "vault.setup.hint.password": "Al menos 6 caracteres. Combina letras, números y símbolos.",
  "vault.setup.confirm.label": "Confirma tu {method}",
  "vault.setup.mismatch": "Los valores no coinciden.",
  "vault.setup.activate": "Activar la bóveda",

  "vault.biometric.label": "Desbloqueo biométrico",
  "vault.biometric.reason": "Desbloquear la bóveda",
  "vault.biometric.useCode": "Usar código",
  "vault.biometric.status.available": "Usa tu huella o rostro como atajo.",
  "vault.biometric.status.none_enrolled":
    "No hay huellas registradas: añade una en los ajustes de Android.",
  "vault.biometric.status.no_hardware":
    "Este dispositivo no tiene sensor biométrico: el código sigue siendo obligatorio.",
  "vault.biometric.status.hw_unavailable":
    "Sensor biométrico temporalmente no disponible; inténtalo más tarde.",
  "vault.biometric.status.security_update_required":
    "Se requiere una actualización de seguridad de Android para la biometría.",
  "vault.biometric.status.unsupported": "Biometría no compatible con esta versión de Android.",
  "vault.biometric.status.lockout":
    "Demasiados intentos: la biometría está bloqueada temporalmente por Android.",
  "vault.biometric.status.cancelled": "Autenticación biométrica cancelada.",
  "vault.biometric.status.failed": "Autenticación biométrica fallida; usa tu código.",
  "vault.biometric.status.web": "Solo disponible en la app de Android.",
  "vault.biometric.status.unknown":
    "Estado biométrico desconocido: el código sigue siendo obligatorio.",

  "vault.auth.error.oldCode": "Código anterior incorrecto",
  "vault.auth.error.notFound": "Bóveda no encontrada",

  "vault.lock.title": "Bóveda bloqueada",
  "vault.lock.subtitle.pattern": "Dibuja tu patrón para desbloquear.",
  "vault.lock.subtitle.secret": "Introduce tu {method} para desbloquear.",
  "vault.lock.error.pattern": "Patrón incorrecto",
  "vault.lock.error.code": "Código incorrecto",
  "vault.lock.verifying": "Verificando…",
  "vault.lock.unlock": "Desbloquear",
  "vault.lock.useBiometric": "Usar biometría",
  "vault.lock.attempts_one": "{count} intento fallido. Tómate tu tiempo: no se envía ningún dato.",
  "vault.lock.attempts_other":
    "{count} intentos fallidos. Tómate tu tiempo: no se envía ningún dato.",
  "vault.lock.forgot": "Olvidé mi código",

  "vault.reset.title": "Restablecer la bóveda",
  "vault.reset.descBefore": "Esto eliminará",
  "vault.reset.descBold": "de forma permanente",
  "vault.reset.descAfter":
    "todos los archivos de la bóveda y tus ajustes de acceso. No hay recuperación posible.",
  "vault.reset.confirmAll": "Borrar todo",
  "vault.reset.done": "Bóveda restablecida",

  "vault.settings.aria": "Ajustes de la bóveda",
  "vault.settings.title": "Ajustes de la bóveda",
  "vault.settings.autoLock.label": "Bloqueo automático",
  "vault.settings.background.label": "Bloquear en segundo plano",
  "vault.settings.background.desc": "Cierra la bóveda en cuanto GeniusFiles pasa a segundo plano.",

  "vault.autoLock.30s": "30 segundos",
  "vault.autoLock.1m": "1 minuto",
  "vault.autoLock.5m": "5 minutos",
  "vault.autoLock.15m": "15 minutos",
  "vault.autoLock.30m": "30 minutos",
  "vault.autoLock.never": "Nunca",

  "vault.wipe.confirmTitle": "¿Borrar todo?",
  "vault.wipe.confirmDesc":
    "Esto elimina permanentemente todo el contenido de la bóveda y el código de acceso.",
  "vault.wipe.confirmCta": "Restablecer",

  "vault.usage.summary_one": "{count} elemento · {size}",
  "vault.usage.summary_other": "{count} elementos · {size}",
  "vault.restore.title": "Restaurar",

  "vault.lockAria": "Bloquear la bóveda",
  "vault.banner.title": "Espacio privado cifrado",
  "vault.banner.refreshing": " · actualizando…",

  "vault.search.placeholder": "Buscar dentro de la bóveda…",
  "vault.search.clearAria": "Borrar búsqueda",

  "vault.filter.all": "Todos",
  "vault.filter.favorites": "Favoritos ({count})",

  "vault.empty.title": "La bóveda está vacía",
  "vault.empty.desc":
    "Añade archivos sensibles para cifrarlos y ocultarlos del resto de la app. Permanecen en este dispositivo.",
  "vault.empty.searchHint": "Prueba con otro término o revisa la ortografía.",
  "vault.empty.favoritesHint":
    "Marca un archivo de la bóveda con una estrella para encontrarlo aquí.",

  "vault.add.cta": "Añadir archivos",
  "vault.add.aria": "Añadir a la bóveda",
  "vault.add.encrypting_one": "Cifrando {count} archivo…",
  "vault.add.encrypting_other": "Cifrando {count} archivos…",
  "vault.add.success_one": "{count} archivo protegido en la bóveda",
  "vault.add.success_other": "{count} archivos protegidos en la bóveda",
  "vault.add.failed.one":
    "No se pudo proteger «{name}»: inténtalo de nuevo o comprueba el espacio disponible.",
  "vault.add.failed.many_one":
    "No se pudo proteger {count} archivo: inténtalo de nuevo o comprueba el espacio disponible.",
  "vault.add.failed.many_other":
    "No se pudieron proteger {count} archivos: inténtalo de nuevo o comprueba el espacio disponible.",

  "vault.section.folders": "Carpetas",
  "vault.section.results": "Resultados",
  "vault.section.favorites": "Favoritos",
  "vault.section.files": "Archivos",

  "vault.folder.new.title": "Nueva carpeta",
  "vault.folder.new.label": "Nombre de la carpeta",
  "vault.folder.new.cta": "Crear",
  "vault.folder.rename.title": "Renombrar carpeta",
  "vault.folder.rename.label": "Nuevo nombre",
  "vault.folder.renameAria": "Renombrar {name}",
  "vault.folder.deleteAria": "Eliminar {name}",
  "vault.folder.privateLabel": "Carpeta privada",
  "vault.folder.create.done": "Carpeta creada",
  "vault.folder.create.error": "No se pudo crear esta carpeta; el nombre ya podría estar en uso.",
  "vault.folder.rename.error":
    "No se pudo renombrar esta carpeta; el nombre ya podría estar en uso.",
  "vault.folder.delete.done": "Carpeta eliminada",
  "vault.folder.delete.error": "Esta carpeta no está vacía; mueve o elimina su contenido primero.",

  "vault.move.prompt": "Mover a una carpeta existente de la bóveda (déjalo vacío para la raíz)",
  "vault.move.root": "Movido a la raíz",
  "vault.move.into": "Movido a «{name}»",
  "vault.action.impossible": "No es posible",

  "vault.restore.progress": "Restaurando",
  "vault.restore.success_one": "{count} elemento restaurado en su ubicación original",
  "vault.restore.success_other": "{count} elementos restaurados en su ubicación original",
  "vault.restore.failed_one":
    "No se pudo restaurar {count} elemento; comprueba el espacio disponible e inténtalo de nuevo.",
  "vault.restore.failed_other":
    "No se pudieron restaurar {count} elementos; comprueba el espacio disponible e inténtalo de nuevo.",
  "vault.restore.where_one": "¿Dónde quieres restaurar este elemento?",
  "vault.restore.where_other": "¿Dónde quieres restaurar estos elementos?",
  "vault.restore.original.label": "Ubicación original",
  "vault.restore.original.desc": "De vuelta a donde estaban los archivos antes de protegerlos.",
  "vault.restore.choose.label": "Elegir una ubicación…",
  "vault.restore.choose.desc": "Restaurar en una carpeta pública de tu dispositivo.",
  "vault.restore.destinationTitle": "Restaurar en…",

  "vault.delete.success_one": "Elemento eliminado permanentemente",
  "vault.delete.success_other": "{count} elementos eliminados permanentemente",
  "vault.delete.confirmTitle": "¿Eliminar permanentemente?",
  "vault.delete.confirmDescBefore": "Esto elimina permanentemente",
  "vault.delete.confirmDescAfter": "de la bóveda. No será posible restaurarlo.",
  "vault.delete.target.one": "«{name}»",
  "vault.delete.target.many": "{count} elemento(s)",

  "vault.item.actionsAria": "Acciones",
  "vault.item.favoriteAdd": "Añadir a favoritos",
  "vault.item.favoriteRemove": "Quitar de favoritos",
  "vault.item.moveTo": "Mover a una carpeta…",
  "vault.item.restoreEllipsis": "Restaurar…",
  "vault.item.addedOn": "Añadido el {date}",
  "vault.item.favoriteAria": "Favorito",

  "vault.selection.exitAria": "Salir de la selección",

  "vault.sort.date": "Fecha de adición",
  "vault.sort.name": "Nombre",
  "vault.sort.size": "Tamaño",
  "vault.sort.type": "Tipo",

  "vault.preview.subtitle": "{size} · Bóveda",
  "vault.preview.noDirPreview": "Vista previa de carpeta no disponible",
  "vault.preview.webOnly":
    "Vista previa disponible en el dispositivo. El contenido real se carga en el móvil para preservar la privacidad.",
  "vault.preview.unsupported": "Vista previa no disponible para este formato.",
  "vault.preview.unavailable": "Vista previa no disponible",
  "vault.preview.unreadable": "Archivo no legible",

  "vault.pattern.grid": "Cuadrícula de patrón",

  "vault.error.invalidName": "Nombre no válido",
  "vault.error.nameExists": "Este nombre ya existe",
  "vault.error.folderNotFound": "Carpeta no encontrada",
  "vault.error.folderNotEmpty": "La carpeta no está vacía",
  "vault.error.pluginUnavailable": "Complemento no disponible",
  "vault.error.locationNotFound": "Ubicación no encontrada",
  "vault.error.fileNotFound": "Archivo no encontrado",
  "vault.error.originUnknown": "Ubicación original desconocida",
  "vault.error.destNotFound": "Carpeta de destino no encontrada",
} as const;
