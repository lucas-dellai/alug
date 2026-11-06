// Na ficha do inquilino: criar, trocar a senha ou remover o acesso dele ao Portal do Inquilino.
import { useEffect, useState } from 'react';
import { api } from '../api';
import { Campo, Carregando, Modal, useUI } from './UI';
import { dataBR } from '../utils';

export default function AcessoPortal({ inquilino }) {
  const { avisar, confirmar } = useUI();
  const [acesso, setAcesso] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(null); // 'criar' | 'senha'

  async function carregar() {
    try {
      const resposta = await api.verAcesso(inquilino.id);
      setAcesso(resposta.acesso);
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquilino.id]);

  async function remover() {
    const ok = await confirmar(
      'Remover acesso ao portal?',
      `${inquilino.nome} não vai mais conseguir entrar no sistema. Os dados dele continuam guardados.`,
      'Remover acesso',
    );
    if (!ok) return;
    try {
      await api.removerAcesso(inquilino.id);
      avisar('Acesso removido.');
      setAcesso(null);
    } catch (erro) {
      avisar(erro.message, 'erro');
    }
  }

  return (
    <section className="cartao acesso-portal">
      <h2>Acesso ao Portal do Inquilino</h2>
      {carregando ? (
        <Carregando />
      ) : acesso ? (
        <>
          <p className="acesso-status">
            <span className="ponto-verde" /> Acesso ativo desde {dataBR(acesso.criado_em)}
          </p>
          <p className="texto-suave">
            Login: <strong>{acesso.email}</strong>
          </p>
          <div className="botoes">
            <button className="botao botao-pequeno botao-secundario" onClick={() => setModal('senha')}>
              Definir nova senha
            </button>
            <button className="botao botao-pequeno botao-perigo-leve" onClick={remover}>
              Remover acesso
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="texto-suave">
            Com acesso, o inquilino vê o próprio contrato, o valor a pagar e os documentos, e pode abrir solicitações
            pelo celular.
          </p>
          <button className="botao botao-primario botao-pequeno" onClick={() => setModal('criar')}>
            Criar acesso
          </button>
        </>
      )}

      {modal && (
        <ModalAcesso
          modo={modal}
          inquilino={inquilino}
          aoFechar={() => setModal(null)}
          aoSalvar={() => {
            setModal(null);
            carregar();
          }}
        />
      )}
    </section>
  );
}

function ModalAcesso({ modo, inquilino, aoFechar, aoSalvar }) {
  const { avisar } = useUI();
  const [email, setEmail] = useState(inquilino.email || '');
  const [senha, setSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const criando = modo === 'criar';

  async function enviar(e) {
    e.preventDefault();
    if (senha.length < 6) return avisar('A senha precisa ter pelo menos 6 caracteres.', 'erro');
    setSalvando(true);
    try {
      if (criando) await api.criarAcesso(inquilino.id, email, senha);
      else await api.trocarSenhaAcesso(inquilino.id, senha);
      avisar(criando ? `Acesso criado. Envie o e-mail e a senha para ${inquilino.nome}.` : 'Senha alterada.');
      aoSalvar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={criando ? 'Criar acesso ao portal' : 'Definir nova senha'} subtitulo={inquilino.nome} aoFechar={aoFechar} pequeno>
      <form onSubmit={enviar}>
        {criando && (
          <Campo rotulo="E-mail de login" obrigatorio>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Campo>
        )}
        <Campo rotulo={criando ? 'Senha inicial' : 'Nova senha'} obrigatorio dica="Mínimo de 6 caracteres. Passe para o inquilino.">
          <input type="text" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} autoFocus={!criando} />
        </Campo>
        <div className="modal-acoes">
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="botao botao-primario" disabled={salvando}>
            {salvando ? 'Salvando…' : criando ? 'Criar acesso' : 'Salvar senha'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
