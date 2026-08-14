/**
 * Genius AI — assistant screen, conversations drawer, execution pipeline
 * and related diagnostics messages.
 */
export default {
  "assistant.header.menuLabel": "Abrir o menu de conversas",
  "assistant.header.title": "Genius AI",
  "assistant.header.newChat": "Nova conversa",

  "assistant.input.placeholder": "Escreva o seu pedido…",
  "assistant.input.ariaLabel": "Mensagem",
  "assistant.input.stop": "Parar a resposta",
  "assistant.input.send": "Enviar",

  "assistant.error.title": "O Genius AI não conseguiu carregar",
  "assistant.error.desc":
    "Uma conversa guardada parece estar ilegível. Pode tentar novamente ou começar uma nova conversa.",

  "assistant.welcome.title": "Bem-vindo ao Genius AI",
  "assistant.welcome.desc":
    "Converse naturalmente com o seu assistente e faça a gestão dos seus ficheiros através de uma simples conversa.",
  "assistant.welcome.privacyTitle": "Privacidade garantida",
  "assistant.welcome.privacy1": "Os seus ficheiros permanecem exclusivamente no seu dispositivo.",
  "assistant.welcome.privacy2":
    "O Genius AI nunca acede diretamente ao seu armazenamento. Ele apenas compreende o seu pedido e transmite-o ao motor de execução local do GeniusFiles, que realiza as ações solicitadas.",
  "assistant.welcome.privacy3":
    "Nenhum ficheiro é alguma vez enviado para um servidor ou uma IA externa.",

  "assistant.message.copied": "Copiado",
  "assistant.message.copy": "Copiar",
  "assistant.message.copyAria": "Copiar a mensagem",
  "assistant.message.copiedAria": "Mensagem copiada",

  "assistant.templates.ariaLabel": "Sugestões",
  "assistant.templates.classifyPhotos": "Organizar todas as fotos por ano e depois por mês.",
  "assistant.templates.moveLargeVideos":
    "Mover todos os vídeos com mais de 500 MB para uma pasta Vídeos grandes.",
  "assistant.templates.findRecentPdfs": "Encontrar todos os PDF modificados nos últimos 30 dias.",
  "assistant.templates.biggestFolders":
    "Mostrar quais as pastas que ocupam mais espaço no armazenamento interno.",
  "assistant.templates.weekVideos": "Encontrar todos os vídeos gravados esta semana.",
  "assistant.templates.sortDownloads": "Organizar a pasta Transferências por tipo de ficheiro.",
  "assistant.templates.renamePhotosByDate": "Renomear todas as imagens usando a data de captura.",
  "assistant.templates.archiveWorkDocs":
    "Mover todos os documentos de trabalho para uma pasta Arquivo.",
  "assistant.templates.findUnusedFiles": "Encontrar ficheiros não utilizados há mais de dois anos.",
  "assistant.templates.analyzeStorage":
    "Analisar todo o meu armazenamento e explicar o que ocupa mais espaço.",
  "assistant.templates.listShortAudio":
    "Listar todos os ficheiros áudio com menos de dois minutos.",
  "assistant.templates.todayScreenshots": "Encontrar todas as capturas de ecrã tiradas hoje.",
  "assistant.templates.compressDocuments": "Comprimir a pasta Documentos num arquivo ZIP.",
  "assistant.templates.countPdfs": "Quantos ficheiros PDF tenho no telemóvel?",

  "assistant.drawer.ariaLabel": "Menu do Genius AI",
  "assistant.drawer.closeAria": "Fechar o menu",
  "assistant.drawer.title": "Conversas",
  "assistant.drawer.newChat": "Nova conversa",
  "assistant.drawer.searchPlaceholder": "Pesquisar uma conversa…",
  "assistant.drawer.searchAria": "Pesquisar uma conversa",
  "assistant.drawer.emptySearch": "Nenhuma conversa corresponde a esta pesquisa.",
  "assistant.drawer.emptyAll": "Ainda não há conversas. Escreva ao Genius AI para começar uma.",
  "assistant.drawer.today": "Hoje",
  "assistant.drawer.yesterday": "Ontem",
  "assistant.drawer.last7": "Últimos 7 dias",
  "assistant.drawer.last30": "Últimos 30 dias",
  "assistant.drawer.older": "Mais antigas",
  "assistant.drawer.renameAria": "Renomear {title}",
  "assistant.drawer.deleteAria": "Eliminar {title}",
  "assistant.drawer.renameLabel": "Novo nome",
  "assistant.drawer.defaultTitle": "Nova conversa",

  "assistant.pipeline.ariaLabel": "Genius AI: {label}",
  "assistant.pipeline.understand": "A compreender",
  "assistant.pipeline.plan": "Análise",
  "assistant.pipeline.execute": "Execução",
  "assistant.pipeline.verify": "Verificação",
  "assistant.pipeline.respond": "A escrever a resposta",

  "assistant.stage.list_storage_roots": "A ler localizações…",
  "assistant.stage.list": "A ler as suas pastas…",
  "assistant.stage.search": "A pesquisar ficheiros…",
  "assistant.stage.analyze": "A analisar o armazenamento…",
  "assistant.stage.properties": "A ler detalhes…",
  "assistant.stage.create": "A criar a pasta…",
  "assistant.stage.rename": "A renomear…",
  "assistant.stage.delete": "A eliminar…",
  "assistant.stage.copy": "A copiar ficheiros…",
  "assistant.stage.move": "A mover ficheiros…",
  "assistant.stage.organize": "A organizar ficheiros…",
  "assistant.stage.compress": "A comprimir…",
  "assistant.stage.extract": "A extrair…",
  "assistant.stage.share": "A preparar a partilha…",
  "assistant.stage.sort": "A ordenar ficheiros…",
  "assistant.stage.filter": "A filtrar ficheiros…",
  "assistant.stage.default": "O motor de execução está a processar o seu pedido…",
  "assistant.stage.searchProgress_one": "A pesquisar ficheiros… {count} encontrado",
  "assistant.stage.searchProgress_other": "A pesquisar ficheiros… {count} encontrados",
  "assistant.stage.analyzeProgress_one": "A analisar o armazenamento… {count} item lido",
  "assistant.stage.analyzeProgress_other": "A analisar o armazenamento… {count} itens lidos",
  "assistant.stage.batchProgressTotal": "{base} {processed} / {total}…",
  "assistant.stage.batchProgressCount": "{base} {processed}…",

  "assistant.diag.offline":
    "Sem ligação à Internet — o Genius AI precisa da rede para compreender o seu pedido.",
  "assistant.diag.network":
    "Não foi possível contactar o Genius AI. Verifique a sua ligação à Internet e tente novamente.",
  "assistant.diag.timeout": "O Genius AI está a demorar demasiado a responder. Tente novamente.",
  "assistant.diag.config":
    "O Genius AI não está corretamente configurado neste servidor (serviço de IA indisponível do lado da app).",
  "assistant.diag.rateLimit":
    "Demasiados pedidos enviados seguidos. Aguarde alguns segundos e tente novamente.",
  "assistant.diag.credits": "A quota de utilização de IA está atualmente esgotada.",
  "assistant.diag.unavailable":
    "O serviço de IA está temporariamente indisponível. Tente novamente daqui a pouco.",
  "assistant.diag.internal":
    "O processamento foi interrompido antes da resposta final. As etapas concluídas são mantidas — tente novamente para retomar.",

  "assistant.analysis.title": "Análise inteligente",
  "assistant.analysis.resumeAria": "Retomar",
  "assistant.analysis.pauseAria": "Pausar",
  "assistant.analysis.clear": "Limpar",
  "assistant.analysis.progressNamed_one": "A analisar “{name}”… ({count} restante)",
  "assistant.analysis.progressNamed_other": "A analisar “{name}”… ({count} restantes)",
  "assistant.analysis.queued": "A analisar {files} na fila…",
  "assistant.analysis.done_one": "{count} ficheiro analisado",
  "assistant.analysis.done_other": "{count} ficheiros analisados",
  "assistant.analysis.statRunning": "{count} em curso",
  "assistant.analysis.statQueued": "{count} em fila",
  "assistant.analysis.statDone": "{count} analisados",
  "assistant.analysis.statSkipped": "{count} já conhecidos",
  "assistant.analysis.statFailed": "{count} falharam",
  "assistant.analysis.statPaused": "Em pausa",

  // Ajouts génération automatique (i18n complet)
  "assistant.executeReellementUneCommandeSurLe":
    "Executa REALMENTE um comando no motor de ficheiros local do GeniusFiles (APIs Android reais, ficheiros reais). Este é o único canal permitido para agir sobre o armazenamento: listar, pesquisar, analisar, ler propriedades, criar uma pasta, renomear, mover, copiar, eliminar, organizar, comprimir, extrair, partilhar, ordenar, filtrar. Chame esta ferramenta imediatamente assim que uma ordem é dada, sem pedir confirmação — exceto para eliminação permanente ou substituição de dados. NUNCA invente um resultado: apenas o resultado desta ferramenta reflete o estado real do armazenamento.",
} as const;
