// Comunicados: o anfitrião envia para um inquilino e o inquilino confirma ou recusa no portal.
import { useEffect, useState } from 'react';
import { api } from '../api';
import { Campo, Carregando, Etiqueta, Modal, useUI } from './UI';
import { TIPOS_COMUNICADO, dataHoraBR, situacaoComunicado } from '../utils';

// Título sugerido para cada tipo (o anfitrião pode mudar)
const SUGESTOES = {
  Aviso: 'Aviso importante',
  Cobrança: 'Lembrete de pagamento do aluguel',
  'Visita ao imóvel': 'Visita ao imóvel',
  'Manutenção programada': 'Manutenção programada no imóvel',
  Reajuste: 'Reajuste anual do aluguel',
  Renovação: 'Renovação do contrato',
  'Regras do imóvel': 'Regras do imóvel',
  Outro: '',
};

// ---------- Lado do anfitrião (na ficha do inquilino) ----------
export function ComunicadosDoInquilino({ inquilino }) {
  const { avisar, confirmar } = useUI();
  const [temAcesso, setTemAcesso] = useState(null);
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  async function carregar() {
    try {
      setLista(await api.listar('comunicados', { inquilino_id: inquilino.id }));
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    api
      .verAcesso(inquilino.id)
      .then((r) => setTemAcesso(!!r?.acesso))
      .catch(() => setTemAcesso(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquilino.id]);

  async function excluir(c) {
    const ok = await confirmar('Excluir comunicado?', `"${c.titulo}" some também do portal do inquilino.`);
    if (!ok) return;
    try {
      await api.excluir('comunicados', c.id);
      avisar('Comunicado excluído.');
      carregar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    }
  }

  const aguardando = lista.filter((c) => c.pede_resposta && !c.resposta).length;

  return (
    <section className="cartao">
      <div className="cartao-topo">
        <h2>
          Comunicados {aguardando > 0 && <span className="contador">{aguardando} aguardando</span>}
        </h2>
        <button className="botao botao-pequeno botao-secundario" onClick={() => setEnviando(true)}>
          ✉ Enviar comunicado
        </button>
      </div>
      {temAcesso === false && (
        <p className="aviso-suave">
          {inquilino.nome.split(' ')[0]} ainda não tem acesso ao portal. O comunicado fica guardado e aparece quando você criar o acesso
          (em "Acesso ao Portal do Inquilino").
        </p>
      )}
      {carregando ? (
        <Carregando />
      ) : !lista.length ? (
        <p className="texto-suave">Nenhum comunicado enviado. Use para avisos, visitas, reajustes e combinados.</p>
      ) : (
        <ul className="lista-comunicados">
          {lista.map((c) => {
            const s = situacaoComunicado(c);
            return (
              <li key={c.id}>
                <div className="comunicado-topo">
                  <div>
                    <strong>{c.titulo}</strong>
                    <span className="sub">
                      {c.tipo} · enviado em {dataHoraBR(c.criado_em)}
                    </span>
                  </div>
                  <Etiqueta cor={s.cor}>{s.texto}</Etiqueta>
                </div>
                <p className="comunicado-texto">{c.mensagem}</p>
                {c.resposta && (
                  <p className={`comunicado-resposta resposta-${c.resposta === 'Confirmado' ? 'sim' : 'nao'}`}>
                    <strong>{c.resposta}</strong> em {dataHoraBR(c.respondido_em)}
                    {c.resposta_comentario && <>: “{c.resposta_comentario}”</>}
                  </p>
                )}
                <div className="comunicado-rodape">
                  <span className="sub">{c.lido_em ? `Lido em ${dataHoraBR(c.lido_em)}` : 'Ainda não foi lido'}</span>
                  <button className="botao botao-pequeno botao-perigo-leve" onClick={() => excluir(c)}>
                    Excluir
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {enviando && (
        <FormComunicado
          inquilino={inquilino}
          aoFechar={() => setEnviando(false)}
          aoSalvar={() => {
            setEnviando(false);
            carregar();
          }}
        />
      )}
    </section>
  );
}

function FormComunicado({ inquilino, aoFechar, aoSalvar }) {
  const { avisar } = useUI();
  const [salvando, setSalvando] = useState(false);
  const [v, setV] = useState({ tipo: 'Aviso', titulo: SUGESTOES.Aviso, mensagem: '', pede_resposta: true });

  function mudarTipo(e) {
    const tipo = e.target.value;
    // Troca o título só se ainda for uma sugestão (não apaga o que o anfitrião escreveu)
    setV((atual) => ({
      ...atual,
      tipo,
      titulo: !atual.titulo || Object.values(SUGESTOES).includes(atual.titulo) ? SUGESTOES[tipo] : atual.titulo,
    }));
  }

  async function enviar(e) {
    e.preventDefault();
    if (!v.titulo.trim() || !v.mensagem.trim()) return avisar('Preencha o título e a mensagem.', 'erro');
    setSalvando(true);
    try {
      await api.criar('comunicados', { ...v, inquilino_id: inquilino.id });
      avisar(`Comunicado enviado para ${inquilino.nome.split(' ')[0]}.`);
      aoSalvar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Enviar comunicado" subtitulo={`Para ${inquilino.nome}`} aoFechar={aoFechar}>
      <form onSubmit={enviar}>
        <div className="grade-formulario">
          <Campo rotulo="Tipo de comunicado">
            <select value={v.tipo} onChange={mudarTipo}>
              {TIPOS_COMUNICADO.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Título" obrigatorio>
            <input value={v.titulo} onChange={(e) => setV({ ...v, titulo: e.target.value })} required maxLength={120} />
          </Campo>
          <Campo rotulo="Mensagem" obrigatorio largo>
            <textarea
              rows="5"
              value={v.mensagem}
              onChange={(e) => setV({ ...v, mensagem: e.target.value })}
              placeholder="Ex.: Na quinta-feira, das 9h às 11h, o técnico vai fazer a revisão do aquecedor. Pode confirmar se alguém estará em casa?"
              required
              autoFocus
            />
          </Campo>
        </div>
        <label className="caixa-marcar">
          <input type="checkbox" checked={v.pede_resposta} onChange={(e) => setV({ ...v, pede_resposta: e.target.checked })} />
          <span>
            Pedir resposta do inquilino
            <small>Aparecem os botões "Confirmar" e "Recusar" para ele, e você vê a resposta aqui.</small>
          </span>
        </label>
        <div className="modal-acoes">
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="botao botao-primario" disabled={salvando}>
            {salvando ? 'Enviando…' : 'Enviar comunicado'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Lado do inquilino (no topo do portal) ----------
export function ComunicadosDoPortal({ comunicados, recarregar, completo = false }) {
  const { avisar } = useUI();
  const [recusando, setRecusando] = useState(null);
  const [verTodos, setVerTodos] = useState(false);
  const [respondendo, setRespondendo] = useState(null);

  // Marca como lidos os que ainda não foram abertos
  useEffect(() => {
    const naoLidos = comunicados.filter((c) => !c.lido_em);
    if (!naoLidos.length) return;
    Promise.all(naoLidos.map((c) => api.atualizar('comunicados', c.id, { acao: 'lido' }))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comunicados.map((c) => c.id).join(',')]);

  async function responder(c, resposta, comentario = '') {
    setRespondendo(c.id);
    try {
      await api.atualizar('comunicados', c.id, { acao: 'responder', resposta, comentario });
      avisar(resposta === 'Confirmado' ? 'Obrigado! Você confirmou o comunicado.' : 'Resposta enviada ao anfitrião.');
      recarregar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setRespondendo(null);
    }
  }

  if (!comunicados.length) return null;

  const pendentes = comunicados.filter((c) => c.pede_resposta && !c.resposta);
  const novos = comunicados.filter((c) => !c.pede_resposta && !c.lido_em);
  const destaque = [...pendentes, ...novos];
  const demais = comunicados.filter((c) => !destaque.includes(c));
  const visiveis = verTodos || completo ? [...destaque, ...demais] : destaque.length ? destaque : demais.slice(0, 1);

  return (
    <section className={`cartao portal-comunicados ${pendentes.length ? 'com-pendencia' : ''}`}>
      <div className="cartao-topo">
        <h2>
          Comunicados {pendentes.length > 0 && <span className="contador">{pendentes.length} para responder</span>}
        </h2>
        {comunicados.length > visiveis.length && (
          <button className="link pequeno" onClick={() => setVerTodos(true)}>
            Ver todos ({comunicados.length})
          </button>
        )}
      </div>
      <ul className="lista-comunicados">
        {visiveis.map((c) => {
          const s = situacaoComunicado(c);
          const aguardando = c.pede_resposta && !c.resposta;
          return (
            <li key={c.id} className={aguardando ? 'comunicado-pendente' : ''}>
              <div className="comunicado-topo">
                <div>
                  <span className="comunicado-tipo">{c.tipo}</span>
                  <strong>{c.titulo}</strong>
                  <span className="sub">{dataHoraBR(c.criado_em)}</span>
                </div>
                {!aguardando && c.resposta && <Etiqueta cor={s.cor}>{c.resposta === 'Confirmado' ? 'Você confirmou' : 'Você recusou'}</Etiqueta>}
              </div>
              <p className="comunicado-texto">{c.mensagem}</p>
              {aguardando && (
                <div className="comunicado-acoes">
                  <button className="botao botao-sucesso" disabled={respondendo === c.id} onClick={() => responder(c, 'Confirmado')}>
                    ✓ Confirmar
                  </button>
                  <button className="botao botao-perigo-leve" disabled={respondendo === c.id} onClick={() => setRecusando(c)}>
                    ✕ Recusar
                  </button>
                </div>
              )}
              {c.resposta_comentario && <p className="sub">Seu comentário: “{c.resposta_comentario}”</p>}
            </li>
          );
        })}
      </ul>

      {recusando && (
        <ModalRecusarComunicado
          comunicado={recusando}
          aoFechar={() => setRecusando(null)}
          aoConfirmar={(comentario) => {
            const c = recusando;
            setRecusando(null);
            responder(c, 'Recusado', comentario);
          }}
        />
      )}
    </section>
  );
}

function ModalRecusarComunicado({ comunicado, aoFechar, aoConfirmar }) {
  const [comentario, setComentario] = useState('');
  return (
    <Modal titulo="Recusar comunicado" subtitulo={comunicado.titulo} aoFechar={aoFechar} pequeno>
      <Campo rotulo="Quer explicar? (opcional)" largo>
        <textarea
          rows="3"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Ex.: Nesse horário não tem ninguém em casa. Pode ser na sexta?"
          autoFocus
        />
      </Campo>
      <div className="modal-acoes">
        <button className="botao botao-secundario" onClick={aoFechar}>
          Voltar
        </button>
        <button className="botao botao-perigo" onClick={() => aoConfirmar(comentario.trim())}>
          Recusar
        </button>
      </div>
    </Modal>
  );
}
