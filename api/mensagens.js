// Conversa de uma solicitação entre anfitrião e inquilino: /api/mensagens?solicitacao_id=1
import { criarCrud } from './_lib/crud.js';
import { exigirCampos } from './_lib/supabase.js';

export default criarCrud({
  tabela: 'mensagens_solicitacao',
  campos: ['solicitacao_id', 'texto'],
  ordenar: { coluna: 'criado_em', crescente: true },
  filtros: ['solicitacao_id'],
  inquilinoPode: ['GET', 'POST'],

  // Quem escreveu é sempre quem está logado
  prepararCriacao(dados, perfil) {
    return { ...dados, autor_nome: perfil.nome, autor_papel: perfil.papel };
  },

  validar(dados, modo) {
    exigirCampos(dados, { solicitacao_id: 'Solicitação', texto: 'Mensagem' }, modo);
  },
});
