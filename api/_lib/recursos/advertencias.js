// Advertências: /api/advertencias
//   GET    -> anfitrião vê todas (?inquilino_id=1); inquilino vê só as formais dele
//   POST   -> anfitrião registra (Interna = só ele vê; Formal = o inquilino recebe e responde)
//   PUT    -> inquilino marca como lida ou responde (Aceita / Contestada)
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

const MOTIVOS = ['Barulho', 'Atraso de pagamento', 'Danos ao imóvel', 'Regras do imóvel', 'Animais', 'Uso indevido', 'Outro'];

export default rota(async (req, res) => {
  const supabase = criarCliente(req);
  const usuario = await exigirUsuario(supabase, req);
  const perfil = await obterPerfil(supabase, usuario);
  const anfitriao = perfil.papel === 'anfitriao';
  const id = req.query.id;

  if (req.method === 'GET') {
    let consulta = supabase.from('advertencias').select('*').order('criado_em', { ascending: false });
    if (req.query.inquilino_id) consulta = consulta.eq('inquilino_id', req.query.inquilino_id);
    if (!anfitriao) consulta = consulta.eq('tipo', 'Formal');
    const { data, error } = await consulta;
    if (error) throw traduzirErroBanco(error);
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    if (!anfitriao) throw new ErroApi(403, 'Apenas o anfitrião registra advertências.');
    const dados = limparCampos(req.body, ['inquilino_id', 'tipo', 'motivo', 'titulo', 'descricao', 'data_ocorrencia', 'multa_valor']);
    exigirCampos(dados, { inquilino_id: 'Inquilino', titulo: 'Título' }, 'criar');
    if (dados.tipo && !['Interna', 'Formal'].includes(dados.tipo)) throw new ErroApi(400, 'Tipo inválido.');
    if (dados.motivo && !MOTIVOS.includes(dados.motivo)) throw new ErroApi(400, 'Motivo inválido.');
    if (dados.multa_valor !== undefined && dados.multa_valor !== null && !(Number(dados.multa_valor) > 0)) {
      throw new ErroApi(400, 'O valor da multa precisa ser maior que zero.');
    }
    const { data, error } = await supabase.from('advertencias').insert(dados).select('*').single();
    if (error) throw traduzirErroBanco(error);
    return res.status(201).json(data);
  }

  if (req.method === 'PUT') {
    if (!id) throw new ErroApi(400, 'Informe o id.');
    if (anfitriao) throw new ErroApi(400, 'Advertência registrada não muda. Se precisar, exclua e registre outra.');
    const { data: atual, error: erroBusca } = await supabase.from('advertencias').select('*').eq('id', id).maybeSingle();
    if (erroBusca) throw traduzirErroBanco(erroBusca);
    if (!atual) throw new ErroApi(404, 'Advertência não encontrada.');

    const corpo = req.body || {};
    const agora = new Date().toISOString();
    let mudancas;
    if (corpo.acao === 'lido') {
      mudancas = { lido_em: atual.lido_em || agora };
    } else if (corpo.acao === 'responder') {
      if (atual.resposta) throw new ErroApi(400, 'Você já respondeu esta advertência.');
      if (!['Aceita', 'Contestada'].includes(corpo.resposta)) throw new ErroApi(400, 'Resposta inválida.');
      const comentario = String(corpo.comentario || '').trim().slice(0, 1000);
      if (corpo.resposta === 'Contestada' && !comentario) throw new ErroApi(400, 'Explique por que você não concorda.');
      mudancas = { resposta: corpo.resposta, resposta_comentario: comentario || null, respondido_em: agora, lido_em: atual.lido_em || agora };
    } else {
      throw new ErroApi(400, 'Ação inválida.');
    }
    const { error } = await supabase.from('advertencias').update(mudancas).eq('id', id);
    if (error) throw traduzirErroBanco(error);
    return res.status(200).json({ ...atual, ...mudancas });
  }

  if (req.method === 'DELETE') {
    if (!anfitriao) throw new ErroApi(403, 'Apenas o anfitrião pode excluir.');
    if (!id) throw new ErroApi(400, 'Informe o id.');
    const { error } = await supabase.from('advertencias').delete().eq('id', id);
    if (error) throw traduzirErroBanco(error);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  throw new ErroApi(405, 'Método não permitido.');
});
