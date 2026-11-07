// Campos personalizados de um inquilino: /api/extras?inquilino_id=1  (só o anfitrião)
//   GET -> { valores: { c1: "780", c2: "2026-10-01" } }
//   PUT -> grava os valores
import { ErroApi, criarCliente, exigirUsuario, obterPerfil, rota, traduzirErroBanco } from '../supabase.js';

export default rota(async (req, res) => {
  const supabase = criarCliente(req);
  const usuario = await exigirUsuario(supabase, req);
  const perfil = await obterPerfil(supabase, usuario);
  if (perfil.papel !== 'anfitriao') throw new ErroApi(403, 'Apenas o anfitrião vê os campos personalizados.');

  const inquilinoId = Number(req.query.inquilino_id);
  if (!Number.isInteger(inquilinoId) || inquilinoId <= 0) throw new ErroApi(400, 'Informe o inquilino.');

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('inquilinos_extras').select('valores').eq('inquilino_id', inquilinoId).maybeSingle();
    if (error) throw traduzirErroBanco(error);
    return res.status(200).json({ valores: data?.valores || {} });
  }

  if (req.method === 'PUT') {
    const recebido = req.body?.valores;
    if (!recebido || typeof recebido !== 'object' || Array.isArray(recebido)) throw new ErroApi(400, 'Valores inválidos.');
    const valores = {};
    for (const [chave, valor] of Object.entries(recebido).slice(0, 30)) {
      if (!/^c[a-z0-9]{1,20}$/.test(chave)) continue;
      if (valor === null || valor === '') continue;
      valores[chave] = typeof valor === 'boolean' ? valor : String(valor).slice(0, 500);
    }
    const { error } = await supabase
      .from('inquilinos_extras')
      .upsert({ inquilino_id: inquilinoId, valores, atualizado_em: new Date().toISOString() }, { onConflict: 'inquilino_id' });
    if (error) throw traduzirErroBanco(error);
    return res.status(200).json({ valores });
  }

  res.setHeader('Allow', 'GET, PUT');
  throw new ErroApi(405, 'Método não permitido.');
});
