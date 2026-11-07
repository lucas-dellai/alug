// Rota única para várias tabelas: /api/custos, /api/anexos, /api/mensagens, /api/imoveis, /api/comunicados, /api/informes
// (o plano gratuito do Vercel aceita até 12 rotas de servidor, então juntamos as menores aqui)
import custos from './_lib/recursos/custos.js';
import anexos from './_lib/recursos/anexos.js';
import mensagens from './_lib/recursos/mensagens.js';
import imoveis from './_lib/recursos/imoveis.js';
import comunicados from './_lib/recursos/comunicados.js';
import informes from './_lib/recursos/informes.js';
import extras from './_lib/recursos/extras.js';
import advertencias from './_lib/recursos/advertencias.js';

const RECURSOS = { custos, anexos, mensagens, imoveis, comunicados, informes, extras, advertencias };

export default async function handler(req, res) {
  const tratar = RECURSOS[req.query.recurso];
  if (!tratar) return res.status(404).json({ erro: 'Rota não encontrada.' });
  return tratar(req, res);
}
