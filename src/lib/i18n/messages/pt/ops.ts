/**
 * Files services and engines (operations, trash, transfers, archives,
 * selection, recommendations, jobs). User-facing messages only —
 * technical identifiers and logs are excluded.
 */
export default {
  // Generic storage operation errors.
  "ops.error.invalidName": "Nome inválido",
  "ops.error.pluginUnavailable": "Recurso indisponível",
  "ops.error.createFailed": "Não foi possível criar",
  "ops.error.renameFailed": "Não foi possível renomear",
  "ops.error.nameExists": "Este nome já existe",
  "ops.error.deleteFailed": "Não foi possível excluir",
  "ops.error.copyFailed": "Não foi possível copiar",
  "ops.error.accessDenied": "Acesso ao armazenamento negado",
  "ops.error.notFound": "Item não encontrado (já movido ou excluído)",
  "ops.error.notADirectory": "Pasta de destino inválida",
  "ops.error.noSpace": "Espaço de armazenamento insuficiente",
  "ops.error.unsupported": "Operação não suportada neste armazenamento",
  "ops.error.storageUnavailable": "Armazenamento indisponível",
  "ops.error.destinationMissing": "Destino não encontrado",
  "ops.error.alreadyExists": "Já existe",
  "ops.error.alreadyExistsAtDestination": "Já existe no destino",
  "ops.error.moveUnconfirmed": "Movimentação não confirmada pelo armazenamento",
  "ops.error.copyUnconfirmedSourceKept": "Cópia não confirmada — origem mantida",
  "ops.error.transferUnconfirmed": "Transferência não confirmada pelo armazenamento",
  "ops.error.itemInaccessible": "Item inacessível ou bloqueado",
  "ops.error.deleteFailedStillPresent": "Não foi possível excluir — item ainda presente",
  "ops.error.shareNoFiles":
    "Selecione pelo menos um arquivo (pastas não podem ser compartilhadas).",
  "ops.error.shareFailed": "Não foi possível compartilhar",
  "ops.error.parentMissing": "Pasta pai não encontrada",
  "ops.error.parentMissingParams": "Pasta pai ausente",
  "ops.error.emptyName": "Nome vazio",
  "ops.error.nameForbiddenChars": "O nome não pode conter “/” ou “\\”",
  "ops.error.foldersOnly": "Apenas pastas são suportadas",
  "ops.error.noItemsToDelete": "Nenhum item para excluir",
  "ops.error.noItemsToProcess": "Nenhum item para processar",
  "ops.error.sourceAndDestinationRequired": "Origem e destino obrigatórios",
  "ops.error.pathMissing": "Caminho ausente",
  "ops.error.accessDeniedRead": "Acesso negado",
  "ops.error.locationUnavailable": "Local indisponível",
  "ops.error.readFailed": "Não foi possível ler",
  "ops.error.noLocationToAnalyze": "Nenhum local para analisar",
  "ops.error.noLocationToSearch": "Nenhum local para pesquisar",
  "ops.error.noFileToShare": "Nenhum arquivo para compartilhar",
  "ops.error.missingEntryList": "Lista de entradas ausente",
  "ops.error.unknownCommand": "Comando desconhecido: {type}",
  "ops.error.commandCancelledBeforeRun": "Comando cancelado antes da execução",
  "ops.error.batchInterrupted": "Lote interrompido",
  "ops.error.deleteCancelled": "Exclusão cancelada",
  "ops.error.transferCancelled": "Operação cancelada",
  "ops.error.transferFailed": "Não foi possível transferir",
  "ops.error.organizeCancelled": "Organização cancelada",
  "ops.error.organizeFolderReadFailed": "Não foi possível ler a pasta a organizar",
  "ops.error.unknownRule": "Regra desconhecida",
  "ops.error.folderMissing": "Pasta ausente",

  // Archives.
  "ops.error.archiveFormatUnsupportedRead": "Formato não suportado para leitura",
  "ops.error.archiveFormatUnsupported": "Formato não suportado",
  "ops.error.archiveReadFailed": "Não foi possível ler",
  "ops.error.archiveNameExists": "Já existe um arquivo compactado com este nome",
  "ops.error.archiveNameMissing": "Nome do arquivo compactado ausente",
  "ops.error.noItemsToCompress": "Nenhum item para compactar",
  "ops.error.extractParamsIncomplete": "Configurações de extração incompletas",
  "ops.error.compressCancelled": "Compactação cancelada",
  "ops.error.compressFailed": "Não foi possível compactar",
  "ops.error.extractCancelled": "Extração cancelada",
  "ops.error.extractFailed": "Não foi possível extrair",
  "ops.archive.createSummary": "Arquivo compactado “{name}” criado ({count} item(ns))",
  "ops.archive.extractSummary": "“{name}” extraído ({count} item(ns))",

  // Create / rename.
  "ops.mkdir.summary": "Nova pasta “{name}”",
  "ops.rename.summary": "“{from}” renomeado para “{to}”",

  // Delete / trash.
  "ops.delete.summary_one": "“{name}” movido para a Lixeira",
  "ops.delete.summary_other": "{count} itens movidos para a Lixeira",
  "ops.trash.restoreSummary_one": "“{name}” restaurado",
  "ops.trash.restoreSummary_other": "{count} itens restaurados da Lixeira",
  "ops.trash.permanentDeleteSummary_one": "“{name}” excluído permanentemente",
  "ops.trash.permanentDeleteSummary_other": "{count} itens excluídos permanentemente",
  "ops.trash.emptiedSummary": "Lixeira esvaziada ({count})",

  // Copy / move.
  "ops.transfer.copySummary_one": "“{name}” copiado",
  "ops.transfer.copySummary_other": "{count} itens copiados",
  "ops.transfer.moveSummary_one": "“{name}” movido",
  "ops.transfer.moveSummary_other": "{count} itens movidos",
  "ops.transfer.copyDone": "Cópia concluída",
  "ops.transfer.moveDone": "Movimentação concluída",
  "ops.transfer.copyCancelled": "Cópia cancelada",
  "ops.transfer.moveCancelled": "Movimentação cancelada",
  "ops.transfer.copyIncomplete": "Cópia incompleta",
  "ops.transfer.moveIncomplete": "Movimentação incompleta",
  "ops.transfer.summary": "{count} item(ns) {verb}",
  "ops.transfer.verbCopied": "copiado(s)",
  "ops.transfer.verbMoved": "movido(s)",
  "ops.transfer.failuresCount": "{count} falha(s)",
  "ops.transfer.duration": "em {time}",

  // Sharing.
  "ops.share.summary_one": "Compartilhando “{name}”",
  "ops.share.summary_other": "Compartilhando {count} arquivos",

  // Pick session.
  "ops.pick.selectFolders": "Selecione suas pastas",
  "ops.pick.selectFolder": "Selecione uma pasta",
  "ops.pick.selectItems": "Selecione seus itens",
  "ops.pick.selectItem": "Selecione um item",
  "ops.pick.selectFiles": "Selecione seus arquivos",
  "ops.pick.selectFile": "Selecione um arquivo",

  // Selection "More" menu.
  "ops.selection.moveToVault": "Mover para pasta segura",
  "ops.selection.openAs": "Abrir como",
  "ops.selection.properties": "Propriedades",
  "ops.selection.cut": "Recortar",
  "ops.selection.pin": "Fixar no topo",
  "ops.selection.unpin": "Desafixar do topo",
  "ops.selection.hide": "Ocultar",
  "ops.selection.addToHome": "Adicionar à tela inicial",
  "ops.selection.exit": "Sair da seleção",
  "ops.selection.range": "Intervalo",
  "ops.selection.ariaLabel": "Ações de seleção",

  // Categories.
  "ops.categories.images": "Imagens",
  "ops.categories.videos": "Vídeos",
  "ops.categories.audio": "Música",
  "ops.categories.documents": "Documentos",
  "ops.categories.downloads": "Downloads",
  "ops.categories.archives": "Arquivos compactados",
  "ops.categories.code": "Código",
  "ops.categories.apk": "Aplicativos",
  "ops.categories.fonts": "Fontes",
  "ops.categories.other": "Outros",

  // Dashboard recommendations.
  "ops.recommendations.storageCritical.title": "Armazenamento quase cheio",
  "ops.recommendations.storageCritical.desc":
    "Apenas {free} livre de {total}. Libere espaço para manter seu telefone funcionando bem.",
  "ops.recommendations.storageCritical.cta": "Liberar espaço",
  "ops.recommendations.storageWarn.title": "Armazenamento ficando cheio",
  "ops.recommendations.storageWarn.desc":
    "{percent}% do armazenamento está em uso. Recomenda-se uma limpeza preventiva.",
  "ops.recommendations.storageWarn.cta": "Analisar",
  "ops.recommendations.trendDown.title": "Espaço livre diminuindo",
  "ops.recommendations.trendDown.desc":
    "Você usou cerca de {size} nos últimos dias. Verifique o que está ocupando espaço.",
  "ops.recommendations.trendDown.cta": "Ver detalhamento",
  "ops.recommendations.apk.title_one": "{count} arquivo de instalação (APK)",
  "ops.recommendations.apk.title_other": "{count} arquivos de instalação (APK)",
  "ops.recommendations.apk.desc":
    "{size} usados por arquivos APK. Remova os que não precisa mais após instalar.",
  "ops.recommendations.apk.cta": "Abrir",
  "ops.recommendations.archive.title": "Arquivos compactados grandes",
  "ops.recommendations.archive.desc":
    "{size} de arquivos compactados detectados. Extraia os que precisa e exclua o resto.",
  "ops.recommendations.video.title": "Vídeos grandes",
  "ops.recommendations.video.desc":
    "Seus vídeos ocupam {size}. Considere mover os mais antigos para um cartão SD ou drive externo para liberar espaço.",
  "ops.recommendations.trashLarge.title": "A lixeira está ocupando espaço",
  "ops.recommendations.trashLarge.desc_one":
    "{size} estão na Lixeira ({count} item). Esvazie-a para recuperar esse espaço imediatamente.",
  "ops.recommendations.trashLarge.desc_other":
    "{size} estão na Lixeira ({count} itens). Esvazie-a para recuperar esse espaço imediatamente.",
  "ops.recommendations.trashLarge.cta": "Abrir Lixeira",
  "ops.recommendations.allGood.title": "Tudo parece bem",
  "ops.recommendations.allGood.desc":
    "Nenhuma ação prioritária detectada. O painel avisará assim que uma otimização valer a pena.",

  // Long-running jobs (journal + notifications).
  "ops.jobs.copy": "Copiando",
  "ops.jobs.move": "Movendo",
  "ops.jobs.compress": "Compactando",
  "ops.jobs.extract": "Extraindo",
  "ops.jobs.clean": "Limpando",
  "ops.jobs.delete": "Excluindo",
  "ops.jobs.remaining": "{time} restante(s)",
  "ops.jobs.itemsProcessed": "{count} item(ns) processado(s)",
  "ops.jobs.failuresCount": "{count} falha(s)",
  "ops.time.seconds": "{count}s",
  "ops.time.minutes": "{count} min",
  "ops.time.hoursMinutes": "{hours}h {minutes}min",

  // Progress dialog.
  "ops.progress.hide": "Ocultar",
  "ops.progress.cancel": "Cancelar",
  "ops.progress.cancelling": "Cancelando…",
  "ops.progress.phase.cancelling": "Cancelando…",
  "ops.progress.phase.preparing": "Preparando…",
  "ops.progress.phase.finalizing": "Finalizando…",
  "ops.progress.phase.running": "Em andamento",
  "ops.progress.analyzing": "Analisando itens selecionados…",
  "ops.progress.items": "{count}/{total} itens",
  "ops.progress.remaining": "~{time} restante",
  "ops.progress.hideHint":
    "Ocultar não interrompe nada: a transferência continua em segundo plano, mesmo se você sair do GeniusFiles.",
} as const;
