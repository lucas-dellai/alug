// Busca o acumulado dos últimos 12 meses do IGP-M ou do IPCA
// na API pública do Banco Central (SGS): /api/indices?indice=IGP-M
import { ErroApi, rota } from './_lib/supabase.js';

const SERIES = {
  'IGP-M': 189,
  IPCA: 433,
};

export default rota(async (req, res) => {
  if (req.method !== 'GET') throw new ErroApi(405, 'Método não permitido.');

  const indice = req.query.indice;
  const codigo = SERIES[indice];
  if (!codigo) throw new ErroApi(400, 'Índice inválido. Use IGP-M ou IPCA.');

  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados/ultimos/12?formato=json`;
  const falha = 'Não foi possível consultar o Banco Central agora. Digite o percentual manualmente.';

  let resposta;
  try {
    resposta = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  } catch {
    throw new ErroApi(502, falha);
  }
  if (!resposta.ok) throw new ErroApi(502, falha);

  const meses = await resposta.json().catch(() => null);
  if (!Array.isArray(meses) || !meses.length) throw new ErroApi(502, falha);

  // Acumulado = (1 + taxa1) x (1 + taxa2) x ... - 1
  const fator = meses.reduce((total, mes) => total * (1 + parseFloat(String(mes.valor).replace(',', '.')) / 100), 1);
  const acumulado = Math.round((fator - 1) * 10000) / 100;

  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
  res.status(200).json({
    indice,
    acumulado,
    inicio: meses[0].data,
    fim: meses[meses.length - 1].data,
    meses: meses.map((m) => ({ data: m.data, valor: Number(String(m.valor).replace(',', '.')) })),
  });
});
