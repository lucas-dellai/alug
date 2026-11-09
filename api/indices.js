// Busca o acumulado dos últimos 12 meses do IGP-M ou do IPCA
// na API pública do Banco Central (SGS): /api/indices?indice=IGP-M
import { ErroApi, rota } from './_lib/supabase.js';

const SERIES = {
  'IGP-M': 189,
  IPCA: 433,
};

const dataBCB = (d) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

// Tenta buscar uma URL do Banco Central e devolve a lista de meses (ou null)
async function buscar(url) {
  try {
    const resposta = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Alug/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!resposta.ok) return null;
    const dados = await resposta.json().catch(() => null);
    return Array.isArray(dados) && dados.length ? dados : null;
  } catch {
    return null;
  }
}

export default rota(async (req, res) => {
  if (req.method !== 'GET') throw new ErroApi(405, 'Método não permitido.');

  const indice = req.query.indice;
  const codigo = SERIES[indice];
  if (!codigo) throw new ErroApi(400, 'Índice inválido. Use IGP-M ou IPCA.');

  const base = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados`;

  // 1ª tentativa: "últimos 12". 2ª tentativa: por período (últimos 18 meses).
  let meses = await buscar(`${base}/ultimos/12?formato=json`);
  if (!meses) {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 18, 1);
    meses = await buscar(`${base}?formato=json&dataInicial=${dataBCB(inicio)}&dataFinal=${dataBCB(hoje)}`);
  }
  if (!meses) {
    throw new ErroApi(502, 'Não foi possível consultar o Banco Central agora. Digite o percentual manualmente.');
  }
  meses = meses.slice(-12);

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
