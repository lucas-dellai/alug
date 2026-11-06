-- Registro de pagamentos: o status (Em dia, Pendente, Atrasado) passa a ser calculado sozinho.
-- Rode DEPOIS do 03-perfis-e-portal.sql. Como usar: SQL Editor > colar tudo > Run.

-- ===== TABELA 6: PAGAMENTOS =====
-- Um registro por mês pago de cada contrato.
create table pagamentos (
  id bigint generated always as identity primary key,
  contrato_id bigint not null references contratos(id) on delete cascade,
  referencia date not null,                 -- mês do aluguel (sempre dia 1, ex.: 2026-11-01)
  data_pagamento date not null,             -- dia em que o inquilino pagou
  valor_pago numeric(12,2) not null check (valor_pago > 0),
  forma text default 'Pix' check (forma in ('Pix','Transferência','Boleto','Dinheiro','Outro')),
  observacoes text,
  criado_em timestamptz default now(),
  unique (contrato_id, referencia)          -- não deixa pagar o mesmo mês duas vezes
);

alter table pagamentos enable row level security;

create policy "Anfitrião gerencia pagamentos" on pagamentos for all to authenticated
  using (eh_anfitriao()) with check (eh_anfitriao());
create policy "Inquilino vê os próprios pagamentos" on pagamentos for select to authenticated
  using (contrato_id in (select id from contratos where inquilino_id = meu_inquilino_id()));

grant select, insert, update, delete on pagamentos to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ===== DADOS DE EXEMPLO =====
-- Marca como pagos os meses que já venceram, para os contratos de exemplo.
-- Exceção: o contrato da Av. Brasil (Bruno) fica com o mês atual em aberto, para mostrar um atraso.
insert into pagamentos (contrato_id, referencia, data_pagamento, valor_pago, forma)
select
  c.id,
  date_trunc('month', m)::date,
  (date_trunc('month', m)::date + (least(c.dia_vencimento, 28) - 1)) - (c.id % 3)::int,
  c.valor_aluguel,
  'Pix'
from contratos c
cross join lateral generate_series(
  date_trunc('month', c.data_inicio),
  date_trunc('month', current_date),
  interval '1 month'
) as m
where (date_trunc('month', m)::date + (least(c.dia_vencimento, 28) - 1)) between c.data_inicio and current_date - 1
  and not (c.imovel like 'Av. Brasil%' and date_trunc('month', m) = date_trunc('month', current_date))
on conflict (contrato_id, referencia) do nothing;
