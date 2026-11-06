-- Regras de cobrança do anfitrião: cobrar ou não multa e juros, percentuais padrão e tolerância.
-- Rode DEPOIS do 06-status-recusada.sql. Como usar: SQL Editor > colar tudo > Run.

-- ===== TABELA 9: CONFIGURAÇÕES (uma linha por anfitrião) =====
create table configuracoes (
  id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  cobrar_multa boolean not null default true,
  multa_padrao numeric(5,2) not null default 2 check (multa_padrao between 0 and 100),
  cobrar_juros boolean not null default true,
  juros_padrao numeric(5,2) not null default 1 check (juros_padrao between 0 and 100),
  dias_tolerancia int not null default 0 check (dias_tolerancia between 0 and 31),
  atualizado_em timestamptz default now()
);

alter table configuracoes enable row level security;

-- Todos os usuários logados podem ler (o inquilino precisa para calcular o valor a pagar)
create policy "Ler configurações" on configuracoes for select to authenticated using (true);
-- Só o anfitrião cria e altera a própria configuração
create policy "Anfitrião cria configurações" on configuracoes for insert to authenticated
  with check (eh_anfitriao() and id = auth.uid());
create policy "Anfitrião altera configurações" on configuracoes for update to authenticated
  using (eh_anfitriao() and id = auth.uid()) with check (eh_anfitriao() and id = auth.uid());

grant select, insert, update on configuracoes to authenticated;
