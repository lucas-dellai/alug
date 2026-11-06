-- Perfis (anfitrião e inquilino), fotos de perfil e Portal do Inquilino.
-- Rode DEPOIS do 01-criar-tabelas.sql. Como usar: SQL Editor > colar tudo > Run.

-- ===== TABELA 5: PERFIS =====
-- Cada usuário que faz login tem um perfil.
-- papel = 'anfitriao' (dono dos imóveis) ou 'inquilino' (acesso só ao próprio contrato)
create table perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nome text,
  telefone text,
  foto_url text,
  papel text not null default 'anfitriao' check (papel in ('anfitriao','inquilino')),
  inquilino_id bigint unique references inquilinos(id) on delete cascade,
  criado_em timestamptz default now(),
  check (papel = 'anfitriao' or inquilino_id is not null)
);

-- Quem já tem login vira anfitrião (é o seu usuário)
insert into perfis (id, email, nome, papel)
select id, email, split_part(email, '@', 1), 'anfitriao'
from auth.users
on conflict (id) do nothing;

-- Todo usuário novo ganha um perfil automaticamente.
-- O acesso de inquilino é criado pelo app, que avisa o papel e o inquilino.
-- IMPORTANTE: mantenha "Allow new users to sign up" DESLIGADO no Supabase.
create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, email, nome, papel, inquilino_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'papel', 'anfitriao'),
    nullif(new.raw_user_meta_data ->> 'inquilino_id', '')::bigint
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- ===== FUNÇÕES DE APOIO PARA AS REGRAS DE SEGURANÇA =====
create or replace function public.eh_anfitriao()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from perfis where id = auth.uid() and papel = 'anfitriao');
$$;

create or replace function public.meu_inquilino_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select inquilino_id from perfis where id = auth.uid() and papel = 'inquilino';
$$;

-- ===== PERMISSÕES DA TABELA PERFIS =====
alter table perfis enable row level security;

create policy "Ver perfis" on perfis for select to authenticated
  using (id = auth.uid() or papel = 'anfitriao' or eh_anfitriao());

create policy "Editar o próprio perfil" on perfis for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

revoke all on perfis from anon;
revoke insert, update, delete on perfis from authenticated;
grant select on perfis to authenticated;
grant update (nome, telefone, foto_url) on perfis to authenticated;

-- ===== NOVAS REGRAS: ANFITRIÃO VÊ TUDO, INQUILINO SÓ O QUE É DELE =====
drop policy if exists "Logados acessam inquilinos"   on inquilinos;
drop policy if exists "Logados acessam contratos"    on contratos;
drop policy if exists "Logados acessam solicitacoes" on solicitacoes;
drop policy if exists "Logados acessam documentos"   on documentos;

-- Inquilinos
create policy "Anfitrião gerencia inquilinos" on inquilinos for all to authenticated
  using (eh_anfitriao()) with check (eh_anfitriao());
create policy "Inquilino vê o próprio cadastro" on inquilinos for select to authenticated
  using (id = meu_inquilino_id());

-- Contratos
create policy "Anfitrião gerencia contratos" on contratos for all to authenticated
  using (eh_anfitriao()) with check (eh_anfitriao());
create policy "Inquilino vê os próprios contratos" on contratos for select to authenticated
  using (inquilino_id = meu_inquilino_id());

-- Solicitações (o inquilino pode ver e abrir as dele)
create policy "Anfitrião gerencia solicitações" on solicitacoes for all to authenticated
  using (eh_anfitriao()) with check (eh_anfitriao());
create policy "Inquilino vê as próprias solicitações" on solicitacoes for select to authenticated
  using (contrato_id in (select id from contratos where inquilino_id = meu_inquilino_id()));
create policy "Inquilino abre solicitações" on solicitacoes for insert to authenticated
  with check (
    status = 'Aberta'
    and contrato_id in (select id from contratos where inquilino_id = meu_inquilino_id())
  );

-- Documentos (o inquilino só consulta os dele)
create policy "Anfitrião gerencia documentos" on documentos for all to authenticated
  using (eh_anfitriao()) with check (eh_anfitriao());
create policy "Inquilino vê os próprios documentos" on documentos for select to authenticated
  using (inquilino_id = meu_inquilino_id());

-- Arquivos dos documentos
drop policy if exists "Logados veem arquivos"   on storage.objects;
drop policy if exists "Logados enviam arquivos" on storage.objects;
drop policy if exists "Logados apagam arquivos" on storage.objects;

create policy "Anfitrião gerencia arquivos" on storage.objects for all to authenticated
  using (bucket_id = 'documentos' and eh_anfitriao())
  with check (bucket_id = 'documentos' and eh_anfitriao());
create policy "Inquilino vê os próprios arquivos" on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = meu_inquilino_id()::text);

-- ===== SOLICITAÇÕES: PRAZO E ÚLTIMA MOVIMENTAÇÃO =====
-- prazo: data combinada para resolver
-- atualizado_em: última vez que o status mudou (para saber se está parada)
alter table solicitacoes add column if not exists prazo date;
alter table solicitacoes add column if not exists atualizado_em timestamptz default now();

-- Solicitações que já existiam: considera a data de abertura como última movimentação
update solicitacoes set atualizado_em = data_abertura::timestamptz;
-- Exemplo: prazo de 7 dias para as que ainda não foram concluídas
update solicitacoes set prazo = data_abertura + 7 where status <> 'Concluída' and prazo is null;

create or replace function public.marcar_movimentacao_solicitacao()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.atualizado_em = now();
  end if;
  return new;
end;
$$;

create trigger ao_mudar_status_solicitacao
  before update on solicitacoes
  for each row execute function public.marcar_movimentacao_solicitacao();

-- ===== FOTOS DE PERFIL =====
-- Pasta pública (a foto aparece por link), até 2 MB, só imagens.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "Enviar a própria foto" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Ver a própria pasta de fotos" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Apagar a própria foto" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
