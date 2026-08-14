/**
 * "copy" domain vocabulary: confirmation messages, illustrated empty
 * states, keyboard diagnostics screen and not-found page.
 */
export default {
  // Confirmations before a sensitive action (src/lib/copy/index.ts)
  "copy.confirm.moveToTrash.title_one": "¿Eliminar {count} archivo?",
  "copy.confirm.moveToTrash.title_other": "¿Eliminar {count} archivos?",
  "copy.confirm.moveToTrash.description_one":
    "Este archivo se moverá a la papelera. Podrás restaurarlo mientras la papelera no se haya vaciado.",
  "copy.confirm.moveToTrash.description_other":
    "Estos archivos se moverán a la papelera. Podrás restaurarlos mientras la papelera no se haya vaciado.",
  "copy.confirm.moveToTrash.confirmLabel": "Mover a la papelera",

  "copy.confirm.deleteForever.title_one": "¿Eliminar definitivamente {count} elemento?",
  "copy.confirm.deleteForever.title_other": "¿Eliminar definitivamente {count} elementos?",
  "copy.confirm.deleteForever.description":
    "Esta eliminación es permanente: estos elementos no se podrán recuperar después.",
  "copy.confirm.deleteForever.confirmLabel": "Eliminar definitivamente",

  "copy.confirm.emptyTrash.title": "¿Vaciar la papelera?",
  "copy.confirm.emptyTrash.description_one":
    "{count} elemento se eliminará definitivamente de tu dispositivo. Esta acción no se puede deshacer.",
  "copy.confirm.emptyTrash.description_other":
    "{count} elementos se eliminarán definitivamente de tu dispositivo. Esta acción no se puede deshacer.",
  "copy.confirm.emptyTrash.confirmLabel": "Vaciar papelera",

  "copy.confirm.move.title_one": "¿Mover {count} elemento?",
  "copy.confirm.move.title_other": "¿Mover {count} elementos?",
  "copy.confirm.move.description_one":
    "Este elemento se quitará de su ubicación actual y se colocará en «{destination}».",
  "copy.confirm.move.description_other":
    "Estos elementos se quitarán de su ubicación actual y se colocarán en «{destination}».",
  "copy.confirm.move.confirmLabel": "Mover",

  "copy.confirm.encrypt.title_one": "¿Mover {count} archivo a la caja fuerte?",
  "copy.confirm.encrypt.title_other": "¿Mover {count} archivos a la caja fuerte?",
  "copy.confirm.encrypt.description":
    "Los archivos se cifrarán y ya no aparecerán en la galería ni en otras apps. Solo tu código de caja fuerte podrá desbloquearlos de nuevo.",
  "copy.confirm.encrypt.confirmLabel": "Cifrar y mover",

  "copy.confirm.restore.title_one": "¿Restaurar {count} elemento?",
  "copy.confirm.restore.title_other": "¿Restaurar {count} elementos?",
  "copy.confirm.restore.description":
    "Los elementos se restaurarán a su ubicación original. Si ya existe un archivo con el mismo nombre, GeniusFiles ofrecerá renombrarlo.",
  "copy.confirm.restore.confirmLabel": "Restaurar",

  "copy.confirm.clean.title": "¿Iniciar la limpieza?",
  "copy.confirm.clean.description_one":
    "Se eliminará {count} elemento y se liberará aproximadamente {freed}. Solo se ven afectados los elementos marcados.",
  "copy.confirm.clean.description_other":
    "Se eliminarán {count} elementos y se liberará aproximadamente {freed}. Solo se ven afectados los elementos marcados.",
  "copy.confirm.clean.confirmLabel": "Limpiar",

  "copy.confirm.overwriteFile.title": "¿Reemplazar «{name}»?",
  "copy.confirm.overwriteFile.description":
    "Ya existe un archivo con este nombre en esta ubicación. Será reemplazado definitivamente por el nuevo archivo.",
  "copy.confirm.overwriteFile.confirmLabel": "Reemplazar",

  "copy.confirm.deletePages.title_one": "¿Eliminar {count} página?",
  "copy.confirm.deletePages.title_other": "¿Eliminar {count} páginas?",
  "copy.confirm.deletePages.description_one":
    "Esta página se quitará del nuevo PDF que se está creando. El archivo original permanece sin cambios.",
  "copy.confirm.deletePages.description_other":
    "Estas páginas se quitarán del nuevo PDF que se está creando. El archivo original permanece sin cambios.",
  "copy.confirm.deletePages.confirmLabel": "Eliminar",

  "copy.confirm.runAutomation.title": "¿Ejecutar «{name}»?",
  "copy.confirm.runAutomation.description":
    "GeniusFiles aplicará esta regla a tus archivos ahora mismo. Verás los detalles de los cambios después.",
  "copy.confirm.runAutomation.confirmLabel": "Ejecutar ahora",

  // Shared vocabulary (list joining)
  "copy.joinList.and": "y",

  // Illustrated empty states (src/lib/copy/empty-illustrations.ts)
  "copy.empty.files.title": "Sin archivos",
  "copy.empty.files.description": "Aquí todavía no hay nada que mostrar.",
  "copy.empty.documents.title": "Sin documentos",
  "copy.empty.documents.description": "Tus documentos aparecerán aquí.",
  "copy.empty.images.title": "Sin imágenes",
  "copy.empty.images.description": "Tus fotos e imágenes aparecerán aquí.",
  "copy.empty.videos.title": "Sin vídeos",
  "copy.empty.videos.description": "Tus vídeos aparecerán aquí.",
  "copy.empty.audio.title": "Sin música",
  "copy.empty.audio.description": "Tu música y grabaciones aparecerán aquí.",
  "copy.empty.downloads.title": "Sin descargas",
  "copy.empty.downloads.description": "Los archivos que descargues aparecerán aquí.",
  "copy.empty.favorites.title": "Sin favoritos",
  "copy.empty.favorites.description": "Marca un archivo como favorito para encontrarlo aquí.",
  "copy.empty.trash.title": "La papelera está vacía",
  "copy.empty.trash.description":
    "Los elementos eliminados aparecen aquí antes de borrarse definitivamente.",
  "copy.empty.search.title": "Sin resultados",
  "copy.empty.search.description": "Prueba con otra palabra clave o ajusta tus filtros.",
  "copy.empty.folder.title": "Carpeta vacía",
  "copy.empty.folder.description": "Esta carpeta aún no contiene nada.",
  "copy.empty.storage.title": "Almacenamiento no disponible",
  "copy.empty.storage.description": "No se puede acceder a esta ubicación de almacenamiento.",
  "copy.empty.permission.title": "Permiso denegado",
  "copy.empty.permission.description": "Permite que GeniusFiles acceda a tus archivos.",
  "copy.empty.network.title": "Error de red",
  "copy.empty.network.description": "Comprueba tu conexión a Internet y vuelve a intentarlo.",
  "copy.empty.notFound.title": "Archivo no encontrado",
  "copy.empty.notFound.description": "Este archivo ya no existe o se ha movido.",
  "copy.empty.openFailed.title": "No se puede abrir",
  "copy.empty.openFailed.description": "Este archivo no pudo abrirse.",
  "copy.empty.lowSpace.title": "Espacio insuficiente",
  "copy.empty.lowSpace.description":
    "No hay suficiente espacio libre para completar esta operación. Libera espacio y vuelve a intentarlo.",
  "copy.empty.unknownError.title": "Error desconocido",
  "copy.empty.unknownError.description":
    "Ocurrió algo inesperado. Inténtalo de nuevo en un momento.",
  "copy.empty.operationFailed.title": "Operación fallida",
  "copy.empty.operationFailed.description":
    "No se pudo completar la acción solicitada. Comprueba los detalles y vuelve a intentarlo.",

  // Illustrated-state action labels
  "copy.emptyAction.retry": "Reintentar",
  "copy.emptyAction.allow": "Permitir",
  "copy.emptyAction.back": "Atrás",
  "copy.emptyAction.openWith": "Elegir otra app",
  "copy.emptyAction.freeSpace": "Liberar espacio",

  // Chat offline state
  "copy.chatOffline.title": "Sin conexión a Internet",
  "copy.chatOffline.description":
    "Tu mensaje no se puede enviar ahora mismo. Comprueba tu conexión y vuelve a intentarlo.",
  "copy.chatOffline.retry": "Reintentar",

  // Not-found page (src/routes/__root.tsx)
  "copy.notFound.title": "Página no encontrada",
  "copy.notFound.description": "Esta página no existe o se ha movido.",
  "copy.notFound.backHome": "Volver al inicio",

  // Keyboard diagnostics screen (src/routes/diagnostic-clavier.tsx)
  "copy.keyboardDiag.title": "Prueba del teclado",
  "copy.keyboardDiag.subtitle":
    "Comprueba que el teclado de Android reacciona correctamente para cada tipo de campo",
  "copy.keyboardDiag.preset.text": "Texto (nombre de carpeta, renombrar)",
  "copy.keyboardDiag.preset.search": "Búsqueda",
  "copy.keyboardDiag.preset.sentence": "Conversación (notas, comentarios)",
  "copy.keyboardDiag.preset.words": "Nombre propio / título corto",
  "copy.keyboardDiag.preset.multiline": "Comentario multilínea",
  "copy.keyboardDiag.preset.password": "Contraseña (comparación)",
  "copy.keyboardDiag.fieldTypeLabel": "Tipo de campo",
  "copy.keyboardDiag.testFieldLabel": "Campo de prueba",
  "copy.keyboardDiag.placeholder": "Escribe aquí para probar el teclado…",
  "copy.keyboardDiag.expectedBehavior": "Comportamiento esperado para este campo",
  "copy.keyboardDiag.row.fieldType": "Tipo de campo",
  "copy.keyboardDiag.row.autoCorrect": "Autocorrección",
  "copy.keyboardDiag.row.autoCorrect.on": "activada",
  "copy.keyboardDiag.row.autoCorrect.off": "desactivada",
  "copy.keyboardDiag.row.autoCapitalize": "Mayúsculas automáticas",
  "copy.keyboardDiag.row.autoCapitalize.on": "activadas",
  "copy.keyboardDiag.row.autoCapitalize.off": "desactivadas",
  "copy.keyboardDiag.row.suggestions": "Sugerencias esperadas",
  "copy.keyboardDiag.row.yes": "sí",
  "copy.keyboardDiag.row.no": "no",
  "copy.keyboardDiag.row.detectedLanguage": "Idioma detectado",
  "copy.keyboardDiag.row.notDetected": "no detectado",
  "copy.keyboardDiag.row.activeField": "Campo activo",
  "copy.keyboardDiag.row.typedChars": "Caracteres escritos",
  "copy.keyboardDiag.activityTitle": "Actividad del teclado",
  "copy.keyboardDiag.clear": "Borrar",
  "copy.keyboardDiag.noEvents": "Aún no hay eventos.",
  "copy.keyboardDiag.hint":
    "Consejo: si las sugerencias o las mayúsculas automáticas no aparecen en esta pantalla, el problema viene del propio teclado del sistema (ajustes de Gboard/SwiftKey), no de la app.",
  "copy.keyboardDiag.event.focus": "foco",
  "copy.keyboardDiag.event.blur": "pérdida de foco",
  "copy.keyboardDiag.event.keydown": 'keydown "{key}"',
  "copy.keyboardDiag.event.compositionStart": "entrada en curso (teclado predictivo activo)",
  "copy.keyboardDiag.event.compositionEnd": 'compositionend "{data}"',
  "copy.keyboardDiag.event.beforeInput": 'beforeinput {inputType} "{data}"',
  // Countable units (src/lib/copy/index.ts)
  "copy.unit.file_one": "archivo",
  "copy.unit.file_other": "archivos",
  "copy.unit.folder_one": "carpeta",
  "copy.unit.folder_other": "carpetas",
  "copy.unit.item_one": "elemento",
  "copy.unit.item_other": "elementos",
  "copy.unit.video_one": "vídeo",
  "copy.unit.video_other": "vídeos",
  "copy.unit.photo_one": "foto",
  "copy.unit.photo_other": "fotos",
  "copy.unit.song_one": "canción",
  "copy.unit.song_other": "canciones",
  "copy.unit.action_one": "acción",
  "copy.unit.action_other": "acciones",
  "copy.unit.page_one": "página",
  "copy.unit.page_other": "páginas",
  "copy.unit.result_one": "resultado",
  "copy.unit.result_other": "resultados",
  "copy.unit.app_one": "app",
  "copy.unit.app_other": "apps",

  // Progress and action summaries
  "copy.progress.withDone": "{action} {done} de {total}…",
  "copy.progress.total": "{action} {total}…",
  "copy.progress.ongoing": "{action} en curso…",
  "copy.summary.detail": "{base}.",
  "copy.summary.detailTo": "{base} a {destination}.",
} as const;
