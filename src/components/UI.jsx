// Componentes visuais reaproveitados em todo o app:
// avisos (toasts), janela de confirmação, modal, campo de formulário e etiquetas.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [avisos, setAvisos] = useState([]);
  const [confirmacao, setConfirmacao] = useState(null);

  const avisar = useCallback((texto, tipo = 'sucesso') => {
    const id = Date.now() + Math.random();
    setAvisos((lista) => [...lista, { id, texto, tipo }]);
    setTimeout(() => setAvisos((lista) => lista.filter((a) => a.id !== id)), 4500);
  }, []);

  const confirmar = useCallback(
    (titulo, texto, rotuloBotao = 'Excluir', perigoso = rotuloBotao === 'Excluir' || rotuloBotao.startsWith('Remover')) =>
      new Promise((resolve) => setConfirmacao({ titulo, texto, rotuloBotao, perigoso, resolve })),
    [],
  );

  function responder(resposta) {
    confirmacao?.resolve(resposta);
    setConfirmacao(null);
  }

  return (
    <UIContext.Provider value={{ avisar, confirmar }}>
      {children}

      <div className="avisos" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className={`aviso aviso-${a.tipo}`}>
            <span className="aviso-icone">{a.tipo === 'erro' ? '!' : '✓'}</span>
            {a.texto}
          </div>
        ))}
      </div>

      {confirmacao && (
        <Modal titulo={confirmacao.titulo} aoFechar={() => responder(false)} pequeno>
          <p className="confirmacao-texto">{confirmacao.texto}</p>
          <div className="modal-acoes">
            <button className="botao botao-secundario" onClick={() => responder(false)}>
              Cancelar
            </button>
            <button
              className={`botao ${confirmacao.perigoso ? 'botao-perigo' : 'botao-primario'}`}
              onClick={() => responder(true)}
              autoFocus
            >
              {confirmacao.rotuloBotao}
            </button>
          </div>
        </Modal>
      )}
    </UIContext.Provider>
  );
}

export const useUI = () => useContext(UIContext);

export function Modal({ titulo, subtitulo, aoFechar, children, pequeno, largo }) {
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', tecla);
    document.body.classList.add('sem-rolagem');
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.classList.remove('sem-rolagem');
    };
  }, [aoFechar]);

  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div
        className={`modal ${pequeno ? 'modal-pequeno' : ''} ${largo ? 'modal-largo' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <div className="modal-topo">
          <div>
            <h2>{titulo}</h2>
            {subtitulo && <p className="modal-subtitulo">{subtitulo}</p>}
          </div>
          <button className="botao-icone" onClick={aoFechar} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="modal-corpo">{children}</div>
      </div>
    </div>
  );
}

export function Campo({ rotulo, obrigatorio, dica, largo, children }) {
  return (
    <label className={`campo ${largo ? 'campo-largo' : ''}`}>
      <span className="campo-rotulo">
        {rotulo}
        {obrigatorio && <span className="obrigatorio"> *</span>}
      </span>
      {children}
      {dica && <span className="campo-dica">{dica}</span>}
    </label>
  );
}

const CORES_STATUS = {
  'Em dia': 'verde',
  Pendente: 'amarelo',
  Atrasado: 'vermelho',
  Aberta: 'azul',
  'Em análise': 'amarelo',
  'Em andamento': 'roxo',
  Concluída: 'verde',
  Recusada: 'vermelho',
  Alta: 'vermelho',
  Média: 'amarelo',
  Baixa: 'cinza',
  ativo: 'verde',
  vencendo: 'amarelo',
  encerrado: 'vermelho',
};

export function Etiqueta({ valor, cor, children }) {
  return <span className={`etiqueta etiqueta-${cor || CORES_STATUS[valor] || 'cinza'}`}>{children ?? valor}</span>;
}

export function Vazio({ titulo, texto, children }) {
  return (
    <div className="vazio">
      <div className="vazio-icone">⌂</div>
      <h3>{titulo}</h3>
      {texto && <p>{texto}</p>}
      {children}
    </div>
  );
}

export function Carregando({ texto = 'Carregando…' }) {
  return (
    <div className="carregando">
      <span className="girando" /> {texto}
    </div>
  );
}
