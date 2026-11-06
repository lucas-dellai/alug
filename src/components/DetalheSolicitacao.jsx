// Ficha de uma solicitação: descrição, prioridade, status, prazo, anexos e conversa.
// É a mesma tela para o anfitrião e para o inquilino. O inquilino só não altera
// status, prioridade e prazo (isso é decisão do anfitrião).
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { supabase } from '../supabaseClient';
import { Campo, Carregando, Etiqueta, Modal, useUI } from './UI';
import { FormSolicitacao } from './Formularios';
import { FormCusto, ListaCustos } from './Custos';
import { PRIORIDADES, STATUS_SOLICITACAO, analisarSolicitacao, dataBR, estaEncerrada, moeda, semAcento } from '../utils';

const TIPOS_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const TAMANHO_MAXIMO = 5 * 1024 * 1024;

const horaBR = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function DetalheSolicitacao({
  solicitacao,
  contratos = [],
  modoInquilino,
  aoFechar,
  aoAtualizar,
  abrirInquilino,
}) {
  const { avisar, confirmar } = useUI();
  const [atual, setAtual] = useState(solicitacao);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [recusando, setRecusando] = useState(false);
  const [versaoConversa, setVersaoConversa] = useState(0);

  useEffect(() => setAtual(solicitacao), [solicitacao]);

  const encerrada = estaEncerrada(atual);
  const etapa = STATUS_SOLICITACAO.indexOf(atual.status);
  const anterior = etapa > 0 ? STATUS_SOLICITACAO[etapa - 1] : null;
  const proxima = etapa >= 0 && etapa < STATUS_SOLICITACAO.length - 1 ? STATUS_SOLICITACAO[etapa + 1] : null;

  // Muda o status e, se tiver, deixa uma mensagem na conversa para o inquilino
  async function mudarStatus(status, mensagem) {
    setSalvando(true);
    try {
      const novo = await api.atualizar('solicitacoes', atual.id, { status });
      if (mensagem?.trim()) {
        await api.criar('mensagens', { solicitacao_id: atual.id, texto: mensagem.trim() });
        setVersaoConversa((v) => v + 1);
      }
      setAtual(novo);
      avisar(`Solicitação ${status === 'Recusada' ? 'recusada' : status === 'Concluída' ? 'concluída' : `movida para ${status}`}.`);
      aoAtualizar?.();
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  const analise = analisarSolicitacao(atual);

  // UPDATE rápido: status, prioridade ou prazo
  async function alterar(campo, valor) {
    setSalvando(true);
    try {
      const novo = await api.atualizar('solicitacoes', atual.id, { [campo]: valor || null });
      setAtual(novo);
      avisar('Solicitação atualizada.');
      aoAtualizar?.();
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  // DELETE
  async function excluir() {
    const ok = await confirmar('Excluir solicitação?', `"${atual.titulo}", os anexos e a conversa serão apagados.`);
    if (!ok) return;
    try {
      await api.excluir('solicitacoes', atual.id);
      avisar('Solicitação excluída.');
      aoAtualizar?.();
      aoFechar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    }
  }

  if (editando) {
    return (
      <FormSolicitacao
        solicitacao={atual}
        contratos={contratos}
        aoFechar={() => setEditando(false)}
        aoSalvar={(novo) => {
          if (novo) setAtual(novo);
          setEditando(false);
          aoAtualizar?.();
        }}
      />
    );
  }

  return (
    <Modal titulo={atual.titulo} subtitulo={`Solicitação #${atual.id} · aberta em ${dataBR(atual.data_abertura)}`} aoFechar={aoFechar} largo>
      <div className="etiquetas">
        <Etiqueta valor={atual.status} />
        <Etiqueta valor={atual.prioridade}>Prioridade {atual.prioridade.toLowerCase()}</Etiqueta>
        <Etiqueta cor="cinza">{atual.tipo}</Etiqueta>
      </div>

      {analise.alertas.length > 0 && (
        <div className="detalhe-alertas">
          {analise.alertas.map((a) => (
            <span key={a.tipo} className={`aviso-cartao aviso-cartao-${a.tipo === 'alta' ? 'vencido' : a.tipo}`}>
              {a.texto}
            </span>
          ))}
        </div>
      )}

      {/* Ações rápidas do anfitrião */}
      {!modoInquilino && (
        <div className="detalhe-acoes">
          {encerrada ? (
            <button className="botao botao-secundario" onClick={() => mudarStatus('Aberta')} disabled={salvando}>
              ↺ Reabrir solicitação
            </button>
          ) : (
            <>
              {proxima && proxima !== 'Concluída' && (
                <button className="botao botao-primario" onClick={() => mudarStatus(proxima)} disabled={salvando}>
                  Avançar para {proxima} →
                </button>
              )}
              <button className="botao botao-sucesso" onClick={() => mudarStatus('Concluída')} disabled={salvando}>
                ✓ Concluir
              </button>
              {anterior && (
                <button className="botao botao-secundario" onClick={() => mudarStatus(anterior)} disabled={salvando}>
                  ← Voltar para {anterior}
                </button>
              )}
              <button className="botao botao-perigo-leve" onClick={() => setRecusando(true)} disabled={salvando}>
                ✕ Recusar
              </button>
            </>
          )}
        </div>
      )}

      {/* Ajustes do anfitrião */}
      {!modoInquilino && (
        <div className="detalhe-controles">
          <Campo rotulo="Prioridade">
            <select value={atual.prioridade} onChange={(e) => alterar('prioridade', e.target.value)} disabled={salvando}>
              {PRIORIDADES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Prazo para resolver">
            <input
              type="date"
              value={atual.prazo || ''}
              min={atual.data_abertura || undefined}
              onChange={(e) => alterar('prazo', e.target.value)}
              disabled={salvando}
            />
          </Campo>
        </div>
      )}

      {modoInquilino && atual.prazo && !encerrada && (
        <p className="texto-suave">
          Previsão de solução: <strong>{dataBR(atual.prazo)}</strong>
        </p>
      )}

      <section className="detalhe-bloco">
        <h3 className="subtitulo-secao">Descrição do problema</h3>
        <p className="detalhe-descricao">{atual.descricao || <span className="texto-suave">Sem descrição.</span>}</p>
        <p className="sub">
          Imóvel: {atual.contratos?.imovel}
          {!modoInquilino && (
            <>
              {' · '}Inquilino:{' '}
              <button
                className="link"
                onClick={() => {
                  aoFechar();
                  abrirInquilino?.(atual.contratos?.inquilino_id);
                }}
              >
                {atual.contratos?.inquilinos?.nome}
              </button>
            </>
          )}
        </p>
      </section>

      <Anexos solicitacaoId={atual.id} podeExcluir={!modoInquilino} />

      {/* Custos do chamado: só o anfitrião vê */}
      {!modoInquilino && <CustosDoChamado solicitacao={atual} aoAtualizar={aoAtualizar} />}

      <Conversa key={versaoConversa} solicitacaoId={atual.id} modoInquilino={modoInquilino} />

      {recusando && (
        <ModalRecusa
          titulo={atual.titulo}
          aoFechar={() => setRecusando(false)}
          aoConfirmar={async (motivo) => {
            setRecusando(false);
            await mudarStatus('Recusada', motivo ? `Solicitação recusada. Motivo: ${motivo}` : '');
          }}
        />
      )}

      {!modoInquilino && (
        <div className="modal-acoes detalhe-rodape">
          <button className="botao botao-perigo-leve" onClick={excluir}>
            Excluir solicitação
          </button>
          <span className="espaco" />
          <button className="botao botao-secundario" onClick={() => setEditando(true)}>
            Editar título e descrição
          </button>
        </div>
      )}
    </Modal>
  );
}

// ---------- Custos do chamado ----------
function CustosDoChamado({ solicitacao, aoAtualizar }) {
  const { avisar } = useUI();
  const [custos, setCustos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [formulario, setFormulario] = useState(null);

  async function carregar() {
    try {
      setCustos(await api.listar('custos', { solicitacao_id: solicitacao.id }));
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitacao.id]);

  function depoisDeMudar() {
    carregar();
    aoAtualizar?.();
  }

  const total = custos.reduce((s, c) => s + Number(c.valor), 0);

  return (
    <section className="detalhe-bloco">
      <div className="cartao-topo">
        <h3 className="subtitulo-secao">
          Custos {custos.length > 0 && <span className="texto-suave">· total {moeda(total)}</span>}
        </h3>
        <button className="botao botao-pequeno botao-secundario" onClick={() => setFormulario({})}>
          + Lançar custo
        </button>
      </div>
      {carregando ? (
        <Carregando />
      ) : !custos.length ? (
        <p className="texto-suave pequeno">Nenhum custo neste chamado. Lance aqui o que gastou para resolver (com a nota).</p>
      ) : (
        <ListaCustos custos={custos} dentroDoChamado aoEditar={(custo) => setFormulario({ custo })} recarregar={depoisDeMudar} />
      )}
      {formulario && (
        <FormCusto
          custo={formulario.custo}
          fixo={{ solicitacao_id: solicitacao.id, contrato_id: solicitacao.contrato_id }}
          aoFechar={() => setFormulario(null)}
          aoSalvar={() => {
            setFormulario(null);
            depoisDeMudar();
          }}
        />
      )}
    </section>
  );
}

// ---------- Anexos ----------
function Anexos({ solicitacaoId, podeExcluir }) {
  const { avisar, confirmar } = useUI();
  const [anexos, setAnexos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const entrada = useRef(null);

  async function carregar() {
    try {
      setAnexos(await api.listar('anexos', { solicitacao_id: solicitacaoId }));
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitacaoId]);

  // CREATE: envia o arquivo e grava o registro
  async function enviar(e) {
    const arquivos = [...(e.target.files || [])];
    e.target.value = '';
    if (!arquivos.length) return;
    setEnviando(true);
    for (const arquivo of arquivos) {
      if (!TIPOS_ACEITOS.includes(arquivo.type)) {
        avisar(`"${arquivo.name}": envie apenas fotos (JPG, PNG, WEBP) ou PDF.`, 'erro');
        continue;
      }
      if (arquivo.size > TAMANHO_MAXIMO) {
        avisar(`"${arquivo.name}" passa de 5 MB.`, 'erro');
        continue;
      }
      const nomeSeguro = semAcento(arquivo.name).replace(/[^a-z0-9._-]/g, '_');
      const caminho = `${solicitacaoId}/${Date.now()}-${nomeSeguro}`;
      const { error } = await supabase.storage.from('anexos').upload(caminho, arquivo, { contentType: arquivo.type });
      if (error) {
        avisar(`Não foi possível enviar "${arquivo.name}".`, 'erro');
        continue;
      }
      try {
        await api.criar('anexos', { solicitacao_id: solicitacaoId, nome_arquivo: arquivo.name, caminho });
      } catch (erro) {
        await supabase.storage.from('anexos').remove([caminho]);
        avisar(erro.message, 'erro');
      }
    }
    setEnviando(false);
    carregar();
  }

  async function abrir(anexo) {
    const janela = window.open('', '_blank');
    const { data, error } = await supabase.storage.from('anexos').createSignedUrl(anexo.caminho, 120);
    if (error || !data?.signedUrl) {
      janela?.close();
      return avisar('Não foi possível abrir o arquivo.', 'erro');
    }
    if (janela) janela.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  }

  // DELETE
  async function excluir(anexo) {
    const ok = await confirmar('Excluir anexo?', `"${anexo.nome_arquivo}" será apagado.`);
    if (!ok) return;
    try {
      await api.excluir('anexos', anexo.id);
      avisar('Anexo excluído.');
      carregar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    }
  }

  return (
    <section className="detalhe-bloco">
      <div className="cartao-topo">
        <h3 className="subtitulo-secao">Anexos {anexos.length > 0 && `(${anexos.length})`}</h3>
        <label className="botao botao-pequeno botao-secundario">
          {enviando ? 'Enviando…' : '+ Adicionar foto ou PDF'}
          <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple hidden onChange={enviar} disabled={enviando} />
        </label>
      </div>
      {carregando ? (
        <Carregando />
      ) : !anexos.length ? (
        <p className="texto-suave pequeno">Nenhum anexo. Fotos ajudam a entender o problema.</p>
      ) : (
        <ul className="lista-anexos">
          {anexos.map((a) => (
            <li key={a.id}>
              <span className="documento-icone">{a.nome_arquivo.toLowerCase().endsWith('.pdf') ? 'PDF' : 'FOTO'}</span>
              <div>
                <strong>{a.nome_arquivo}</strong>
                <span className="sub">
                  Enviado por {a.enviado_por === 'anfitriao' ? 'anfitrião' : 'inquilino'} · {horaBR(a.criado_em)}
                </span>
              </div>
              <div className="botoes">
                <button className="botao botao-pequeno botao-secundario" onClick={() => abrir(a)}>
                  Abrir
                </button>
                {podeExcluir && (
                  <button className="botao botao-pequeno botao-perigo-leve" onClick={() => excluir(a)}>
                    Excluir
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------- Conversa ----------
function Conversa({ solicitacaoId, modoInquilino }) {
  const { avisar } = useUI();
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const fim = useRef(null);
  const meuPapel = modoInquilino ? 'inquilino' : 'anfitriao';

  async function carregar() {
    try {
      setMensagens(await api.listar('mensagens', { solicitacao_id: solicitacaoId }));
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitacaoId]);

  // Rola só a caixa da conversa até a última mensagem (sem mexer no resto da tela)
  useEffect(() => {
    const caixa = fim.current?.parentElement;
    if (caixa) caixa.scrollTop = caixa.scrollHeight;
  }, [mensagens.length]);

  // CREATE
  async function enviar(e) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await api.criar('mensagens', { solicitacao_id: solicitacaoId, texto });
      setTexto('');
      carregar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="detalhe-bloco">
      <h3 className="subtitulo-secao">Conversa</h3>
      {carregando ? (
        <Carregando />
      ) : (
        <div className="conversa">
          {!mensagens.length && (
            <p className="texto-suave pequeno">
              {modoInquilino
                ? 'Escreva aqui se quiser complementar o pedido. O anfitrião responde por aqui.'
                : 'Nenhuma mensagem ainda. Responda o inquilino por aqui.'}
            </p>
          )}
          {mensagens.map((m) => (
            <div key={m.id} className={`mensagem ${m.autor_papel === meuPapel ? 'mensagem-minha' : ''}`}>
              <span className="mensagem-autor">
                {m.autor_nome || (m.autor_papel === 'anfitriao' ? 'Anfitrião' : 'Inquilino')} · {horaBR(m.criado_em)}
              </span>
              <p>{m.texto}</p>
            </div>
          ))}
          <div ref={fim} />
        </div>
      )}
      <form className="conversa-envio" onSubmit={enviar}>
        <textarea
          rows="2"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={modoInquilino ? 'Escreva para o anfitrião…' : 'Escreva para o inquilino…'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) enviar(e);
          }}
        />
        <button className="botao botao-primario" disabled={enviando || !texto.trim()}>
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
    </section>
  );
}

// Janela para recusar uma solicitação, com motivo opcional (vai para a conversa)
function ModalRecusa({ titulo, aoFechar, aoConfirmar }) {
  const [motivo, setMotivo] = useState('');
  return (
    <Modal titulo="Recusar solicitação?" subtitulo={titulo} aoFechar={aoFechar} pequeno>
      <Campo rotulo="Motivo (opcional)" dica="O inquilino vai ver esta mensagem na conversa.">
        <textarea rows="3" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: o conserto é responsabilidade do condomínio." autoFocus />
      </Campo>
      <div className="modal-acoes">
        <button className="botao botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button className="botao botao-perigo" onClick={() => aoConfirmar(motivo)}>
          Recusar solicitação
        </button>
      </div>
    </Modal>
  );
}
