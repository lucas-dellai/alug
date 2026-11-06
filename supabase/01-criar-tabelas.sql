-- Script que cria o banco de dados do Controle de Aluguéis no Supabase.
-- Como usar: Supabase > SQL Editor > colar tudo > Run.

-- ===== TABELA 1: INQUILINOS =====
create table inquilinos (
  id bigint generated always as identity primary key,
  nome text not null,
  cpf text,
  rg text,
  data_nascimento date,
  telefone text,
  email text,
  profissao text,
  renda_mensal numeric(12,2),
  contato_emergencia text,
  observacoes text,
  criado_em timestamptz default now()
);

-- ===== TABELA 2: CONTRATOS =====
create table contratos (
  id bigint generated always as identity primary key,
  inquilino_id bigint not null references inquilinos(id) on delete restrict,
  imovel text not null,
  valor_aluguel numeric(12,2) not null check (valor_aluguel > 0),
  dia_vencimento int not null check (dia_vencimento between 1 and 31),
  data_inicio date not null,
  data_fim date not null,
  status_pagamento text not null default 'Pendente'
    check (status_pagamento in ('Em dia','Atrasado','Pendente')),
  tipo_garantia text default 'Nenhuma'
    check (tipo_garantia in ('Fiador','Caução','Seguro-fiança','Nenhuma')),
  indice_reajuste text default 'IGP-M'
    check (indice_reajuste in ('IGP-M','IPCA','Livre')),
  multa_atraso numeric(5,2) default 2,
  juros_mes numeric(5,2) default 1,
  data_ultimo_reajuste date,
  observacoes text,
  criado_em timestamptz default now(),
  check (data_fim > data_inicio)
);

-- ===== TABELA 3: SOLICITAÇÕES =====
create table solicitacoes (
  id bigint generated always as identity primary key,
  contrato_id bigint not null references contratos(id) on delete cascade,
  titulo text not null,
  descricao text,
  tipo text default 'Manutenção'
    check (tipo in ('Manutenção','Reclamação','Pedido','Outro')),
  prioridade text default 'Média'
    check (prioridade in ('Baixa','Média','Alta')),
  status text not null default 'Aberta'
    check (status in ('Aberta','Em análise','Em andamento','Concluída')),
  data_abertura date default current_date,
  criado_em timestamptz default now()
);

-- ===== TABELA 4: DOCUMENTOS =====
create table documentos (
  id bigint generated always as identity primary key,
  inquilino_id bigint not null references inquilinos(id) on delete cascade,
  tipo text not null
    check (tipo in ('RG','CNH','Comprovante de renda','Comprovante de residência','Contrato assinado','Outro')),
  nome_arquivo text not null,
  caminho text not null,
  enviado_em timestamptz default now()
);

-- ===== SEGURANÇA: só quem está logado acessa =====
alter table inquilinos   enable row level security;
alter table contratos    enable row level security;
alter table solicitacoes enable row level security;
alter table documentos   enable row level security;

create policy "Logados acessam inquilinos"   on inquilinos   for all to authenticated using (true) with check (true);
create policy "Logados acessam contratos"    on contratos    for all to authenticated using (true) with check (true);
create policy "Logados acessam solicitacoes" on solicitacoes for all to authenticated using (true) with check (true);
create policy "Logados acessam documentos"   on documentos   for all to authenticated using (true) with check (true);

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ===== ARQUIVOS: pasta privada para os documentos (até 5 MB, PDF/JPG/PNG) =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 5242880,
        array['application/pdf','image/jpeg','image/png']);

create policy "Logados veem arquivos"    on storage.objects for select to authenticated using (bucket_id = 'documentos');
create policy "Logados enviam arquivos"  on storage.objects for insert to authenticated with check (bucket_id = 'documentos');
create policy "Logados apagam arquivos"  on storage.objects for delete to authenticated using (bucket_id = 'documentos');
