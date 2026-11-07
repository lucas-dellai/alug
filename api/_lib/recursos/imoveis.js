// Imóveis do anfitrião: /api/imoveis
// O inquilino só consegue ler o imóvel que ele aluga (regra no banco).
import { criarCrud } from '../crud.js';
import { ErroApi, exigirCampos, traduzirErroBanco } from '../supabase.js';

const TIPOS = ['Casa', 'Apartamento', 'Kitnet', 'Sobrado', 'Sala comercial', 'Outro'];

export default criarCrud({
  tabela: 'imoveis',
  campos: [
    'nome',
    'endereco',
    'tipo',
    'finalidade',
    'quartos',
    'banheiros',
    'vagas',
    'area_m2',
    'mobiliado',
    'aceita_pet',
    'valor_sugerido',
    'descricao',
    'incluso',
    'nao_incluso',
    'foto_url',
    'foto_caminho',
  ],
  ordenar: { coluna: 'nome' },
  inquilinoPode: ['GET'],

  validar(dados, modo) {
    // Listas do que está (e não está) incluso: só textos curtos, sem repetir
    for (const campo of ['incluso', 'nao_incluso']) {
      if (dados[campo] === null) dados[campo] = [];
      if (dados[campo] !== undefined) {
        if (!Array.isArray(dados[campo])) throw new ErroApi(400, 'Lista de itens inválida.');
        dados[campo] = [...new Set(dados[campo].map((item) => String(item).trim().slice(0, 40)).filter(Boolean))].slice(0, 40);
      }
    }
    exigirCampos(dados, { nome: 'Nome do imóvel', endereco: 'Endereço' }, modo);
    if (dados.tipo && !TIPOS.includes(dados.tipo)) throw new ErroApi(400, 'Tipo de imóvel inválido.');
    if (dados.finalidade !== undefined) {
      dados.finalidade = String(dados.finalidade || '').trim().slice(0, 30);
      if (!dados.finalidade) throw new ErroApi(400, 'Escolha a categoria do imóvel.');
    }
    for (const campo of ['quartos', 'banheiros', 'vagas']) {
      if (dados[campo] !== undefined && dados[campo] !== null) {
        const n = Number(dados[campo]);
        if (!Number.isInteger(n) || n < 0 || n > 50) throw new ErroApi(400, 'Quartos, banheiros e vagas: de 0 a 50.');
      }
    }
    for (const campo of ['area_m2', 'valor_sugerido']) {
      if (dados[campo] !== undefined && dados[campo] !== null && !(Number(dados[campo]) > 0)) {
        throw new ErroApi(400, 'Área e valor precisam ser maiores que zero.');
      }
    }
  },

  // Antes de excluir, apaga a foto de capa
  async antesDeExcluir(supabase, id) {
    const { data, error } = await supabase.from('imoveis').select('foto_caminho').eq('id', id).maybeSingle();
    if (error) throw traduzirErroBanco(error);
    if (data?.foto_caminho) await supabase.storage.from('imoveis').remove([data.foto_caminho]);
  },
});
