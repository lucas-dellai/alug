// Pagamentos informados pelo inquilino ("Realizei o pagamento"): /api/informes
//   GET    -> anfitrião vê todos (?status=Aguardando); inquilino vê só os dele
//   POST   -> inquilino informa que pagou (com comprovante)
//   PUT    -> anfitrião confirma (vira pagamento registrado) ou recusa (com motivo)
//   DELETE -> anfitrião apaga (e o comprovante junto)
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

const FORMAS = ['Pix', 'Transferência', 'Boleto', 'Dinheiro', 'Outro'];
const SELECIONAR = '*, contratos(id, imovel, inquilino_id, valor_aluguel, inquilinos(nome))';

export default rota(async (req, res) => {
  const supabase = criarCliente(req);
  const usuario = await exigirUsuario(supabase, req);
  const perfil = await obterPerfil(supabase, usuario);
  const anfitriao = perfil.papel === 'anfitriao';
  const id = req.query.id;

  if (req.method === 'GET') {
    let consulta = supabase.from('pagamentos_informados').select(SELECIONAR).order('criado_em', { ascending: false });
    if (req.query.status) consulta = consulta.eq('status', req.query.status);
    if (req.query.contrato_id) consulta = consulta.eq('contrato_id', req.query.contrato_id);
    const { data, error } = await consulta;
    if (error) throw traduzirErroBanco(error);
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    if (anfitriao) throw new ErroApi(400, 'Para registrar um pagamento, use "Registrar pagamento" no contrato.');
    const dados = limparCampos(req.body, [
      'contrato_id',
      'referencia',
      'data_pagamento',
      'valor',
      'forma',
      'comprovante_nome',
      'comprovante_caminho',
      'observacao',
    ]);
    exigirCampos(
      dados,
      { contrato_id: 'Contrato', referencia: 'Mês do aluguel', data_pagamento: 'Data do pagamento', valor: 'Valor pago' },
      'criar',
    );
    const mes = String(dados.referencia).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(mes)) throw new ErroApi(400, 'Mês do aluguel inválido.');
    dados.referencia = `${mes}-01`;
    if (!(Number(dados.valor) > 0)) throw new ErroApi(400, 'O valor pago precisa ser maior que zero.');
    if (dados.forma && !FORMAS.includes(dados.forma)) throw new ErroApi(400, 'Forma de pagamento inválida.');

    // Não deixa informar de novo um mês já pago ou que ainda está em conferência
    const [{ data: pago }, { data: emConferencia }] = await Promise.all([
      supabase.from('pagamentos').select('id').eq('contrato_id', dados.contrato_id).eq('referencia', dados.referencia).maybeSingle(),
      supabase
        .from('pagamentos_informados')
        .select('id')
        .eq('contrato_id', dados.contrato_id)
        .eq('referencia', dados.referencia)
        .eq('status', 'Aguardando')
        .maybeSingle(),
    ]);
    if (pago) throw new ErroApi(400, 'Este mês já consta como pago.');
    if (emConferencia) throw new ErroApi(400, 'Você já informou o pagamento deste mês. Aguarde a conferência do anfitrião.');

    const { data, error } = await supabase
      .from('pagamentos_informados')
      .insert({ ...dados, status: 'Aguardando' })
      .select(SELECIONAR)
      .single();
    if (error) throw traduzirErroBanco(error);
    return res.status(201).json(data);
  }

  if (req.method === 'PUT') {
    if (!anfitriao) throw new ErroApi(403, 'Apenas o anfitrião confere pagamentos.');
    if (!id) throw new ErroApi(400, 'Informe o id.');
    const { data: informe, error: erroBusca } = await supabase.from('pagamentos_informados').select('*').eq('id', id).maybeSingle();
    if (erroBusca) throw traduzirErroBanco(erroBusca);
    if (!informe) throw new ErroApi(404, 'Pagamento informado não encontrado.');
    if (informe.status !== 'Aguardando') throw new ErroApi(400, `Este pagamento já foi ${informe.status.toLowerCase()}.`);

    const corpo = req.body || {};
    const agora = new Date().toISOString();

    if (corpo.acao === 'confirmar') {
      const valor = Number(corpo.valor ?? informe.valor);
      if (!(valor > 0)) throw new ErroApi(400, 'O valor precisa ser maior que zero.');
      const { data: pagamento, error } = await supabase
        .from('pagamentos')
        .insert({
          contrato_id: informe.contrato_id,
          referencia: informe.referencia,
          data_pagamento: informe.data_pagamento,
          valor_pago: valor,
          forma: informe.forma,
          observacoes: ['Informado pelo inquilino, com comprovante.', informe.observacao].filter(Boolean).join(' '),
        })
        .select('id')
        .single();
      if (error) {
        if (error.code === '23505') throw new ErroApi(400, 'Este mês já tem pagamento registrado. Recuse este aviso ou corrija o pagamento.');
        throw traduzirErroBanco(error);
      }
      const { error: erroAtualizar } = await supabase
        .from('pagamentos_informados')
        .update({ status: 'Confirmado', pagamento_id: pagamento.id, analisado_em: agora })
        .eq('id', id);
      if (erroAtualizar) throw traduzirErroBanco(erroAtualizar);
      return res.status(200).json({ ok: true, pagamento_id: pagamento.id });
    }

    if (corpo.acao === 'recusar') {
      const motivo = String(corpo.motivo || '').trim();
      if (!motivo) throw new ErroApi(400, 'Explique ao inquilino o motivo da recusa.');
      const { error } = await supabase
        .from('pagamentos_informados')
        .update({ status: 'Recusado', motivo_recusa: motivo, analisado_em: agora })
        .eq('id', id);
      if (error) throw traduzirErroBanco(error);
      return res.status(200).json({ ok: true });
    }

    throw new ErroApi(400, 'Ação inválida.');
  }

  if (req.method === 'DELETE') {
    if (!anfitriao) throw new ErroApi(403, 'Apenas o anfitrião pode excluir.');
    if (!id) throw new ErroApi(400, 'Informe o id.');
    const { data: informe } = await supabase.from('pagamentos_informados').select('comprovante_caminho').eq('id', id).maybeSingle();
    const { error } = await supabase.from('pagamentos_informados').delete().eq('id', id);
    if (error) throw traduzirErroBanco(error);
    if (informe?.comprovante_caminho) await supabase.storage.from('comprovantes').remove([informe.comprovante_caminho]);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  throw new ErroApi(405, 'Método não permitido.');
});
