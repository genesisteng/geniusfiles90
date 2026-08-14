/**
 * Genius AI — pantalla del asistente, panel de conversaciones, pipeline
 * de ejecución y mensajes de diagnóstico relacionados.
 */
export default {
  "assistant.header.menuLabel": "Abrir el menú de conversaciones",
  "assistant.header.title": "Genius AI",
  "assistant.header.newChat": "Nueva conversación",

  "assistant.input.placeholder": "Escribe tu solicitud…",
  "assistant.input.ariaLabel": "Mensaje",
  "assistant.input.stop": "Detener la respuesta",
  "assistant.input.send": "Enviar",

  "assistant.error.title": "Genius AI no pudo cargarse",
  "assistant.error.desc":
    "Una conversación guardada parece ilegible. Puedes volver a intentarlo o iniciar una nueva conversación.",

  "assistant.welcome.title": "Bienvenido a Genius AI",
  "assistant.welcome.desc":
    "Chatea con naturalidad con tu asistente y gestiona tus archivos mediante una simple conversación.",
  "assistant.welcome.privacyTitle": "Privacidad garantizada",
  "assistant.welcome.privacy1": "Tus archivos permanecen exclusivamente en tu dispositivo.",
  "assistant.welcome.privacy2":
    "Genius AI nunca accede directamente a tu almacenamiento. Simplemente entiende tu solicitud y la transmite al motor de ejecución local de GeniusFiles, que realiza las acciones solicitadas.",
  "assistant.welcome.privacy3": "Ningún archivo se envía nunca a un servidor o a una IA externa.",

  "assistant.message.copied": "Copiado",
  "assistant.message.copy": "Copiar",
  "assistant.message.copyAria": "Copiar el mensaje",
  "assistant.message.copiedAria": "Mensaje copiado",

  "assistant.templates.ariaLabel": "Sugerencias",
  "assistant.templates.classifyPhotos": "Ordena todas las fotos por año y luego por mes.",
  "assistant.templates.moveLargeVideos":
    "Mueve todos los vídeos de más de 500 MB a una carpeta Vídeos grandes.",
  "assistant.templates.findRecentPdfs": "Busca todos los PDF modificados en los últimos 30 días.",
  "assistant.templates.biggestFolders":
    "Muestra qué carpetas ocupan más espacio en el almacenamiento interno.",
  "assistant.templates.weekVideos": "Busca todos los vídeos grabados esta semana.",
  "assistant.templates.sortDownloads": "Ordena la carpeta Descargas por tipo de archivo.",
  "assistant.templates.renamePhotosByDate":
    "Renombra todas las imágenes usando su fecha de captura.",
  "assistant.templates.archiveWorkDocs":
    "Mueve todos los documentos de trabajo a una carpeta Archivos.",
  "assistant.templates.findUnusedFiles": "Busca archivos sin usar desde hace más de dos años.",
  "assistant.templates.analyzeStorage":
    "Analiza todo mi almacenamiento y explica qué ocupa más espacio.",
  "assistant.templates.listShortAudio":
    "Lista todos los archivos de audio de menos de dos minutos.",
  "assistant.templates.todayScreenshots": "Busca todas las capturas de pantalla tomadas hoy.",
  "assistant.templates.compressDocuments": "Comprime la carpeta Documentos en un archivo ZIP.",
  "assistant.templates.countPdfs": "¿Cuántos archivos PDF tengo en mi teléfono?",

  "assistant.drawer.ariaLabel": "Menú de Genius AI",
  "assistant.drawer.closeAria": "Cerrar el menú",
  "assistant.drawer.title": "Conversaciones",
  "assistant.drawer.newChat": "Nuevo chat",
  "assistant.drawer.searchPlaceholder": "Buscar una conversación…",
  "assistant.drawer.searchAria": "Buscar una conversación",
  "assistant.drawer.emptySearch": "Ninguna conversación coincide con esta búsqueda.",
  "assistant.drawer.emptyAll": "Aún no hay conversaciones. Escribe a Genius AI para empezar una.",
  "assistant.drawer.today": "Hoy",
  "assistant.drawer.yesterday": "Ayer",
  "assistant.drawer.last7": "Últimos 7 días",
  "assistant.drawer.last30": "Últimos 30 días",
  "assistant.drawer.older": "Anteriores",
  "assistant.drawer.renameAria": "Renombrar {title}",
  "assistant.drawer.deleteAria": "Eliminar {title}",
  "assistant.drawer.renameLabel": "Nuevo nombre",
  "assistant.drawer.defaultTitle": "Nueva conversación",

  "assistant.pipeline.ariaLabel": "Genius AI: {label}",
  "assistant.pipeline.understand": "Comprensión",
  "assistant.pipeline.plan": "Análisis",
  "assistant.pipeline.execute": "Ejecución",
  "assistant.pipeline.verify": "Verificación",
  "assistant.pipeline.respond": "Redactando la respuesta",

  "assistant.stage.list_storage_roots": "Leyendo ubicaciones…",
  "assistant.stage.list": "Leyendo tus carpetas…",
  "assistant.stage.search": "Buscando archivos…",
  "assistant.stage.analyze": "Analizando almacenamiento…",
  "assistant.stage.properties": "Leyendo detalles…",
  "assistant.stage.create": "Creando la carpeta…",
  "assistant.stage.rename": "Renombrando…",
  "assistant.stage.delete": "Eliminando…",
  "assistant.stage.copy": "Copiando archivos…",
  "assistant.stage.move": "Moviendo archivos…",
  "assistant.stage.organize": "Organizando archivos…",
  "assistant.stage.compress": "Comprimiendo…",
  "assistant.stage.extract": "Extrayendo…",
  "assistant.stage.share": "Preparando para compartir…",
  "assistant.stage.sort": "Ordenando archivos…",
  "assistant.stage.filter": "Filtrando archivos…",
  "assistant.stage.default": "El motor de ejecución está procesando tu solicitud…",
  "assistant.stage.searchProgress_one": "Buscando archivos… {count} encontrado",
  "assistant.stage.searchProgress_other": "Buscando archivos… {count} encontrados",
  "assistant.stage.analyzeProgress_one": "Analizando almacenamiento… {count} elemento leído",
  "assistant.stage.analyzeProgress_other": "Analizando almacenamiento… {count} elementos leídos",
  "assistant.stage.batchProgressTotal": "{base} {processed} / {total}…",
  "assistant.stage.batchProgressCount": "{base} {processed}…",

  "assistant.diag.offline":
    "Sin conexión a internet — Genius AI necesita la red para entender tu solicitud.",
  "assistant.diag.network":
    "No se pudo contactar con Genius AI. Comprueba tu conexión a internet y vuelve a intentarlo.",
  "assistant.diag.timeout": "Genius AI está tardando demasiado en responder. Inténtalo de nuevo.",
  "assistant.diag.config":
    "Genius AI no está configurado correctamente en este servidor (servicio de IA no disponible del lado de la app).",
  "assistant.diag.rateLimit":
    "Demasiadas solicitudes seguidas. Espera unos segundos y vuelve a intentarlo.",
  "assistant.diag.credits": "La cuota de uso de la IA está actualmente agotada.",
  "assistant.diag.unavailable":
    "El servicio de IA no está disponible temporalmente. Inténtalo de nuevo en un momento.",
  "assistant.diag.internal":
    "El proceso se interrumpió antes de la respuesta final. Los pasos completados se conservan; vuelve a intentarlo para continuar.",

  "assistant.analysis.title": "Análisis inteligente",
  "assistant.analysis.resumeAria": "Reanudar",
  "assistant.analysis.pauseAria": "Pausar",
  "assistant.analysis.clear": "Borrar",
  "assistant.analysis.progressNamed_one": "Analizando «{name}»… ({count} restante)",
  "assistant.analysis.progressNamed_other": "Analizando «{name}»… ({count} restantes)",
  "assistant.analysis.queued": "Analizando {files} en cola…",
  "assistant.analysis.done_one": "{count} archivo analizado",
  "assistant.analysis.done_other": "{count} archivos analizados",
  "assistant.analysis.statRunning": "{count} en curso",
  "assistant.analysis.statQueued": "{count} en cola",
  "assistant.analysis.statDone": "{count} analizados",
  "assistant.analysis.statSkipped": "{count} ya conocidos",
  "assistant.analysis.statFailed": "{count} con error",
  "assistant.analysis.statPaused": "En pausa",

  // Ajouts génération automatique (i18n complet)
  "assistant.executeReellementUneCommandeSurLe":
    "EJECUTA REALMENTE un comando en el motor de archivos local de GeniusFiles (APIs reales de Android, archivos reales). Este es el único canal permitido para actuar sobre el almacenamiento: listar, buscar, analizar, leer propiedades, crear una carpeta, renombrar, mover, copiar, eliminar, ordenar, comprimir, extraer, compartir, clasificar, filtrar. Llama a esta herramienta inmediatamente en cuanto se dé una orden, sin pedir confirmación, excepto para eliminación permanente o sobrescritura de datos. NUNCA inventes un resultado: solo la salida de esta herramienta refleja el estado real del almacenamiento.",
} as const;
