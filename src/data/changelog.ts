export const CURRENT_VERSION = "0.4.0"

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
    version: "0.4.0",
    date: "14/08/2026",
    roles: ["ADMIN"],
    title: "Relatórios Financeiros Completos",
    items: [
      "Relatórios agora tem sete abas e um filtro de período no topo — este mês, mês anterior, 3, 6 ou 12 meses, o ano, ou um intervalo escolhido no calendário. O período escolhido vale para todas as abas",
      "Lucro e margem de verdade: o que entrou, menos as taxas da maquininha, menos o repasse dos professores, menos as despesas da empresa. Cada número vem comparado com o período anterior",
      "Nova tela de Despesas em Financeiro: aluguel, marketing, software, impostos, salários da equipe. Lançamento único ou repetido todo mês, com mês de competência separado da data de pagamento",
      "DRE mês a mês, do faturamento bruto até o resultado, com cada categoria de despesa detalhada em sua linha",
      "Ponto de equilíbrio: quantas horas de aula por mês são necessárias só para pagar a estrutura, e quanto falta (ou sobra) para chegar lá",
      "Fluxo de caixa com projeção de 90 dias, semana a semana, avisando em qual semana o saldo fica negativo",
      "Cobrança: envelhecimento das dívidas por faixa (1–15, 16–30, 31–60 e mais de 60 dias), ranking de devedores com telefone e responsável, e a taxa de recuperação de quem paga atrasado",
      "Corrigido: cobrança vencida e não paga agora conta como inadimplência mesmo sem ninguém marcar “vencido” à mão. Antes o total aparecia como zero",
      "Corrigido: o resumo do Financeiro mostrava R$ 0,00 de receita no mês corrente. Ele lia só as 100 cobranças mais antigas; agora soma todas",
      "Alunos: entradas e saídas por mês, quantos pararam de estudar, ticket médio, quanto cada aluno rende ao longo do tempo, taxa de recompra de pacote e mapa de coortes",
      "Professores: custo, receita e margem de cada um, além de cancelamentos, faltas, nota média e o mapa de horários de pico por dia da semana",
      "Passivo de aulas: quanto do dinheiro já recebido ainda é aula a entregar — o número que separa um mês de boas vendas de um mês de bom resultado",
      "Todo relatório baixa em CSV (abre direto no Excel, com acento e colunas certas) e imprime em PDF pelo navegador",
    ],
  },
  {
    version: "0.4.0",
    date: "14/08/2026",
    roles: ["ADMIN", "COLLABORATOR"],
    title: "Agenda pelo Movimento do Dia",
    items: [
      "As colunas dos professores com aula marcada no dia vêm primeiro — antes quem tinha o dia cheio ficava escondido atrás da rolagem, e quem não tinha nada abria a agenda",
      "Entre os ocupados, quem tem mais aulas aparece antes; empatou, vem quem começa mais cedo",
      "Entre os livres, continua valendo a maior janela de disponibilidade",
      "Quem só tem um recado ou compromisso no dia mostra “1 compromisso” em vez do enganoso “1 aula”",
      "Removido o aviso diário de “WhatsApp não configurado” — o envio é feito à mão pelo botão de cada aluno, então não era um problema a resolver",
    ],
  },
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
