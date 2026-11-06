// Foto/iniciais do usuário, menu do canto superior e tela "Meu perfil".
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { supabase } from '../supabaseClient';
import { Campo, Modal, useUI } from './UI';
import { iniciais, mascaraTelefone } from '../utils';

export function Avatar({ nome, foto, tamanho = 36 }) {
  const [falhou, setFalhou] = useState(false);
  useEffect(() => setFalhou(false), [foto]);
  const estilo = { width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.36) };
  if (foto && !falhou) {
    return <img className="avatar avatar-foto" src={foto} alt={nome || ''} style={estilo} onError={() => setFalhou(true)} />;
  }
  return (
    <span className="avatar" style={estilo} aria-hidden="true">
      {iniciais(nome)}
    </span>
  );
}

export function MenuUsuario({ perfil, aoEditarPerfil, rotuloPapel }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => caixa.current && !caixa.current.contains(e.target) && setAberto(false);
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  return (
    <div className="menu-usuario" ref={caixa}>
      <button className="menu-usuario-botao" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
        <Avatar nome={perfil.nome || perfil.email} foto={perfil.foto_url} tamanho={34} />
        <span className="menu-usuario-nome">
          <strong>{perfil.nome || perfil.email}</strong>
          <small>{rotuloPapel}</small>
        </span>
        <span className="menu-seta">▾</span>
      </button>
      {aberto && (
        <div className="menu-suspenso">
          <div className="menu-suspenso-topo">
            <strong>{perfil.nome}</strong>
            <span>{perfil.email}</span>
          </div>
          <button
            onClick={() => {
              setAberto(false);
              aoEditarPerfil();
            }}
          >
            Meu perfil
          </button>
          <button className="sair" onClick={() => supabase.auth.signOut()}>
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];

export function ModalPerfil({ perfil, aoFechar, aoSalvar }) {
  const { avisar } = useUI();
  const [nome, setNome] = useState(perfil.nome || '');
  const [telefone, setTelefone] = useState(perfil.telefone || '');
  const [foto, setFoto] = useState(perfil.foto_url || '');
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function trocarFoto(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    if (!TIPOS_FOTO.includes(arquivo.type)) return avisar('Use uma imagem JPG, PNG ou WEBP.', 'erro');
    if (arquivo.size > 2 * 1024 * 1024) return avisar('A foto precisa ter no máximo 2 MB.', 'erro');

    setEnviandoFoto(true);
    const extensao = arquivo.type.split('/')[1].replace('jpeg', 'jpg');
    const caminho = `${perfil.id}/${Date.now()}.${extensao}`;
    const { error } = await supabase.storage.from('fotos').upload(caminho, arquivo, { contentType: arquivo.type });
    setEnviandoFoto(false);
    if (error) return avisar('Não foi possível enviar a foto.', 'erro');
    const { data } = supabase.storage.from('fotos').getPublicUrl(caminho);
    setFoto(data.publicUrl);
  }

  async function salvar(e) {
    e.preventDefault();
    if (!nome.trim()) return avisar('Informe seu nome.', 'erro');
    setSalvando(true);
    try {
      const atualizado = await api.salvarPerfil({ nome, telefone, foto_url: foto });
      avisar('Perfil atualizado.');
      aoSalvar(atualizado);
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Meu perfil" aoFechar={aoFechar} pequeno>
      <form onSubmit={salvar}>
        <div className="perfil-foto">
          <Avatar nome={nome || perfil.email} foto={foto} tamanho={88} />
          <div className="botoes">
            <label className="botao botao-secundario botao-pequeno">
              {enviandoFoto ? 'Enviando…' : foto ? 'Trocar foto' : 'Adicionar foto'}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={trocarFoto} hidden />
            </label>
            {foto && (
              <button type="button" className="botao botao-pequeno botao-perigo-leve" onClick={() => setFoto('')}>
                Remover
              </button>
            )}
          </div>
          <span className="texto-suave pequeno">JPG, PNG ou WEBP de até 2 MB</span>
        </div>

        <Campo rotulo="Nome" obrigatorio>
          <input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </Campo>
        <Campo rotulo="Telefone / WhatsApp">
          <input value={telefone} onChange={(e) => setTelefone(mascaraTelefone(e.target.value))} inputMode="tel" placeholder="(00) 00000-0000" />
        </Campo>
        <Campo rotulo="E-mail de acesso" dica="O e-mail de login não pode ser alterado aqui.">
          <input value={perfil.email || ''} disabled />
        </Campo>

        <div className="modal-acoes">
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="botao botao-primario" disabled={salvando || enviandoFoto}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
