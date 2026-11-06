-- Dados FICTÍCIOS para demonstrar o sistema.
-- As datas são calculadas a partir de hoje, então sempre aparecem alertas
-- de atraso, contrato vencendo e reajuste disponível.
-- Como usar: Supabase > SQL Editor > colar tudo > Run (uma vez só).

insert into inquilinos (nome, cpf, rg, data_nascimento, telefone, email, profissao, renda_mensal, contato_emergencia, observacoes) values
  ('Ana Paula Ribeiro', '123.456.789-01', '4.512.330', '1988-04-12', '(47) 99101-2030', 'ana.ribeiro@exemplo.com', 'Professora', 5200, 'Carlos Ribeiro (47) 99880-1122', 'Tem um gato. Prefere contato por WhatsApp.'),
  ('Bruno Carvalho', '234.567.890-12', '5.873.104', '1979-09-30', '(47) 98822-4455', 'bruno.carvalho@exemplo.com', 'Eletricista', 4100, 'Juliana Carvalho (47) 98777-6655', null),
  ('Camila Torres', '345.678.901-23', '6.201.778', '1995-01-22', '(47) 99634-7788', 'camila.torres@exemplo.com', 'Enfermeira', 4800, 'Rosa Torres (47) 99123-0099', 'Trabalha em plantões noturnos.'),
  ('Diego Martins', '456.789.012-34', '3.998.215', '1990-11-05', '(47) 99258-3311', 'diego.martins@exemplo.com', 'Analista de sistemas', 7600, 'Paula Martins (47) 99341-2200', null),
  ('Eduarda Lima', '567.890.123-45', '7.114.562', '1998-06-17', '(47) 98410-9921', 'eduarda.lima@exemplo.com', 'Designer', 3900, 'Marcos Lima (47) 98455-1010', 'Mora com a irmã.');

insert into contratos (inquilino_id, imovel, valor_aluguel, dia_vencimento, data_inicio, data_fim, status_pagamento, tipo_garantia, indice_reajuste, multa_atraso, juros_mes, observacoes)
select i.id, c.imovel, c.valor, c.dia, current_date + c.inicio, current_date + c.fim, c.status, c.garantia, c.indice, c.multa, c.juros, c.obs
from (values
  ('Ana Paula Ribeiro', 'Rua das Flores, 120 · Centro',        1500.00, 10, -350,  560, 'Em dia',   'Fiador',        'IGP-M', 2.00, 1.00, 'Casa com quintal.'),
  ('Bruno Carvalho',    'Av. Brasil, 845 · Apto 302',          2200.00,  5, -540,  190, 'Atrasado', 'Caução',        'IPCA',  2.00, 1.00, 'Caução de 3 aluguéis.'),
  ('Camila Torres',     'Rua XV de Novembro, 58 · Casa 2',     1350.00, 15, -345,   20, 'Pendente', 'Seguro-fiança', 'IGP-M', 2.00, 1.00, null),
  ('Diego Martins',     'Rua Ipiranga, 300 · Garagem coberta', 1800.00, 20, -100,  995, 'Em dia',   'Nenhuma',       'Livre', 10.00, 1.00, 'Reajuste combinado diretamente.'),
  ('Eduarda Lima',      'Rua das Palmeiras, 77 · Fundos',      1650.00,  1, -200,  530, 'Em dia',   'Fiador',        'IPCA',  2.00, 1.00, null)
) as c(nome, imovel, valor, dia, inicio, fim, status, garantia, indice, multa, juros, obs)
join inquilinos i on i.nome = c.nome;

insert into solicitacoes (contrato_id, titulo, descricao, tipo, prioridade, status, data_abertura)
select ct.id, s.titulo, s.descricao, s.tipo, s.prioridade, s.status, current_date - s.dias
from (values
  ('Rua das Flores, 120 · Centro',        'Vazamento no banheiro',        'Pinga embaixo da pia desde segunda-feira.',           'Manutenção', 'Alta',  'Aberta',       2),
  ('Av. Brasil, 845 · Apto 302',          'Barulho do vizinho de cima',   'Reclamação recorrente após as 22h.',                  'Reclamação', 'Baixa', 'Em análise',   6),
  ('Rua XV de Novembro, 58 · Casa 2',     'Renovação do contrato',        'Inquilina quer renovar por mais 12 meses.',           'Pedido',     'Média', 'Em análise',   3),
  ('Rua Ipiranga, 300 · Garagem coberta', 'Portão eletrônico travando',   'Técnico agendado para sexta.',                        'Manutenção', 'Média', 'Em andamento', 9),
  ('Rua das Palmeiras, 77 · Fundos',      'Pintura do quarto',            'Pediu autorização para pintar a parede de azul.',     'Pedido',     'Baixa', 'Concluída',   25),
  ('Rua das Flores, 120 · Centro',        'Troca do chuveiro',            'Chuveiro queimado, trocado por um de 7500 W.',        'Manutenção', 'Alta',  'Concluída',   40)
) as s(imovel, titulo, descricao, tipo, prioridade, status, dias)
join contratos ct on ct.imovel = s.imovel;
