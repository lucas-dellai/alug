// Comunicados do anfitrião para um inquilino: /api/comunicados
//   GET    -> anfitrião vê todos (ou ?inquilino_id=1); inquilino vê só os dele
//   POST   -> anfitrião envia um comunicado
//   PUT    -> inquilino marca como lido ou responde (Confirmado / Recusado)
//   DELETE -> anfitrião apaga
import {
  ErroApi,
  criarCliente,
  exigirCampos,
  exigirUsuario,
  limparCampos,
  obterPerfil,
  rota,
  traduzirErroBanco,
} from '../supabase.js';

const TIPOS = ['Aviso', 'Cobrança', 'Visita ao imóvel', 'Manutenção programada', 'Reajuste', 'Renovação', 'Regras do imóvel', 'Outro'];

export default rota(async (req, res) => {
  const supabase = criarCliente(req);
  const usuario = await exigirUsuario(supabase, req);
  const perfil = await obterPerfil(supabase, usuario);
  const anfitriao = perfil.papel === 'anfitriao';
  const id = req.query.id;

  if (req.method === 'GET') {
    let consulta = supabase.from('comunicados').select('*, inquilinos(nome)').order('criado_em', { ascending: false });
    if (req.query.inquilino_id) consulta = consulta.eq('inquilino_id', req.query.inquilino_id);
    const { data, error } = await consulta;
    if (error) throw traduzirErroBanco(error);
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    if (!anfitriao) throw new ErroApi(403, 'Apenas o anfitrião envia comunicados.');
    const dados = limparCampos(req.body, ['inquilino_id', 'tipo', 'titulo', 'mensagem', 'pede_resposta']);
    exigirCampos(dados, { inquilino_id: 'Inquilino', titulo: 'Título', mensagem: 'Mensagem' }, 'criar');
    if (dados.tipo && !TIPOS.includes(dados.tipo)) throw new ErroApi(400, 'Tipo de comunicado inválido.');
    dados.pede_resposta = dados.pede_resposta !== false;
    const { data, error } = await supabase.from('comunicados').insert(dados).select('*, inquilinos(nome)').single();
    if (error) throw traduzirErroBanco(error);
    return res.status(201).json(data);
  }

  if (req.method === 'PUT') {
    if (!id) throw new ErroApi(400, 'Informe o id do comunicado.');
    if (anfitriao) throw new ErroApi(400, 'Comunicado enviado não muda. Se precisar, exclua e envie outro.');

    const { data: atual, error: erroBusca } = await supabase.from('comunicados').select('*').eq('id', id).maybeSingle();
    if (erroBusca) throw traduzirErroBanco(erroBusca);
    if (!atual) throw new ErroApi(404, 'Comunicado não encontrado.');

    const corpo = req.body || {};
    const agora = new Date().toISOString();
    let mudancas;
    if (corpo.acao === 'lido') {
      mudancas = { lido_em: atual.lido_em || agora };
    } else if (corpo.acao === 'responder') {
      if (!atual.pede_resposta) throw new ErroApi(400, 'Este comunicado não pede resposta.');
      if (atual.resposta) throw new ErroApi(400, 'Você já respondeu este comunicado.');
      if (!['Confirmado', 'Recusado'].includes(corpo.resposta)) throw new ErroApi(400, 'Resposta inválida.');
      const comentario = String(corpo.comentario || '').trim();
      mudancas = {
        resposta: corpo.resposta,
        resposta_comentario: comentario || null,
        respondido_em: agora,
        lido_em: atual.lido_em || agora,
      };
    } else {
      throw new ErroApi(400, 'Ação inválida.');
    }

    const { error } = await supabase.from('comunicados').update(mudancas).eq('id', id);
    if (error) throw traduzirErroBanco(error);
    return res.status(200).json({ ...atual, ...mudancas });
  }

  if (req.method === 'DELETE') {
    if (!anfitriao) throw new ErroApi(403, 'Apenas o anfitrião pode excluir comunicados.');
    if (!id) throw new ErroApi(400, 'Informe o id do comunicado.');
    const { error } = await supabase.from('comunicados').delete().eq('id', id);
    if (error) throw traduzirErroBanco(error);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  throw new ErroApi(405, 'Método não permitido.');
});
