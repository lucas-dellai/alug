// Funções para conversar com a nossa API (back-end).
import { supabase } from './supabaseClient';

async function requisicao(metodo, caminho, corpo) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  const resposta = await fetch(`/api/${caminho}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });

  const json = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    if (resposta.status === 401) await supabase.auth.signOut();
    throw new Error(json.erro || 'Algo deu errado. Tente novamente.');
  }
  return json;
}

function montarFiltros(filtros) {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtros || {})) {
    if (valor !== undefined && valor !== null && valor !== '') params.set(chave, valor);
  }
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}

export const api = {
  listar: (recurso, filtros) => requisicao('GET', `${recurso}${montarFiltros(filtros)}`),
  criar: (recurso, dados) => requisicao('POST', recurso, dados),
  atualizar: (recurso, id, dados) => requisicao('PUT', `${recurso}?id=${id}`, dados),
  excluir: (recurso, id) => requisicao('DELETE', `${recurso}?id=${id}`),
  indice: (nome) => requisicao('GET', `indices?indice=${encodeURIComponent(nome)}`),

  // Regras de cobrança (multa, juros e tolerância)
  atualizarRegras: (dados) => requisicao('PUT', 'configuracoes', dados),

  // Perfil de quem está logado
  perfil: () => requisicao('GET', 'perfil'),
  salvarPerfil: (dados) => requisicao('PUT', 'perfil', dados),

  // Acesso do inquilino ao portal
  verAcesso: (inquilinoId) => requisicao('GET', `acessos?inquilino_id=${inquilinoId}`),
  criarAcesso: (inquilinoId, email, senha) => requisicao('POST', 'acessos', { inquilino_id: inquilinoId, email, senha }),
  trocarSenhaAcesso: (inquilinoId, senha) => requisicao('PUT', `acessos?inquilino_id=${inquilinoId}`, { senha }),
  removerAcesso: (inquilinoId) => requisicao('DELETE', `acessos?inquilino_id=${inquilinoId}`),
};

// Erro de perfil não configurado (para mostrar a mensagem certa)
export const ERRO_SEM_PERFIL = 'Seu acesso ainda não foi configurado';
