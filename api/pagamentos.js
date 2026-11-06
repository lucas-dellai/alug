// API de Pagamentos: /api/pagamentos
// Cada registro é o pagamento de um mês de aluguel de um contrato.
import { criarCrud } from './_lib/crud.js';
import { ErroApi, exigirCampos } from './_lib/supabase.js';

const FORMAS = ['Pix', 'Transferência', 'Boleto', 'Dinheiro', 'Outro'];

export default criarCrud({
  tabela: 'pagamentos',
  campos: ['contrato_id', 'referencia', 'data_pagamento', 'valor_pago', 'forma', 'observacoes'],
  ordenar: { coluna: 'referencia', crescente: false },
  filtros: ['contrato_id'],
  inquilinoPode: ['GET'],

  validar(dados, modo) {
    exigirCampos(
      dados,
      {
        contrato_id: 'Contrato',
        referencia: 'Mês de referência',
        data_pagamento: 'Data do pagamento',
        valor_pago: 'Valor pago',
      },
      modo,
    );
    // O mês de referência é sempre guardado como dia 1 (ex.: "2026-11" vira "2026-11-01")
    if (dados.referencia) {
      const mes = String(dados.referencia).slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(mes)) throw new ErroApi(400, 'Mês de referência inválido.');
      dados.referencia = `${mes}-01`;
    }
    if ('valor_pago' in dados && !(Number(dados.valor_pago) > 0)) {
      throw new ErroApi(400, 'O valor pago precisa ser maior que zero.');
    }
    if (dados.forma && !FORMAS.includes(dados.forma)) {
      throw new ErroApi(400, 'Forma de pagamento inválida.');
    }
  },
});
