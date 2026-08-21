-- Anotação na agenda: compromisso que aparece para o professor sem ocupar o horário.
--
-- Até aqui, todo COMPROMISSO bloqueava a agenda e disputava sala como uma aula.
-- Quem só queria deixar um lembrete ("ligar para a mãe do João") acabava
-- inutilizando um horário livre. Com o campo abaixo, o compromisso pode nascer
-- como bloqueio (padrão, comportamento atual) ou como simples nota.
--
-- O default true preserva o significado de todo registro já existente.

ALTER TABLE "lessons" ADD COLUMN "blocksAgenda" BOOLEAN NOT NULL DEFAULT true;
