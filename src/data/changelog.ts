export const CURRENT_VERSION = "0.3.1"

export interface ChangelogEntry {
  version: string
  date: string
  roles: ("ADMIN" | "COLLABORATOR" | "TEACHER")[]
  title: string
  items: string[]
}

// As entradas de um mesmo lançamento são separadas por público: o modal filtra
// por perfil e usa a versão como chave, então cada público tem a sua versão.
export const changelog: ChangelogEntry[] = [
  {
    version: "0.3.1",
    date: "13/08/2026",
    roles: ["ADMIN", "COLLABORATOR"],
    title: "Recorrência em Grupo, Filtros e Edição de Séries",
    items: [
      "Aula em grupo agora pode ser recorrente — irmãos que estudam juntos entram numa série só, sem marcar semana a semana",
      "A revisão da série mostra o saldo de cada aluno do grupo antes de confirmar, e avisa quem tem menos aulas",
      "Mudar o horário de uma aula ou aulão recorrente de uma vez, em toda a série, em vez de corrigir ocorrência por ocorrência",
      "Busca e filtros na lista de aulões: por título, professor, matéria, tipo e mês",
      "Em “Próximos”, os aulões passam a vir do mais próximo para o mais distante",
      "Ao agendar, dá para escolher a matéria primeiro e ver quais professores lecionam aquela matéria",
      "A quantidade de aulas pode ser escolhida ao agendar direto pela agenda, sem passar pelo perfil do aluno",
      "Compromisso do professor com duração de período todo, do horário de abertura ao de fechamento",
      "Anotação na agenda: recado que aparece para o professor sem bloquear o horário para novas aulas",
    ],
  },
  {
    version: "0.3.0",
    date: "13/08/2026",
    roles: ["ADMIN", "TEACHER"],
    title: "Correções na Agenda do Professor",
    items: [
      "Corrigido: as aulas voltam a aparecer em Minha Agenda — quem teve o e-mail alterado no cadastro via a agenda vazia, mesmo com aulas marcadas",
      "Se o login não estiver vinculado a um cadastro de professor, a agenda agora avisa em vez de aparecer vazia",
      "O e-mail no login deixou de diferenciar maiúsculas de minúsculas",
      "Compromissos e anotações aparecem na agenda com o próprio texto, em vez de “Aluno”",
      "Anotações enviadas pela secretaria aparecem na agenda sem ocupar o horário",
    ],
  },
  {
    version: "0.2.0",
    date: "18/05/2026",
    roles: ["ADMIN", "COLLABORATOR", "TEACHER"],
    title: "Login por Telefone & Novidades do Sistema",
    items: [
      "Login com número de telefone cadastrado, além do e-mail",
      "Cadastro de alunos sem e-mail — útil para importar das fichas manuais",
      "Aviso automático para usuários sem e-mail cadastrado",
      "Nova tela de novidades exibida a cada atualização do sistema",
    ],
  },
  {
    version: "0.1.0",
    date: "01/05/2026",
    roles: ["ADMIN", "COLLABORATOR", "TEACHER"],
    title: "Lançamento Inicial",
    items: [
      "Cadastro e gestão completa de alunos, professores e colaboradores",
      "Módulo financeiro: pacotes de aulas, pagamentos e repasses a professores",
      "Agendamento de aulas presenciais e online (Google Meet / Zoom)",
      "Área do professor: agenda, disponibilidade, materiais e lições de casa",
      "Área do colaborador: gestão de alunos, professores e agendamentos",
      "Notificações em tempo real para eventos do sistema",
      "Segurança: bloqueio automático após tentativas excessivas de login",
    ],
  },
]
