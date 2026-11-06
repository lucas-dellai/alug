// API de Documentos anexados: /api/documentos
// O arquivo em si é enviado para o Supabase Storage pelo navegador.
// Esta rota guarda e gerencia as informações do arquivo no banco.
import { criarCrud } from './_lib/crud.js';
import { exigirCampos, traduzirErroBanco } from './_lib/supabase.js';

export default criarCrud({
  tabela: 'documentos',
  campos: ['inquilino_id', 'tipo', 'nome_arquivo', 'caminho'],
  ordenar: { coluna: 'enviado_em', crescente: false },
  filtros: ['inquilino_id'],
  inquilinoPode: ['GET'],

  validar(dados, modo) {
    exigirCampos(
      dados,
      { inquilino_id: 'Inquilino', tipo: 'Tipo do documento', nome_arquivo: 'Arquivo', caminho: 'Arquivo' },
      modo,
    );
  },

  // Antes de excluir o registro, apaga o arquivo guardado no Storage.
  async antesDeExcluir(supabase, id) {
    const { data, error } = await supabase.from('documentos').select('caminho').eq('id', id).maybeSingle();
    if (error) throw traduzirErroBanco(error);
    if (data?.caminho) {
      await supabase.storage.from('documentos').remove([data.caminho]);
    }
  },
});
