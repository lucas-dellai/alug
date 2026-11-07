// API de Custos: /api/custos  (só o anfitrião)
// Cada custo pode ter comprovante e ficar ligado a um imóvel (contrato) e a um chamado (solicitação).
import { criarCrud } from '../crud.js';
import { ErroApi, exigirCampos, traduzirErroBanco } from '../supabase.js';

const CATEGORIAS = ['Manutenção', 'Material', 'Mão de obra', 'IPTU', 'Condomínio', 'Seguro', 'Taxas', 'Outro'];

export default criarCrud({
  tabela: 'custos',
  campos: [
    'descricao',
    'valor',
    'data',
    'categoria',
    'contrato_id',
    'solicitacao_id',
    'comprovante_nome',
    'comprovante_caminho',
    'observacoes',
  ],
  selecionar: '*, contratos(imovel, inquilino_id, inquilinos(nome)), solicitacoes(titulo, status)',
  ordenar: { coluna: 'data', crescente: false },
  filtros: ['contrato_id', 'solicitacao_id'],
  inquilinoPode: [],

  validar(dados, modo) {
    exigirCampos(dados, { descricao: 'Descrição', valor: 'Valor', data: 'Data' }, modo);
    if (dados.valor !== undefined && !(Number(dados.valor) > 0)) {
      throw new ErroApi(400, 'O valor do custo precisa ser maior que zero.');
    }
    if (dados.categoria && !CATEGORIAS.includes(dados.categoria)) {
      throw new ErroApi(400, 'Categoria inválida.');
    }
  },

  // Antes de excluir o custo, apaga o comprovante guardado no Storage
  async antesDeExcluir(supabase, id) {
    const { data, error } = await supabase.from('custos').select('comprovante_caminho').eq('id', id).maybeSingle();
    if (error) throw traduzirErroBanco(error);
    if (data?.comprovante_caminho) await supabase.storage.from('custos').remove([data.comprovante_caminho]);
  },
});
