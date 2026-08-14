/**
 * Pantalla de inicio: saludo, almacenamiento, categorías, herramientas,
 * archivos recientes y acciones del gestor de archivos.
 */
export default {
  "home.greeting.night": "Buenas noches",
  "home.greeting.morning": "Buenos días",
  "home.greeting.afternoon": "Buenas tardes",
  "home.greeting.evening": "Buenas tardes",
  "home.subtitle.default": "Gestiona tus archivos más rápido.",
  "home.subtitle.pick": "Abre un almacenamiento o categoría para seleccionar.",

  "home.title.files": "Archivos",

  "home.section.categories": "Categorías",
  "home.section.tools": "Herramientas",

  "home.category.documents": "Documentos",
  "home.category.images": "Imágenes",
  "home.category.videos": "Vídeos",
  "home.category.audio": "Música",
  "home.category.downloads": "Descargas",
  "home.category.apps": "Aplicaciones",

  "home.tool.cleaner": "Limpiador",
  "home.tool.pdfTools": "Herramientas PDF",
  "home.tool.vault": "Bóveda",
  "home.tool.imageEditor": "Editor de imágenes",
  "home.tool.audioEditor": "Editor de audio",
  "home.tool.trash": "Papelera",

  "home.editorPicker.audioTitle": "Elige un archivo de audio para editar",
  "home.editorPicker.imageTitle": "Elige una imagen para editar",

  "home.pickHowTo.aria": "Cómo seleccionar",
  "home.pickHowTo.title": "¿Cómo seleccionar?",
  "home.pickHowTo.step1": "Abre un almacenamiento o una categoría.",
  "home.pickHowTo.step2Multi": "Toca cada archivo para añadirlo a tu selección.",
  "home.pickHowTo.step2Single": "Toca el archivo que quieras seleccionar.",
  "home.pickHowTo.step3": "Toca su icono para previsualizarlo o abrirlo.",
  "home.pickHowTo.step4": "Termina con “Confirmar” o “Cancelar” para volver.",

  "home.folder.newTitle": "Nueva carpeta",
  "home.folder.nameLabel": "Nombre de la carpeta",
  "home.folder.createCta": "Crear",
  "home.folder.created": "Carpeta creada",
  "home.folder.createFailed": "No se pudo crear la carpeta",

  "home.rename.title": "Renombrar",
  "home.rename.nameLabel": "Nuevo nombre",
  "home.rename.cta": "Renombrar",
  "home.rename.done": "Renombrado",
  "home.rename.failed": "No se pudo renombrar",

  "home.destination.copyTitle": "Copiar a…",
  "home.destination.moveTitle": "Mover a…",

  "home.transfer.rootLabel": "Raíz del almacenamiento",
  "home.transfer.cancelled": "Operación cancelada",
  "home.transfer.cancelledDetail": "{count} {unit}(s) procesados antes de cancelar.",
  "home.transfer.copyLabel": "Copiar",
  "home.transfer.moveLabel": "Mover",
  "home.transfer.toLabel": "A “{dest}”",
  "home.transfer.mixedResult": "{succeeded} correctos, {failed} fallidos",

  "home.delete.label": "Eliminando",
  "home.delete.subtitle": "Moviendo a la papelera",
  "home.delete.cancelledWithCount": "Eliminación cancelada — {count} {unit} ya movidos",
  "home.delete.cancelled": "Eliminación cancelada",
  "home.delete.doneSingle": "“{name}” movido a la papelera",
  "home.delete.doneMultiple": "{count} {unit}s movidos a la papelera",
  "home.delete.failed": "{count} eliminación(es) fallida(s)",

  "home.share.failed": "No se pudo compartir",

  "home.archive.creatingTitle": "Creando el archivo comprimido…",
  "home.archive.creatingSubtitle": "Comprimiendo los elementos seleccionados",
  "home.archive.cancelled": "Compresión cancelada",
  "home.archive.created": "Archivo comprimido creado",
  "home.archive.createdWithSize": "Archivo comprimido creado · {size}",
  "home.archive.failed": "No se pudo comprimir",

  "home.extract.title": "Extrayendo…",
  "home.extract.subtitle": "Extrayendo a la carpeta actual",
  "home.extract.cancelled": "Extracción cancelada",
  "home.extract.done": "Extracción completada ({count})",
  "home.extract.failed": "No se pudo extraer",

  "home.editor.fileNotFound": "Archivo no encontrado",
  "home.editor.fileNotFoundDesc": "Su ubicación ya no está disponible.",
  "home.editor.fileGone": "“{name}” ya no está disponible",

  "home.recent.aria": "Archivos recientes",
  "home.recent.title": "Archivos recientes",
  "home.recent.viewMore": "Ver más",
  "home.recent.empty": "Los nuevos archivos añadidos a tu almacenamiento aparecerán aquí.",

  "home.storage.aria": "Almacenamiento",
  "home.storage.title": "Almacenamiento",
  "home.storage.internal": "Almacenamiento interno",
  "home.storage.usb": "Dispositivo USB",
  "home.storage.sd": "Tarjeta SD",
  "home.storage.readingSpace": "Leyendo espacio…",
  "home.storage.usage": "{used} / {total} · {free} libres",
  "home.storage.open": "Abrir {label}",

  "home.scopePicker.label": "Almacenamiento",
  "home.scopePicker.all": "Todo",

  "home.confirm.working": "Un momento…",

  "home.exit.title": "¿Salir de GeniusFiles?",
  "home.exit.description":
    "Todas las tareas en curso han terminado. Puedes volver a abrir la app cuando quieras, tus carpetas y ajustes se conservarán.",
  "home.exit.confirm": "Salir",

  "home.resume.kind.copy": "copia",
  "home.resume.kind.move": "movimiento",
  "home.resume.kind.compress": "compresión",
  "home.resume.kind.extract": "extracción",
  "home.resume.kind.clean": "limpieza",
  "home.resume.kind.delete": "eliminación",
  "home.resume.title": "Operaciones para reanudar",
  "home.resume.resuming": "Reanudando la {kind}…",
  "home.resume.progress": "Interrumpido al {pct}% — {done} de {total} procesados",
  "home.resume.unknownTotal": "un número desconocido de elementos",
  "home.resume.resume": "Reanudar",
  "home.resume.dismiss": "Descartar",

  "home.states.noResultsDesc": "Prueba con otra palabra o cambia los filtros.",
  "home.states.errorDesc": "Este contenido no se puede mostrar en este momento.",

  "home.nav.aria": "Navegación principal",
} as const;
