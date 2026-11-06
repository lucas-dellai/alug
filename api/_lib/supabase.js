// Funções de apoio usadas por todas as rotas da API (back-end).
// Arquivos dentro de "_lib" não viram rotas no Vercel por começarem com "_".
import { createClient } from '@supabase/supabase-js';

// Erro com código HTTP, para responder ao front-end com a mensagem certa.
export class ErroApi extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

// Cria a conexão com o Supabase usando o login de quem fez a requisição.
// Assim as regras de segurança do banco (RLS) valem também aqui no back-end.
export function criarCliente(req) {
  const url = process.env.VITE_SUPABASE_URL;
  const chave = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !chave) {
    throw new ErroApi(500, 'As variáveis do Supabase não foram configuradas no Vercel.');
  }
  return createClient(url, chave, {
    global: { headers: { Authorization: req.headers.authorization || '' } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// Garante que só usuários logados usem a API.
export async function exigirUsuario(supabase, req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || token === 'undefined') {
    throw new ErroApi(401, 'Faça login para continuar.');
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new ErroApi(401, 'Sua sessão expirou. Entre novamente.');
  }
  return data.user;
}

// Busca o perfil de quem está logado: anfitrião ou inquilino.
export async function obterPerfil(supabase, usuario) {
  const { data, error } = await supabase
    .from('perfis')
    .select('id, nome, papel, inquilino_id')
    .eq('id', usuario.id)
    .maybeSingle();
  if (error) throw traduzirErroBanco(error);
  if (!data) throw new ErroApi(403, 'Seu acesso ainda não foi configurado. Fale com o anfitrião.');
  return data;
}

// Conexão "administradora", só para o back-end (criar e remover acessos de inquilinos).
// Usa a chave secreta, que fica só no Vercel e nunca vai para o navegador.
export function criarClienteAdmin() {
  const url = process.env.VITE_SUPABASE_URL;
  const chaveSecreta = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chaveSecreta) {
    throw new ErroApi(500, 'Falta configurar a variável SUPABASE_SERVICE_ROLE_KEY no Vercel.');
  }
  return createClient(url, chaveSecreta, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// Traduz erros do banco de dados para mensagens em português.
export function traduzirErroBanco(error) {
  switch (error?.code) {
    case '23503':
      return new ErroApi(409, 'Este registro está ligado a outros e não pode ser excluído.');
    case '23505':
      return new ErroApi(409, 'Já existe um registro igual. Para pagamentos: esse mês já foi registrado.');
    case '23514':
      return new ErroApi(400, 'Algum valor não é permitido. Confira os campos.');
    case '23502':
      return new ErroApi(400, 'Preencha todos os campos obrigatórios.');
    case '22P02':
    case '22007':
    case '22008':
      return new ErroApi(400, 'Algum campo está em formato inválido.');
    case '42501':
      return new ErroApi(403, 'Você não tem permissão para fazer isso.');
    case '42P01':
      return new ErroApi(500, 'Tabela não encontrada. Confira se os scripts SQL foram executados no Supabase.');
    case 'PGRST116':
      return new ErroApi(404, 'Registro não encontrado.');
    default:
      return new ErroApi(500, error?.message || 'Erro no banco de dados.');
  }
}

// Mantém só os campos permitidos e troca textos vazios por "vazio" (null).
export function limparCampos(corpo, campos) {
  const dados = {};
  for (const campo of campos) {
    if (corpo && Object.prototype.hasOwnProperty.call(corpo, campo)) {
      let valor = corpo[campo];
      if (typeof valor === 'string') valor = valor.trim();
      dados[campo] = valor === '' || valor === undefined ? null : valor;
    }
  }
  return dados;
}

// Confere campos obrigatórios. Ao criar, todos precisam existir.
// Ao atualizar, só confere os que foram enviados.
export function exigirCampos(dados, obrigatorios, modo) {
  for (const [campo, rotulo] of Object.entries(obrigatorios)) {
    const enviado = Object.prototype.hasOwnProperty.call(dados, campo);
    if (modo === 'criar' || enviado) {
      const valor = dados[campo];
      if (valor === null || valor === undefined || String(valor).trim() === '') {
        throw new ErroApi(400, `O campo "${rotulo}" é obrigatório.`);
      }
    }
  }
}

// Envolve a rota para tratar qualquer erro e responder em JSON.
export function rota(funcao) {
  return async (req, res) => {
    try {
      await funcao(req, res);
    } catch (erro) {
      const status = erro.status || 500;
      if (status === 500) console.error(erro);
      res.status(status).json({ erro: erro.message || 'Erro inesperado.' });
    }
  };
}
