import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { api } from './api';
import { APP } from './config';
import { useUI, Carregando } from './components/UI';
import Login from './components/Login';
import Inicio from './components/Inicio';
import Contratos from './components/Contratos';
import Inquilinos from './components/Inquilinos';
import Solicitacoes from './components/Solicitacoes';
import Custos from './components/Custos';
import Imoveis from './components/Imoveis';
import Portal from './components/Portal';
import { MenuUsuario, ModalPerfil } from './components/Perfil';

export default function App() {
  const [sessao, setSessao] = useState(null);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setVerificando(false);
      return undefined;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setVerificando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => setSessao(novaSessao));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabase) return <ConfiguracaoFaltando />;
  if (verificando) return <div className="tela-cheia"><Carregando /></div>;
  if (!sessao) return <Login />;
  return <Entrada key={sessao.user.id} />;
}

// Depois do login: descobre se é anfitrião ou inquilino e abre a tela certa
function Entrada() {
  const [perfil, setPerfil] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .perfil()
      .then(setPerfil)
      .catch((e) => setErro(e.message));
  }, []);

  if (erro) {
    return (
      <div className="tela-cheia">
        <div className="cartao cartao-centro">
          <h1>Não foi possível entrar</h1>
          <p className="texto-suave">{erro}</p>
          <button className="botao botao-secundario" onClick={() => supabase.auth.signOut()}>
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }
  if (!perfil) return <div className="tela-cheia"><Carregando texto="Abrindo…" /></div>;
  if (perfil.papel === 'inquilino') return <Portal perfil={perfil} setPerfil={setPerfil} />;
  return <Sistema perfil={perfil} setPerfil={setPerfil} />;
}

const ABAS = [
  { id: 'inicio', rotulo: 'Início', icone: 'M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { id: 'imoveis', rotulo: 'Imóveis', icone: 'M3 21h18M5 21V9l7-5 7 5v12M10 21v-5h4v5M9 11h.01M15 11h.01' },
  { id: 'contratos', rotulo: 'Contratos', icone: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm6 1v5h5M9 13h7M9 17h5' },
  { id: 'inquilinos', rotulo: 'Inquilinos', icone: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 10a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6' },
  { id: 'solicitacoes', rotulo: 'Solicitações', icone: 'M4 4h5v16H4zM10 4h5v10h-5zM16 4h4v13h-4z' },
];

function Icone({ caminho }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={caminho} />
    </svg>
  );
}

function Sistema({ perfil, setPerfil }) {
  const { avisar } = useUI();
  const [aba, setAba] = useState('inicio');
  const [inquilinoAberto, setInquilinoAberto] = useState(null);
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [filtroContratos, setFiltroContratos] = useState(null);
  const [mesCustos, setMesCustos] = useState(null);
  const [dados, setDados] = useState({ inquilinos: [], contratos: [], solicitacoes: [], pagamentos: [], custos: [], imoveis: [], comunicados: [], informes: [], advertencias: [], regras: undefined });
  const [carregando, setCarregando] = useState(true);

  // Busca tudo na API (READ)
  const recarregar = useCallback(async () => {
    try {
      const [inquilinos, contratos, solicitacoes, pagamentos, regras, custos, imoveis, comunicados, informes, advertencias] = await Promise.all([
        api.listar('inquilinos'),
        api.listar('contratos'),
        api.listar('solicitacoes'),
        api.listar('pagamentos'),
        api.listar('configuracoes').catch(() => undefined),
        api.listar('custos').catch(() => []),
        api.listar('imoveis').catch(() => []),
        api.listar('comunicados').catch(() => []),
        api.listar('informes', { status: 'Aguardando' }).catch(() => []),
        api.listar('advertencias').catch(() => []),
      ]);
      setDados({ inquilinos, contratos, solicitacoes, pagamentos, regras, custos, imoveis, comunicados, informes, advertencias });
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setCarregando(false);
    }
  }, [avisar]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  function abrirInquilino(id) {
    setInquilinoAberto(id);
    setAba('inquilinos');
    window.scrollTo(0, 0);
  }

  // filtro: usado quando um cartão do Início abre a lista de contratos já filtrada
  function trocarAba(id, filtro = null) {
    setAba(id);
    if (id === 'contratos') setFiltroContratos(filtro);
    if (id === 'custos') setMesCustos(filtro?.mes || null);
    if (id === 'inquilinos') setInquilinoAberto(null);
    window.scrollTo(0, 0);
  }

  const abertas = dados.solicitacoes.filter((s) => !['Concluída', 'Recusada'].includes(s.status)).length;

  const botoesAbas = (classe) =>
    ABAS.map((a) => (
      <button
        key={a.id}
        className={`${classe} ${(aba === 'custos' ? 'inicio' : aba) === a.id ? `${classe}-ativa` : ''}`}
        onClick={() => trocarAba(a.id)}
        aria-current={aba === a.id ? 'page' : undefined}
      >
        <Icone caminho={a.icone} />
        <span>{a.rotulo}</span>
        {a.id === 'solicitacoes' && abertas > 0 && <span className="aba-contador">{abertas}</span>}
      </button>
    ));

  return (
    <div className="app">
      <header className="cabecalho">
        <div className="cabecalho-conteudo">
          <div className="marca">
            <img src={APP.logo} alt="" width="34" height="34" />
            <div>
              <strong>{APP.nome}</strong>
              <span>{APP.slogan}</span>
            </div>
          </div>

          <nav className="abas" aria-label="Seções">
            {botoesAbas('aba')}
          </nav>

          <MenuUsuario perfil={perfil} rotuloPapel="Anfitrião" aoEditarPerfil={() => setEditandoPerfil(true)} />
        </div>
      </header>

      <main className="conteudo">
        {carregando ? (
          <Carregando texto="Buscando seus dados…" />
        ) : (
          <>
            {aba === 'inicio' && (
              <Inicio {...dados} perfil={perfil} recarregar={recarregar} abrirInquilino={abrirInquilino} irPara={trocarAba} />
            )}
            {aba === 'imoveis' && <Imoveis {...dados} recarregar={recarregar} abrirInquilino={abrirInquilino} />}
            {aba === 'contratos' && (
              <Contratos
                key={JSON.stringify(filtroContratos)}
                {...dados}
                filtroInicial={filtroContratos}
                recarregar={recarregar}
                abrirInquilino={abrirInquilino}
                irPara={trocarAba}
              />
            )}
            {aba === 'inquilinos' && (
              <Inquilinos {...dados} recarregar={recarregar} abertoId={inquilinoAberto} abrir={setInquilinoAberto} />
            )}
            {aba === 'solicitacoes' && (
              <Solicitacoes {...dados} recarregar={recarregar} abrirInquilino={abrirInquilino} />
            )}
            {aba === 'custos' && (
              <Custos
                {...dados}
                key={mesCustos || 'atual'}
                mesInicial={mesCustos}
                recarregar={recarregar}
                abrirInquilino={abrirInquilino}
                voltar={() => trocarAba('inicio')}
              />
            )}
          </>
        )}
      </main>

      <footer className="rodape">{APP.nome} · Projeto acadêmico de Lucas Dellai · React + Vercel + Supabase</footer>

      {/* Barra de navegação de baixo, só no celular */}
      <nav className="nav-inferior" aria-label="Seções">
        {botoesAbas('nav-item')}
      </nav>

      {editandoPerfil && (
        <ModalPerfil
          perfil={perfil}
          aoFechar={() => setEditandoPerfil(false)}
          aoSalvar={(novo) => {
            setPerfil((p) => ({ ...p, ...novo }));
            setEditandoPerfil(false);
          }}
        />
      )}
    </div>
  );
}

function ConfiguracaoFaltando() {
  return (
    <div className="tela-cheia">
      <div className="cartao cartao-centro">
        <h1>Quase lá!</h1>
        <p>
          Falta configurar as variáveis <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no Vercel
          (Settings → Environment Variables). Depois, faça um novo deploy.
        </p>
      </div>
    </div>
  );
}
