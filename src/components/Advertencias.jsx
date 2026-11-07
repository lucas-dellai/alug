// Advertências: o anfitrião registra (interna = só ele vê; formal = o inquilino recebe)
// e o inquilino responde "Aceito" ou "Não concordo" no portal.
import { useEffect, useState } from 'react';
import { api } from '../api';
import { Campo, Carregando, Etiqueta, Modal, useUI } from './UI';
import { MOTIVOS_ADVERTENCIA, dataBR, dataHoraBR, moeda, paraISO, hoje } from '../utils';

function situacao(a) {
  if (a.tipo === 'Interna') return { texto: 'Interna · só você vê', cor: 'cinza' };
  if (a.resposta === 'Aceita') return { texto: 'Aceita pelo inquilino', cor: 'verde' };
  if (a.resposta === 'Contestada') return { texto: 'Não concordou', cor: 'vermelho' };
  return { texto: a.lido_em ? 'Lida, sem resposta' : 'Aguardando ciência', cor: 'amarelo' };
}

// ---------- Ficha do inquilino (anfitrião) ----------
export function AdvertenciasDoInquilino({ inquilino }) {
  const { avisar, confirmar } = useUI();
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [nova, setNova] = useState(false);

  async function carregar() {
    try {
      setLista(await api.listar('advertencias', { inquilino_id: inquilino.id }));
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

  async function excluir(a) {
    const ok = await confirmar('Excluir advertência?', `"${a.titulo}" será apagada${a.tipo === 'Formal' ? ' também do portal do inquilino' : ''}.`);
    if (!ok) return;
    try {
      await api.excluir('advertencias', a.id);
      avisar('Advertência excluída.');
      carregar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    }
  }

  return (
    <section className="cartao">
      <div className="cartao-topo">
        <h2>
          Advertências {lista.length > 0 && <span className="contador">{lista.length}</span>}
        </h2>
        <button className="botao botao-pequeno botao-secundario" onClick={() => setNova(true)}>
          + Advertência
        </button>
      </div>
      {carregando ? (
        <Carregando />
      ) : !lista.length ? (
        <p className="texto-suave">Nenhuma advertência registrada.</p>
      ) : (
        <ul className="lista-comunicados">
          {lista.map((a) => {
            const s = situacao(a);
            return (
              <li key={a.id} className={a.tipo === 'Interna' ? 'advertencia-interna' : ''}>
                <div className="comunicado-topo">
                  <div>
                    <span className="comunicado-tipo tipo-advertencia">{a.motivo}</span>
                    <strong>{a.titulo}</strong>
                    <span className="sub">
                      Ocorrido em {dataBR(a.data_ocorrencia)}
                      {a.multa_valor ? ` · multa de ${moeda(a.multa_valor)}` : ''}
                    </span>
                  </div>
                  <Etiqueta cor={s.cor}>{s.texto}</Etiqueta>
                </div>
                {a.descricao && <p className="comunicado-texto">{a.descricao}</p>}
                {a.resposta && (
                  <p className={`comunicado-resposta resposta-${a.resposta === 'Aceita' ? 'sim' : 'nao'}`}>
                    <strong>{a.resposta === 'Aceita' ? 'Aceitou' : 'Não concordou'}</strong> em {dataHoraBR(a.respondido_em)}
                    {a.resposta_comentario && <>: “{a.resposta_comentario}”</>}
                  </p>
                )}
                <div className="comunicado-rodape">
                  <span className="sub">
                    {a.tipo === 'Interna' ? 'Registro interno' : a.lido_em ? `Lida em ${dataHoraBR(a.lido_em)}` : 'Ainda não foi lida'}
                  </span>
                  <button className="botao botao-pequeno botao-perigo-leve" onClick={() => excluir(a)}>
                    Excluir
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {nova && (
        <FormAdvertencia
          inquilino={inquilino}
          aoFechar={() => setNova(false)}
          aoSalvar={() => {
            setNova(false);
            carregar();
          }}
        />
      )}
    </section>
  );
}

function FormAdvertencia({ inquilino, aoFechar, aoSalvar }) {
  const { avisar } = useUI();
  const [salvando, setSalvando] = useState(false);
  const [v, setV] = useState({
    tipo: 'Formal',
    motivo: 'Barulho',
    titulo: '',
    descricao: '',
    data_ocorrencia: paraISO(hoje()),
    multa_valor: '',
  });
  const muda = (campo) => (e) => setV({ ...v, [campo]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    if (!v.titulo.trim()) return avisar('Escreva o título da advertência.', 'erro');
    setSalvando(true);
    try {
      await api.criar('advertencias', {
        ...v,
        inquilino_id: inquilino.id,
        multa_valor: v.multa_valor ? Number(v.multa_valor) : null,
      });
      avisar(v.tipo === 'Formal' ? `Advertência enviada para ${inquilino.nome.split(' ')[0]}.` : 'Advertência interna registrada.');
      aoSalvar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Nova advertência" subtitulo={inquilino.nome} aoFechar={aoFechar}>
      <form onSubmit={enviar}>
        <div className="opcoes-segmento opcoes-tipo" role="radiogroup" aria-label="Tipo de advertência">
          {[
            { id: 'Formal', rotulo: 'Formal', dica: 'O inquilino recebe e responde' },
            { id: 'Interna', rotulo: 'Interna', dica: 'Só você vê' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={v.tipo === t.id}
              className={v.tipo === t.id ? 'ativo' : ''}
              onClick={() => setV({ ...v, tipo: t.id })}
            >
              <strong>{t.rotulo}</strong>
              <small>{t.dica}</small>
            </button>
          ))}
        </div>
        <div className="grade-formulario">
          <Campo rotulo="Motivo">
            <select value={v.motivo} onChange={muda('motivo')}>
              {MOTIVOS_ADVERTENCIA.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Data do ocorrido">
            <input type="date" value={v.data_ocorrencia} onChange={muda('data_ocorrencia')} />
          </Campo>
          <Campo rotulo="Título" obrigatorio largo>
            <input value={v.titulo} onChange={muda('titulo')} placeholder="Ex.: Barulho após as 22h" maxLength={120} required autoFocus />
          </Campo>
          <Campo rotulo="O que aconteceu" largo>
            <textarea
              rows="4"
              value={v.descricao}
              onChange={muda('descricao')}
              placeholder="Ex.: Recebemos reclamação dos vizinhos no sábado. Em caso de repetição, será aplicada multa conforme o contrato."
            />
          </Campo>
          <Campo rotulo="Multa (opcional, R$)" dica="Só informa o valor. Para cobrar, registre junto do pagamento.">
            <input type="number" min="0" step="0.01" inputMode="decimal" value={v.multa_valor} onChange={muda('multa_valor')} />
          </Campo>
        </div>
        {v.tipo === 'Formal' && (
          <p className="aviso-suave">
            {inquilino.nome.split(' ')[0]} verá esta advertência no portal e poderá responder <strong>Aceito</strong> ou{' '}
            <strong>Não concordo</strong>.
          </p>
        )}
        <div className="modal-acoes">
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="botao botao-primario" disabled={salvando}>
            {salvando ? 'Salvando…' : v.tipo === 'Formal' ? 'Enviar advertência' : 'Registrar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Portal do inquilino ----------
export function AdvertenciasDoPortal({ advertencias, recarregar, completo = false }) {
  const { avisar } = useUI();
  const [contestando, setContestando] = useState(null);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(null);

  useEffect(() => {
    const naoLidas = advertencias.filter((a) => !a.lido_em);
    if (naoLidas.length) Promise.all(naoLidas.map((a) => api.atualizar('advertencias', a.id, { acao: 'lido' }))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advertencias.map((a) => a.id).join(',')]);

  async function responder(a, resposta, texto = '') {
    setEnviando(a.id);
    try {
      await api.atualizar('advertencias', a.id, { acao: 'responder', resposta, comentario: texto });
      avisar(resposta === 'Aceita' ? 'Ciência registrada.' : 'Sua resposta foi enviada ao anfitrião.');
      setContestando(null);
      setComentario('');
      recarregar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setEnviando(null);
    }
  }

  const pendentes = advertencias.filter((a) => !a.resposta);
  const visiveis = completo ? [...pendentes, ...advertencias.filter((a) => a.resposta)] : pendentes;
  if (!visiveis.length) return null;

  return (
    <section className={`cartao portal-comunicados portal-advertencias ${pendentes.length ? 'com-pendencia' : ''}`}>
      <h2>
        Advertências {pendentes.length > 0 && <span className="contador">{pendentes.length} para responder</span>}
      </h2>
      <ul className="lista-comunicados">
        {visiveis.map((a) => (
          <li key={a.id} className={a.resposta ? '' : 'comunicado-pendente advertencia-pendente'}>
            <div className="comunicado-topo">
              <div>
                <span className="comunicado-tipo tipo-advertencia">Advertência · {a.motivo}</span>
                <strong>{a.titulo}</strong>
                <span className="sub">Ocorrido em {dataBR(a.data_ocorrencia)}</span>
              </div>
            </div>
            {a.descricao && <p className="comunicado-texto">{a.descricao}</p>}
            {a.multa_valor && (
              <p className="aviso-pagamento aviso-recusado">
                <strong>Multa: {moeda(a.multa_valor)}</strong>
              </p>
            )}
            {a.resposta ? (
              <p className={`comunicado-resposta resposta-${a.resposta === 'Aceita' ? 'sim' : 'nao'}`}>
                <strong>{a.resposta === 'Aceita' ? 'Você aceitou' : 'Você não concordou'}</strong>
                {a.respondido_em && <> em {dataHoraBR(a.respondido_em)}</>}
                {a.resposta_comentario && <>: “{a.resposta_comentario}”</>}
              </p>
            ) : (
              <div className="comunicado-acoes">
                <button className="botao botao-sucesso" disabled={enviando === a.id} onClick={() => responder(a, 'Aceita')}>
                  ✓ Aceito
                </button>
                <button className="botao botao-perigo-leve" disabled={enviando === a.id} onClick={() => setContestando(a)}>
                  ✕ Não concordo
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {contestando && (
        <Modal titulo="Não concordo" subtitulo={contestando.titulo} aoFechar={() => setContestando(null)} pequeno>
          <Campo rotulo="Explique o motivo" obrigatorio largo>
            <textarea
              rows="4"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Ex.: Nesse dia eu não estava em casa."
              autoFocus
            />
          </Campo>
          <div className="modal-acoes">
            <button className="botao botao-secundario" onClick={() => setContestando(null)}>
              Voltar
            </button>
            <button
              className="botao botao-perigo"
              disabled={!comentario.trim() || enviando === contestando.id}
              onClick={() => responder(contestando, 'Contestada', comentario.trim())}
            >
              Enviar resposta
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
