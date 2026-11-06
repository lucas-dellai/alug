// API de Inquilinos: /api/inquilinos
import { criarCrud } from './_lib/crud.js';
import { ErroApi, criarClienteAdmin, exigirCampos, traduzirErroBanco } from './_lib/supabase.js';

export default criarCrud({
  tabela: 'inquilinos',
  campos: [
    'nome',
    'cpf',
    'rg',
    'data_nascimento',
    'telefone',
    'email',
    'profissao',
    'renda_mensal',
    'contato_emergencia',
    'observacoes',
  ],
  ordenar: { coluna: 'nome' },
  inquilinoPode: ['GET'],

  validar(dados, modo) {
    exigirCampos(dados, { nome: 'Nome completo' }, modo);
    if (dados.email && !/^\S+@\S+\.\S+$/.test(dados.email)) {
      throw new ErroApi(400, 'O e-mail informado não é válido.');
    }
    if (dados.renda_mensal !== undefined && dados.renda_mensal !== null && Number(dados.renda_mensal) < 0) {
      throw new ErroApi(400, 'A renda mensal não pode ser negativa.');
    }
  },

  // Antes de excluir: bloqueia se tiver contrato e apaga os arquivos anexados.
  async antesDeExcluir(supabase, id) {
    const { count, error } = await supabase
      .from('contratos')
      .select('id', { count: 'exact', head: true })
      .eq('inquilino_id', id);
    if (error) throw traduzirErroBanco(error);
    if (count > 0) {
      throw new ErroApi(409, 'Este inquilino tem contratos cadastrados. Exclua os contratos antes.');
    }

    const { data: documentos } = await supabase.from('documentos').select('caminho').eq('inquilino_id', id);
    if (documentos?.length) {
      await supabase.storage.from('documentos').remove(documentos.map((d) => d.caminho));
    }

    // Se o inquilino tinha acesso ao portal, remove o login dele também
    const { data: acesso } = await supabase.from('perfis').select('id').eq('inquilino_id', id).maybeSingle();
    if (acesso) {
      await criarClienteAdmin().auth.admin.deleteUser(acesso.id);
    }
  },
});
