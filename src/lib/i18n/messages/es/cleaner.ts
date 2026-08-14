/**
 * "cleaner" domain (Spanish): Smart Cleaner and Trash.
 */
export default {
  "cleaner.title": "Limpiador",
  "cleaner.subtitle": "Análisis local · nada se elimina sin tu aprobación",
  "cleaner.refresh.aria": "Reiniciar el análisis",

  "cleaner.stats.reclaimable": "Espacio recuperable",
  "cleaner.stats.scanning": "Analizando…",
  "cleaner.stats.ready": "Listo",
  "cleaner.stats.proposed_one": "{count} elemento propuesto",
  "cleaner.stats.proposed_other": "{count} elementos propuestos",
  "cleaner.stats.foldersRead": "carpetas leídas",
  "cleaner.stats.filesRead": "archivos leídos",

  "cleaner.phase.starting": "Preparando el análisis…",
  "cleaner.phase.walking": "Leyendo el almacenamiento…",
  "cleaner.phase.matching": "Comparando duplicados…",
  "cleaner.phase.done": "Análisis completado",

  "cleaner.permission.denied":
    "Aún no se ha concedido el acceso completo a los archivos. Algunas categorías quedan incompletas hasta que se otorgue el permiso.",

  "cleaner.issues.count_one": "{count} ubicación no se pudo leer",
  "cleaner.issues.count_other": "{count} ubicaciones no se pudieron leer",

  "cleaner.categories.title": "Categorías",
  "cleaner.categories.hint": "Revisa antes de actuar",

  "cleaner.empty.title": "No hay nada que limpiar ahora mismo",
  "cleaner.empty.description":
    "No se encontró ningún duplicado, caché o archivo sin uso en esta ubicación. Reinicia el análisis después de añadir archivos, o cambia a otra ubicación.",

  "cleaner.category.count_one": "{count} elemento",
  "cleaner.category.count_other": "{count} elementos",
  "cleaner.category.safe": "sin riesgo conocido",
  "cleaner.category.review": "para revisar",
  "cleaner.category.toFree": "para liberar",

  "cleaner.category.duplicates.label": "Duplicados",
  "cleaner.category.duplicates.description":
    "Archivos de tamaño idéntico encontrados en varios lugares. Siempre se conserva la copia más antigua; solo se proponen las copias extra.",
  "cleaner.category.large.label": "Archivos grandes",
  "cleaner.category.large.description":
    "Archivos de más de {sizeMb} MB. Nada se supone inútil: ábrelos antes de decidir.",
  "cleaner.category.old_downloads.label": "Descargas antiguas",
  "cleaner.category.old_downloads.description":
    'Archivos en la carpeta "Descargas" sin cambios desde hace más de {days} días. Un archivo antiguo no es necesariamente inútil.',
  "cleaner.category.empty_folders.label": "Carpetas vacías",
  "cleaner.category.empty_folders.description":
    "Carpetas que no contienen absolutamente nada, ni siquiera archivos ocultos. Las carpetas estándar de Android se preservan.",
  "cleaner.category.temp.label": "Archivos temporales",
  "cleaner.category.temp.description":
    "Archivos de trabajo ubicados en una carpeta de caché confirmada, o descargas interrumpidas, sin tocar desde hace varios días.",
  "cleaner.category.extracted_archives.label": "Archivos ya extraídos",
  "cleaner.category.extracted_archives.description":
    "Archivos comprimidos con una carpeta del mismo nombre junto a ellos que ya contiene archivos: el archivo comprimido es redundante.",
  "cleaner.category.apk.label": "Instaladores APK",
  "cleaner.category.apk.description":
    "Archivos APK con más de {days} días. La app probablemente ya está instalada, pero el instalador sigue siendo utilizable sin conexión.",
  "cleaner.category.messaging_media.label": "Multimedia de mensajería",
  "cleaner.category.messaging_media.description":
    "Fotos, vídeos y audios recibidos a través de una app de mensajería. Estos archivos pueden tener valor personal: revísalos uno por uno.",

  "cleaner.reason.emptyFolder": "Nada dentro, ni siquiera archivos ocultos",
  "cleaner.reason.cacheUnused": "Archivo de caché sin uso desde hace {days} días",
  "cleaner.reason.interruptedDownload": "Descarga interrumpida (.{ext}), {days} días",
  "cleaner.reason.editorBackup": "Copia de seguridad automática del editor",
  "cleaner.reason.extractedArchive": 'Carpeta "{name}" extraída al lado',
  "cleaner.reason.apkKept": "Instalador conservado desde hace {days} días",
  "cleaner.reason.messagingMedia": "Contenido recibido a través de una app de mensajería",
  "cleaner.reason.oldDownload": "Sin cambios desde hace {days} días",
  "cleaner.reason.largeFile": "Ocupa {sizeMb} MB",
  "cleaner.reason.duplicateKeeper": "Copia conservada (la más antigua)",
  "cleaner.reason.duplicateContent": "Contenido idéntico a la copia conservada",
  "cleaner.reason.duplicateSizeName": "Mismo tamaño y nombre que la copia conservada",
  "cleaner.issue.unreadable": "Ubicación ilegible (permiso o volumen no disponible)",

  "cleaner.selection.count_one": "{count} elemento seleccionado",
  "cleaner.selection.count_other": "{count} elementos seleccionados",
  "cleaner.selection.toFree": "{amount} a liberar · papelera, recuperable",
  "cleaner.selection.deselect": "Deseleccionar",
  "cleaner.selection.clean": "Limpiar · {amount}",

  "cleaner.progress.title": "Limpiando…",
  "cleaner.progress.preparing": "Preparando la limpieza…",
  "cleaner.progress.preparingShort": "Preparando…",
  "cleaner.progress.processed_one": "{count} elemento de {total}",
  "cleaner.progress.processed_other": "{count} elementos de {total}",

  "cleaner.confirm.clean.title": "¿Iniciar la limpieza?",
  "cleaner.confirm.clean.desc_one":
    "Se eliminará {count} elemento y se liberará aproximadamente {freed}. Solo se ven afectados los elementos marcados.",
  "cleaner.confirm.clean.desc_other":
    "Se eliminarán {count} elementos y se liberará aproximadamente {freed}. Solo se ven afectados los elementos marcados.",
  "cleaner.confirm.clean.confirm": "Limpiar",

  "cleaner.toast.partial.title": "Limpieza parcial",
  "cleaner.toast.partial.desc": "{removed} movidos a la papelera, {failed} con error. {detail}",
  "cleaner.toast.nothing.title": "No se eliminó nada",
  "cleaner.toast.nothing.missing": "{missing} ya habían desaparecido del almacenamiento.",
  "cleaner.toast.nothing.none": "No se pudo procesar ningún elemento.",
  "cleaner.toast.done.title": "Limpieza completada",
  "cleaner.toast.done.desc":
    "{freed} liberados — {removed} movidos a la papelera. Puedes restaurarlos hasta que se vacíe.",
  "cleaner.toast.failed.title": "La limpieza falló",
  "cleaner.toast.failed.desc": "Ocurrió un problema durante la limpieza.",

  "cleaner.sheet.title.fallback": "Categoría",
  "cleaner.sheet.noData": "Sin datos.",
  "cleaner.sheet.lockedAria": "Copia conservada, no se puede eliminar",
  "cleaner.sheet.selectAria": "Seleccionar {name}",
  "cleaner.sheet.previewAria": "Vista previa de {name}",
  "cleaner.sheet.safe":
    "Sin riesgo conocido. Los elementos se mueven a la papelera y siguen siendo recuperables.",
  "cleaner.sheet.review":
    "Revísalos uno por uno: toca una miniatura para abrir el archivo antes de seleccionarlo.",
  "cleaner.sheet.proposed_one": "{count} propuesto",
  "cleaner.sheet.proposed_other": "{count} propuestos",
  "cleaner.sheet.recoverable": "{amount} recuperables",
  "cleaner.sheet.emptyCategory": "Nada propuesto en esta categoría.",
  "cleaner.sheet.group": "Grupo de {count} copias",

  "cleaner.evidence.content": "Contenido comparado",
  "cleaner.evidence.sizeName": "Mismo tamaño y nombre",
  "cleaner.evidence.location": "Ubicación y antigüedad",
  "cleaner.evidence.measured": "Medición directa",

  "cleaner.trash.title": "Papelera",
  "cleaner.trash.selectHint": "Toca un elemento para añadirlo o quitarlo de la selección",
  "cleaner.trash.noItems": "Sin elementos",
  "cleaner.trash.summary_one": "{count} elemento · {size}",
  "cleaner.trash.summary_other": "{count} elementos · {size}",
  "cleaner.trash.search.aria": "Buscar en la papelera",
  "cleaner.trash.moreActions.aria": "Más acciones",
  "cleaner.trash.sortBy": "Ordenar por",
  "cleaner.trash.sort.recent": "Eliminados recientemente",
  "cleaner.trash.sort.name": "Nombre (A → Z)",
  "cleaner.trash.sort.size": "Tamaño (mayor primero)",
  "cleaner.trash.emptyAction": "Vaciar por completo",
  "cleaner.trash.searchPlaceholder": "Buscar un elemento eliminado…",
  "cleaner.trash.clearSearch.aria": "Borrar búsqueda",
  "cleaner.trash.emptyState.searchDesc": "Ningún elemento eliminado coincide con esta búsqueda.",
  "cleaner.trash.emptyState.desc":
    "Los archivos eliminados desde GeniusFiles aparecerán aquí, listos para previsualizar y restaurar.",
  "cleaner.trash.sortedCount_one": "{count} mostrado",
  "cleaner.trash.sortedCount_other": "{count} mostrados",
  "cleaner.trash.orphanBadge": "Sin ubicación",
  "cleaner.trash.countdown.permanent": "Conservado permanentemente",
  "cleaner.trash.countdown.imminent": "A punto de eliminarse",
  "cleaner.trash.countdown.days_one": "{count} día restante",
  "cleaner.trash.countdown.days_other": "{count} días restantes",
  "cleaner.trash.countdown.hours": "{count} h restantes",
  "cleaner.trash.item.deselectAria": "Quitar de la selección",
  "cleaner.trash.item.previewAria": "Vista previa de {name}",

  "cleaner.trash.preview.unavailable.title": "Vista previa no disponible",
  "cleaner.trash.preview.unavailable.folder": "Restaura la carpeta para explorar su contenido.",
  "cleaner.trash.preview.unavailable.file": "Este archivo solo se puede leer una vez restaurado.",

  "cleaner.trash.restore.success_one": "Elemento restaurado",
  "cleaner.trash.restore.success_other": "{count} elementos restaurados",
  "cleaner.trash.restore.partial": "{restored} restaurados, {failed} con error",

  "cleaner.trash.purge.success_one": "Elemento eliminado",
  "cleaner.trash.purge.success_other": "{count} elementos eliminados",
  "cleaner.trash.purge.desc": "Eliminados definitivamente · {freed} liberados.",
  "cleaner.trash.purge.partial": "{deleted} eliminados, {failed} con error",

  "cleaner.trash.emptied.title": "Papelera vaciada",
  "cleaner.trash.emptied.desc_one":
    "{count} elemento eliminado definitivamente · {freed} liberados.",
  "cleaner.trash.emptied.desc_other":
    "{count} elementos eliminados definitivamente · {freed} liberados.",

  "cleaner.trash.destPicker.title": "Elige una ubicación de restauración",
  "cleaner.trash.restoreOutcome.title": "Restauración completada",
  "cleaner.trash.restoreOutcome.summary": "{restored} restaurados, {failed} con error.",
  "cleaner.trash.restoreOutcome.reason.parentMissing": "Ubicación no encontrada",
  "cleaner.trash.restoreOutcome.reason.missing": "No encontrado",
  "cleaner.trash.restoreOutcome.reason.noTarget": "Destino desconocido",
  "cleaner.trash.restoreOutcome.reason.failed": "Fallido",

  "cleaner.trash.actionUnavailable.title": "Acción no disponible desde la papelera",
  "cleaner.trash.actionUnavailable.desc": "Restaura el elemento para editarlo.",

  "cleaner.trash.confirm.empty.title": "¿Vaciar la papelera?",
  "cleaner.trash.confirm.empty.desc_one":
    "Se eliminará {count} elemento definitivamente de tu dispositivo. Esta acción no se puede deshacer.",
  "cleaner.trash.confirm.empty.desc_other":
    "Se eliminarán {count} elementos definitivamente de tu dispositivo. Esta acción no se puede deshacer.",
  "cleaner.trash.confirm.empty.confirm": "Vaciar papelera",

  "cleaner.trash.confirm.purge.title_one": "¿Eliminar definitivamente {count} elemento?",
  "cleaner.trash.confirm.purge.title_other": "¿Eliminar definitivamente {count} elementos?",
  "cleaner.trash.confirm.purge.desc":
    "Esta eliminación es permanente: los elementos ya no se podrán recuperar.",

  "cleaner.trash.confirm.restore.title_one": "¿Restaurar {count} elemento?",
  "cleaner.trash.confirm.restore.title_other": "¿Restaurar {count} elementos?",
  "cleaner.trash.confirm.restore.desc":
    "Los elementos se colocarán de nuevo en su carpeta original. Si ya existe un archivo con el mismo nombre, GeniusFiles ofrecerá renombrarlo.",
} as const;
