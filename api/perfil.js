// Perfil de quem está logado: /api/perfil
//   GET -> dados do perfil (e o contato do anfitrião, quando for inquilino)
//   PUT -> atualiza nome, telefone, foto e (anfitrião) os dados do Pix
import {
  ErroApi,
  criarCliente,
  exigirCampos,
  exigirUsuario,
  limparCampos,
  rota,
  traduzirErroBanco,
} from './_lib/supabase.js';

export default rota(async (req, res) => {
  const supabase = criarCliente(req);
  const usuario = await exigirUsuario(supabase, req);

  if (req.method === 'GET') {
    const { data: perfil, error } = await supabase.from('perfis').select('*').eq('id', usuario.id).maybeSingle();
    if (error) throw traduzirErroBanco(error);
    if (!perfil) throw new ErroApi(403, 'Seu acesso ainda não foi configurado. Fale com o anfitrião.');

    let anfitriao = null;
    if (perfil.papel === 'inquilino') {
      const { data } = await supabase
        .from('perfis')
        .select('nome, telefone, foto_url, email, pix_tipo, pix_chave, pix_banco, pix_favorecido')
        .eq('papel', 'anfitriao')
        .order('criado_em')
        .limit(1)
        .maybeSingle();
      anfitriao = data;
    }
    return res.status(200).json({ ...perfil, email: usuario.email, anfitriao });
  }

  if (req.method === 'PUT') {
    const dados = limparCampos(req.body, ['nome', 'telefone', 'foto_url', 'pix_tipo', 'pix_chave', 'pix_banco', 'pix_favorecido']);
    exigirCampos(dados, { nome: 'Nome' }, 'atualizar');
    const TIPOS_PIX = ['CPF', 'CNPJ', 'E-mail', 'Telefone', 'Chave aleatória'];
    if (dados.pix_tipo && !TIPOS_PIX.includes(dados.pix_tipo)) throw new ErroApi(400, 'Tipo de chave Pix inválido.');
    for (const campo of ['pix_chave', 'pix_banco', 'pix_favorecido']) {
      if (typeof dados[campo] === 'string') dados[campo] = dados[campo].trim().slice(0, 120) || null;
    }
    const { data, error } = await supabase.from('perfis').update(dados).eq('id', usuario.id).select('*').single();
    if (error) throw traduzirErroBanco(error);
    return res.status(200).json({ ...data, email: usuario.email });
  }

  res.setHeader('Allow', 'GET, PUT');
  throw new ErroApi(405, 'Método não permitido.');
});
