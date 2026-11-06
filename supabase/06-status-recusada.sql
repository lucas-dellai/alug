-- Permite o status "Recusada" nas solicitações.
-- Rode DEPOIS do 05-anexos-e-conversa.sql. Como usar: SQL Editor > colar tudo > Run.
alter table solicitacoes drop constraint if exists solicitacoes_status_check;
alter table solicitacoes add constraint solicitacoes_status_check
  check (status in ('Aberta','Em análise','Em andamento','Concluída','Recusada'));
