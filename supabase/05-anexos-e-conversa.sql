-- Solicitações: anexos (fotos/PDF) e conversa entre anfitrião e inquilino.
-- Rode DEPOIS do 04-pagamentos.sql. Como usar: SQL Editor > colar tudo > Run.

-- A solicitação pertence ao inquilino logado?
create or replace function public.solicitacao_do_inquilino(sid bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from solicitacoes s
    join contratos c on c.id = s.contrato_id
    where s.id = sid and c.inquilino_id = meu_inquilino_id()
  );
$$;

-- ===== TABELA 7: MENSAGENS DA SOLICITAÇÃO (conversa) =====
create table mensagens_solicitacao (
  id bigint generated always as identity primary key,
  solicitacao_id bigint not null references solicitacoes(id) on delete cascade,
  autor_id uuid default auth.uid() references auth.users(id) on delete set null,
  autor_nome text,
  autor_papel text not null check (autor_papel in ('anfitriao','inquilino')),
  texto text not null check (length(trim(texto)) > 0),
  criado_em timestamptz default now()
);

-- ===== TABELA 8: ANEXOS DA SOLICITAÇÃO =====
create table anexos_solicitacao (
  id bigint generated always as identity primary key,
  solicitacao_id bigint not null references solicitacoes(id) on delete cascade,
  nome_arquivo text not null,
  caminho text not null,
  enviado_por text not null check (enviado_por in ('anfitriao','inquilino')),
  criado_em timestamptz default now()
);

alter table mensagens_solicitacao enable row level security;
alter table anexos_solicitacao enable row level security;

create policy "Anfitrião gerencia mensagens" on mensagens_solicitacao for all to authenticated
  using (eh_anfitriao()) with check (eh_anfitriao());
create policy "Inquilino vê mensagens das suas solicitações" on mensagens_solicitacao for select to authenticated
  using (solicitacao_do_inquilino(solicitacao_id));
create policy "Inquilino envia mensagens" on mensagens_solicitacao for insert to authenticated
  with check (solicitacao_do_inquilino(solicitacao_id) and autor_papel = 'inquilino' and autor_id = auth.uid());

create policy "Anfitrião gerencia anexos" on anexos_solicitacao for all to authenticated
  using (eh_anfitriao()) with check (eh_anfitriao());
create policy "Inquilino vê anexos das suas solicitações" on anexos_solicitacao for select to authenticated
  using (solicitacao_do_inquilino(solicitacao_id));
create policy "Inquilino envia anexos" on anexos_solicitacao for insert to authenticated
  with check (solicitacao_do_inquilino(solicitacao_id) and enviado_por = 'inquilino');

grant select, insert, update, delete on mensagens_solicitacao, anexos_solicitacao to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ===== ARQUIVOS DOS ANEXOS (pasta privada, até 5 MB) =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anexos', 'anexos', false, 5242880, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "Anfitrião gerencia anexos (arquivos)" on storage.objects for all to authenticated
  using (bucket_id = 'anexos' and eh_anfitriao())
  with check (bucket_id = 'anexos' and eh_anfitriao());
create policy "Inquilino vê anexos (arquivos)" on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and solicitacao_do_inquilino(((storage.foldername(name))[1])::bigint));
create policy "Inquilino envia anexos (arquivos)" on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and solicitacao_do_inquilino(((storage.foldername(name))[1])::bigint));
