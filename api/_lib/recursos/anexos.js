// Anexos (fotos e PDFs) de uma solicitação: /api/anexos?solicitacao_id=1
// O arquivo vai para o Supabase Storage (pasta "anexos") pelo navegador.
// Esta rota guarda e gerencia as informações do arquivo no banco.
import { criarCrud } from '../crud.js';
import { exigirCampos, traduzirErroBanco } from '../supabase.js';

export default criarCrud({
  tabela: 'anexos_solicitacao',
  campos: ['solicitacao_id', 'nome_arquivo', 'caminho'],
  ordenar: { coluna: 'criado_em', crescente: true },
  filtros: ['solicitacao_id'],
  inquilinoPode: ['GET', 'POST'],

  prepararCriacao(dados, perfil) {
    return { ...dados, enviado_por: perfil.papel };
  },

  validar(dados, modo) {
    exigirCampos(dados, { solicitacao_id: 'Solicitação', nome_arquivo: 'Arquivo', caminho: 'Arquivo' }, modo);
  },

  // Antes de excluir o registro, apaga o arquivo guardado no Storage
  async antesDeExcluir(supabase, id) {
    const { data, error } = await supabase.from('anexos_solicitacao').select('caminho').eq('id', id).maybeSingle();
    if (error) throw traduzirErroBanco(error);
    if (data?.caminho) await supabase.storage.from('anexos').remove([data.caminho]);
  },
});
