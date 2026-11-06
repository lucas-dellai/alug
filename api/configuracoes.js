// Configurações do anfitrião (engrenagem): /api/configuracoes
//   cobrança (multa, juros, tolerância), padrões para contratos novos e aviso de vencimento
//   GET -> regras atuais (ou as padrão, se ainda não foram salvas)
//   PUT -> salva as regras (só o anfitrião). Com "aplicar_todos", atualiza todos os contratos.
import {
  ErroApi,
  criarCliente,
  exigirUsuario,
  obterPerfil,
  rota,
  traduzirErroBanco,
} from './_lib/supabase.js';

const PADRAO = {
  cobrar_multa: true,
  multa_padrao: 2,
  cobrar_juros: true,
  juros_padrao: 1,
  dias_tolerancia: 0,
  indice_padrao: 'IGP-M',
  duracao_meses: 12,
  dia_vencimento_padrao: 10,
  aviso_vencimento_dias: 30,
};
const INDICES = ['IGP-M', 'IPCA', 'Livre'];

function inteiro(valor, minimo, maximo, mensagem) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < minimo || numero > maximo) throw new ErroApi(400, mensagem);
  return numero;
}

function percentual(valor, rotulo) {
  const numero = Number(valor);
  if (Number.isNaN(numero) || numero < 0 || numero > 100) {
    throw new ErroApi(400, `${rotulo} precisa ser um número entre 0 e 100.`);
  }
  return numero;
}

export default rota(async (req, res) => {
  const supabase = criarCliente(req);
  const usuario = await exigirUsuario(supabase, req);
  const perfil = await obterPerfil(supabase, usuario);

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('configuracoes').select('*').order('atualizado_em').limit(1).maybeSingle();
    if (error) throw traduzirErroBanco(error);
    return res.status(200).json({ ...PADRAO, ...(data || {}) });
  }

  if (req.method === 'PUT') {
    if (perfil.papel !== 'anfitriao') throw new ErroApi(403, 'Apenas o anfitrião pode alterar as configurações.');
    const corpo = req.body || {};
    const tolerancia = inteiro(corpo.dias_tolerancia ?? 0, 0, 31, 'A tolerância precisa ser de 0 a 31 dias.');
    const indice = corpo.indice_padrao ?? PADRAO.indice_padrao;
    if (!INDICES.includes(indice)) throw new ErroApi(400, 'Índice de reajuste inválido.');
    const regras = {
      id: usuario.id,
      cobrar_multa: Boolean(corpo.cobrar_multa),
      multa_padrao: percentual(corpo.multa_padrao ?? 0, 'A multa'),
      cobrar_juros: Boolean(corpo.cobrar_juros),
      juros_padrao: percentual(corpo.juros_padrao ?? 0, 'Os juros'),
      dias_tolerancia: tolerancia,
      indice_padrao: indice,
      duracao_meses: inteiro(corpo.duracao_meses ?? 12, 1, 120, 'A duração precisa ser de 1 a 120 meses.'),
      dia_vencimento_padrao: inteiro(corpo.dia_vencimento_padrao ?? 10, 1, 31, 'O dia de vencimento precisa ser de 1 a 31.'),
      aviso_vencimento_dias: inteiro(corpo.aviso_vencimento_dias ?? 30, 0, 180, 'O aviso precisa ser de 0 a 180 dias.'),
      atualizado_em: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('configuracoes').upsert(regras, { onConflict: 'id' }).select('*').single();
    if (error) throw traduzirErroBanco(error);

    // Opcional: aplica os percentuais em todos os contratos
    let contratosAtualizados = 0;
    if (corpo.aplicar_todos) {
      const { error: erroContratos, count } = await supabase
        .from('contratos')
        .update({ multa_atraso: regras.multa_padrao, juros_mes: regras.juros_padrao }, { count: 'exact' })
        .gte('id', 0);
      if (erroContratos) throw traduzirErroBanco(erroContratos);
      contratosAtualizados = count || 0;
    }
    return res.status(200).json({ ...data, contratosAtualizados });
  }

  res.setHeader('Allow', 'GET, PUT');
  throw new ErroApi(405, 'Método não permitido.');
});
