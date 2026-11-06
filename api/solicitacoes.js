// API de Solicitações (chamados dos inquilinos): /api/solicitacoes
import { criarCrud } from './_lib/crud.js';
import { ErroApi, exigirCampos } from './_lib/supabase.js';

const STATUS = ['Aberta', 'Em análise', 'Em andamento', 'Concluída'];

export default criarCrud({
  tabela: 'solicitacoes',
  campos: ['contrato_id', 'titulo', 'descricao', 'tipo', 'prioridade', 'status', 'data_abertura', 'prazo'],
  // Traz junto o imóvel e o nome do inquilino
  selecionar: '*, contratos(id, imovel, inquilino_id, inquilinos(nome))',
  ordenar: { coluna: 'criado_em', crescente: false },
  filtros: ['contrato_id', 'status'],

  // O inquilino pode ver e abrir solicitações. Toda solicitação dele começa como "Aberta".
  inquilinoPode: ['GET', 'POST'],
  prepararParaInquilino(dados) {
    // eslint-disable-next-line no-unused-vars
    const { data_abertura, prazo, ...resto } = dados;
    return { ...resto, status: 'Aberta' };
  },

  validar(dados, modo) {
    exigirCampos(dados, { contrato_id: 'Contrato', titulo: 'Título' }, modo);
    if ('status' in dados && !STATUS.includes(dados.status)) {
      throw new ErroApi(400, 'Status da solicitação inválido.');
    }
  },
});
