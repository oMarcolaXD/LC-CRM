export const CURRENT_VERSION = "0.2.0"

export interface ChangelogEntry {
  version: string
  date: string
  roles: ("ADMIN" | "COLLABORATOR" | "TEACHER")[]
  title: string
  items: string[]
}

export const changelog: ChangelogEntry[] = [
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
