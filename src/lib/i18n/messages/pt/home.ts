/**
 * Home screen: greeting, storage, categories, tools, recent files and
 * file-manager actions exposed from this screen.
 */
export default {
  "home.greeting.night": "Boa noite",
  "home.greeting.morning": "Bom dia",
  "home.greeting.afternoon": "Boa tarde",
  "home.greeting.evening": "Boa noite",
  "home.subtitle.default": "Gerencie seus arquivos mais rápido.",
  "home.subtitle.pick": "Abra um armazenamento ou uma categoria abaixo para selecionar.",

  "home.title.files": "Arquivos",

  "home.section.categories": "Categorias",
  "home.section.tools": "Ferramentas",

  "home.category.documents": "Documentos",
  "home.category.images": "Imagens",
  "home.category.videos": "Vídeos",
  "home.category.audio": "Música",
  "home.category.downloads": "Downloads",
  "home.category.apps": "Aplicativos",

  "home.tool.cleaner": "Limpeza",
  "home.tool.pdfTools": "Ferramentas de PDF",
  "home.tool.vault": "Cofre",
  "home.tool.imageEditor": "Editor de imagens",
  "home.tool.audioEditor": "Editor de áudio",
  "home.tool.trash": "Lixeira",

  "home.editorPicker.audioTitle": "Escolha um arquivo de áudio para editar",
  "home.editorPicker.imageTitle": "Escolha uma imagem para editar",

  "home.pickHowTo.aria": "Como selecionar",
  "home.pickHowTo.title": "Como selecionar?",
  "home.pickHowTo.step1": "Abra um armazenamento ou uma categoria.",
  "home.pickHowTo.step2Multi": "Toque em cada arquivo para adicioná-lo à sua seleção.",
  "home.pickHowTo.step2Single": "Toque no arquivo que deseja selecionar.",
  "home.pickHowTo.step3": "Toque no ícone para pré-visualizar ou abrir.",
  "home.pickHowTo.step4": "Finalize com “Confirmar”, ou “Cancelar” para voltar.",

  "home.folder.newTitle": "Nova pasta",
  "home.folder.nameLabel": "Nome da pasta",
  "home.folder.createCta": "Criar",
  "home.folder.created": "Pasta criada",
  "home.folder.createFailed": "Não foi possível criar a pasta",

  "home.rename.title": "Renomear",
  "home.rename.nameLabel": "Novo nome",
  "home.rename.cta": "Renomear",
  "home.rename.done": "Renomeado",
  "home.rename.failed": "Não foi possível renomear",

  "home.destination.copyTitle": "Copiar para…",
  "home.destination.moveTitle": "Mover para…",

  "home.transfer.rootLabel": "Raiz do armazenamento",
  "home.transfer.cancelled": "Operação cancelada",
  "home.transfer.cancelledDetail": "{count} {unit}(s) processado(s) antes de cancelar.",
  "home.transfer.copyLabel": "Copiar",
  "home.transfer.moveLabel": "Mover",
  "home.transfer.toLabel": "Para “{dest}”",
  "home.transfer.mixedResult": "{succeeded} com sucesso, {failed} com falha",

  "home.delete.label": "Excluindo",
  "home.delete.subtitle": "Movendo para a lixeira",
  "home.delete.cancelledWithCount": "Exclusão cancelada — {count} {unit} já movido(s)",
  "home.delete.cancelled": "Exclusão cancelada",
  "home.delete.doneSingle": "“{name}” movido para a lixeira",
  "home.delete.doneMultiple": "{count} {unit}s movidos para a lixeira",
  "home.delete.failed": "{count} exclusão(ões) falhou(aram)",

  "home.share.failed": "Não foi possível compartilhar",

  "home.archive.creatingTitle": "Criando o arquivo compactado…",
  "home.archive.creatingSubtitle": "Compactando os itens selecionados",
  "home.archive.cancelled": "Compactação cancelada",
  "home.archive.created": "Arquivo compactado criado",
  "home.archive.createdWithSize": "Arquivo compactado criado · {size}",
  "home.archive.failed": "Não foi possível compactar",

  "home.extract.title": "Extraindo…",
  "home.extract.subtitle": "Extraindo para a pasta atual",
  "home.extract.cancelled": "Extração cancelada",
  "home.extract.done": "Extração concluída ({count})",
  "home.extract.failed": "Não foi possível extrair",

  "home.editor.fileNotFound": "Arquivo não encontrado",
  "home.editor.fileNotFoundDesc": "O local não está mais acessível.",
  "home.editor.fileGone": "“{name}” não está mais disponível",

  "home.recent.aria": "Arquivos recentes",
  "home.recent.title": "Arquivos recentes",
  "home.recent.viewMore": "Ver mais",
  "home.recent.empty": "Novos arquivos adicionados ao seu armazenamento aparecerão aqui.",

  "home.storage.aria": "Armazenamento",
  "home.storage.title": "Armazenamento",
  "home.storage.internal": "Armazenamento interno",
  "home.storage.usb": "Dispositivo USB",
  "home.storage.sd": "Cartão SD",
  "home.storage.readingSpace": "Lendo espaço…",
  "home.storage.usage": "{used} / {total} · {free} livre",
  "home.storage.open": "Abrir {label}",

  "home.scopePicker.label": "Armazenamento",
  "home.scopePicker.all": "Todos",

  "home.confirm.working": "Um momento…",

  "home.exit.title": "Sair do GeniusFiles?",
  "home.exit.description":
    "Todas as tarefas em execução foram concluídas. Você pode reabrir o app a qualquer momento, suas pastas e configurações serão restauradas.",
  "home.exit.confirm": "Sair",

  "home.resume.kind.copy": "cópia",
  "home.resume.kind.move": "movimentação",
  "home.resume.kind.compress": "compactação",
  "home.resume.kind.extract": "extração",
  "home.resume.kind.clean": "limpeza",
  "home.resume.kind.delete": "exclusão",
  "home.resume.title": "Operações a retomar",
  "home.resume.resuming": "Retomando a {kind}…",
  "home.resume.progress": "Interrompido em {pct}% — {done} de {total} processados",
  "home.resume.unknownTotal": "um número desconhecido de itens",
  "home.resume.resume": "Retomar",
  "home.resume.dismiss": "Dispensar",

  "home.states.noResultsDesc": "Tente outra palavra ou altere os filtros.",
  "home.states.errorDesc": "Este conteúdo não pode ser exibido no momento.",

  "home.nav.aria": "Navegação principal",
} as const;
