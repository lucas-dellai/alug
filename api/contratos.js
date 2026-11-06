// API de Contratos: /api/contratos
import { criarCrud } from './_lib/crud.js';
import { ErroApi, exigirCampos } from './_lib/supabase.js';

const STATUS = ['Em dia', 'Atrasado', 'Pendente'];

export default criarCrud({
  tabela: 'contratos',
  campos: [
    'inquilino_id',
    'imovel',
    'valor_aluguel',
    'dia_vencimento',
    'data_inicio',
    'data_fim',
    'status_pagamento',
    'tipo_garantia',
    'indice_reajuste',
    'multa_atraso',
    'juros_mes',
    'data_ultimo_reajuste',
    'observacoes',
  ],
  // Traz junto o nome e o telefone do inquilino
  selecionar: '*, inquilinos(id, nome, telefone)',
  ordenar: { coluna: 'data_fim' },
  filtros: ['inquilino_id'],
  inquilinoPode: ['GET'],

  validar(dados, modo) {
    exigirCampos(
      dados,
      {
        inquilino_id: 'Inquilino',
        imovel: 'Imóvel',
        valor_aluguel: 'Valor do aluguel',
        dia_vencimento: 'Dia de vencimento',
        data_inicio: 'Início do contrato',
        data_fim: 'Fim do contrato',
      },
      modo,
    );
    if ('valor_aluguel' in dados && !(Number(dados.valor_aluguel) > 0)) {
      throw new ErroApi(400, 'O valor do aluguel precisa ser maior que zero.');
    }
    if ('dia_vencimento' in dados) {
      const dia = Number(dados.dia_vencimento);
      if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
        throw new ErroApi(400, 'O dia de vencimento precisa ser entre 1 e 31.');
      }
    }
    if (dados.data_inicio && dados.data_fim && dados.data_fim <= dados.data_inicio) {
      throw new ErroApi(400, 'O fim do contrato precisa ser depois do início.');
    }
    if ('status_pagamento' in dados && !STATUS.includes(dados.status_pagamento)) {
      throw new ErroApi(400, 'Status de pagamento inválido.');
    }
    for (const campo of ['multa_atraso', 'juros_mes']) {
      if (dados[campo] !== undefined && dados[campo] !== null && Number(dados[campo]) < 0) {
        throw new ErroApi(400, 'Multa e juros não podem ser negativos.');
      }
    }
  },
});
