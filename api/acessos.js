// Acesso do inquilino ao portal: /api/acessos?inquilino_id=1
//   GET    -> mostra se o inquilino já tem login
//   POST   -> cria o login do inquilino (e-mail e senha)
//   PUT    -> define uma nova senha
//   DELETE -> remove o acesso
// Só o anfitrião usa esta rota.
import {
  ErroApi,
  criarCliente,
  criarClienteAdmin,
  exigirUsuario,
  obterPerfil,
  rota,
  traduzirErroBanco,
} from './_lib/supabase.js';

function validarSenha(senha) {
  if (!senha || String(senha).length < 6) {
    throw new ErroApi(400, 'A senha precisa ter pelo menos 6 caracteres.');
  }
}

export default rota(async (req, res) => {
  const supabase = criarCliente(req);
  const usuario = await exigirUsuario(supabase, req);
  const perfil = await obterPerfil(supabase, usuario);
  if (perfil.papel !== 'anfitriao') throw new ErroApi(403, 'Apenas o anfitrião pode gerenciar acessos.');

  const inquilinoId = Number(req.query.inquilino_id || req.body?.inquilino_id);
  if (!inquilinoId) throw new ErroApi(400, 'Informe o inquilino.');

  const { data: acesso, error } = await supabase
    .from('perfis')
    .select('id, email, criado_em')
    .eq('inquilino_id', inquilinoId)
    .maybeSingle();
  if (error) throw traduzirErroBanco(error);

  if (req.method === 'GET') {
    return res.status(200).json({ acesso: acesso || null });
  }

  if (req.method === 'POST') {
    if (acesso) throw new ErroApi(409, 'Este inquilino já tem acesso ao portal.');
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new ErroApi(400, 'Informe um e-mail válido.');
    validarSenha(req.body?.senha);

    const { data: inquilino } = await supabase.from('inquilinos').select('id, nome').eq('id', inquilinoId).maybeSingle();
    if (!inquilino) throw new ErroApi(404, 'Inquilino não encontrado.');

    const { error: erroCriar } = await criarClienteAdmin().auth.admin.createUser({
      email,
      password: req.body.senha,
      email_confirm: true,
      user_metadata: { papel: 'inquilino', inquilino_id: inquilinoId, nome: inquilino.nome },
    });
    if (erroCriar) {
      if (/already|registered|exists/i.test(erroCriar.message)) {
        throw new ErroApi(409, 'Este e-mail já está sendo usado por outro acesso.');
      }
      throw new ErroApi(400, erroCriar.message);
    }
    return res.status(201).json({ ok: true });
  }

  if (!acesso) throw new ErroApi(404, 'Este inquilino ainda não tem acesso ao portal.');

  if (req.method === 'PUT') {
    validarSenha(req.body?.senha);
    const { error: erroSenha } = await criarClienteAdmin().auth.admin.updateUserById(acesso.id, {
      password: req.body.senha,
    });
    if (erroSenha) throw new ErroApi(400, erroSenha.message);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { error: erroRemover } = await criarClienteAdmin().auth.admin.deleteUser(acesso.id);
    if (erroRemover) throw new ErroApi(400, erroRemover.message);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  throw new ErroApi(405, 'Método não permitido.');
});
