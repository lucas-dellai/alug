// Solicitações dos inquilinos em quadro Kanban.
// Para mudar o status: arraste o cartão (computador) ou use as setas (celular).
import { useState } from 'react';
import { api } from '../api';
import { Etiqueta, Vazio, useUI } from './UI';
import { FormSolicitacao } from './Formularios';
import DetalheSolicitacao from './DetalheSolicitacao';
import { PRIORIDADES, STATUS_SOLICITACAO, analisarSolicitacao, dataBR } from '../utils';

const ORDEM_PRIORIDADE = { Alta: 0, Média: 1, Baixa: 2 };

export default function Solicitacoes({ solicitacoes, contratos, recarregar, abrirInquilino }) {
  const { avisar } = useUI();
  const [formulario, setFormulario] = useState(null);
  const [abertaId, setAbertaId] = useState(null);
  const [filtroPrioridade, setFiltroPrioridade] = useState('');
  const [arrastando, setArrastando] = useState(null);
  const [colunaAlvo, setColunaAlvo] = useState(null);
  const [movendo, setMovendo] = useState(null);

  // UPDATE: muda o status (move de coluna)
  async function mover(solicitacao, status) {
    if (!status || status === solicitacao.status) return;
    setMovendo(solicitacao.id);
    try {
      await api.atualizar('solicitacoes', solicitacao.id, { status });
      avisar(`"${solicitacao.titulo}" movida para ${status}.`);
      await recarregar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setMovendo(null);
    }
  }

  function nova() {
    if (!contratos.length) return avisar('Cadastre um contrato antes de registrar solicitações.', 'erro');
    setFormulario({});
  }

  const visiveis = solicitacoes
    .filter((s) => !filtroPrioridade || s.prioridade === filtroPrioridade)
    .sort((a, b) => ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade]);

  return (
    <div className="pagina">
      <div className="pagina-topo">
        <div>
          <h1>Solicitações</h1>
          <p className="texto-suave">Pedidos e problemas relatados pelos inquilinos. Arraste os cartões entre as colunas.</p>
        </div>
        <div className="botoes">
          <select value={filtroPrioridade} onChange={(e) => setFiltroPrioridade(e.target.value)} aria-label="Prioridade">
            <option value="">Todas as prioridades</option>
            {PRIORIDADES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <button className="botao botao-primario" onClick={nova}>
            + Nova solicitação
          </button>
        </div>
      </div>

      {!solicitacoes.length ? (
        <section className="cartao">
          <Vazio titulo="Nenhuma solicitação" texto="Quando um inquilino pedir algo, registre aqui para acompanhar.">
            <button className="botao botao-primario" onClick={nova}>
              + Nova solicitação
            </button>
          </Vazio>
        </section>
      ) : (
        <div className="kanban">
          {STATUS_SOLICITACAO.map((status, indice) => {
            // A coluna "Concluída" também mostra as recusadas
            const cartoes = visiveis.filter((s) => s.status === status || (status === 'Concluída' && s.status === 'Recusada'));
            return (
              <section
                key={status}
                className={`coluna coluna-${indice} ${colunaAlvo === status ? 'coluna-alvo' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setColunaAlvo(status);
                }}
                onDragLeave={() => setColunaAlvo(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setColunaAlvo(null);
                  if (arrastando) mover(arrastando, status);
                  setArrastando(null);
                }}
              >
                <header className="coluna-topo">
                  <h2>{status === 'Concluída' ? 'Concluída / Recusada' : status}</h2>
                  <span className="contador">{cartoes.length}</span>
                </header>

                <div className="coluna-cartoes">
                  {cartoes.map((s) => {
                    const analise = analisarSolicitacao(s);
                    const anterior = STATUS_SOLICITACAO[indice - 1];
                    const proximo = STATUS_SOLICITACAO[indice + 1];
                    return (
                      <article
                        key={s.id}
                        className={`cartao-kanban ${movendo === s.id ? 'movendo' : ''} prioridade-${s.prioridade === 'Média' ? 'media' : s.prioridade.toLowerCase()}`}
                        draggable
                        onDragStart={() => setArrastando(s)}
                        onDragEnd={() => setArrastando(null)}
                        onClick={() => setAbertaId(s.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setAbertaId(s.id)}
                        title="Abrir solicitação"
                      >
                        <div className="etiquetas">
                          {s.status === 'Recusada' && <Etiqueta valor="Recusada" />}
                          <Etiqueta valor={s.prioridade}>{s.prioridade}</Etiqueta>
                          <Etiqueta cor="cinza">{s.tipo}</Etiqueta>
                        </div>
                        <h3>{s.titulo}</h3>
                        {s.descricao && <p className="descricao">{s.descricao}</p>}
                        <span className="sub">
                          {s.contratos?.inquilinos?.nome} · {s.contratos?.imovel}
                        </span>
                        <span className="sub">
                          Aberta em {dataBR(s.data_abertura)}
                          {s.prazo && status !== 'Concluída' ? ` · prazo ${dataBR(s.prazo)}` : ''}
                        </span>
                        {analise.alertas
                          .filter((a) => a.tipo !== 'alta')
                          .map((a) => (
                            <span key={a.tipo} className={`aviso-cartao aviso-cartao-${a.tipo}`}>
                              {a.tipo === 'parada' ? '⏸' : '⏰'} {a.texto}
                            </span>
                          ))}

                        <div className="cartao-kanban-acoes" onClick={(e) => e.stopPropagation()}>
                          <div className="setas">
                            <button
                              className="botao-icone"
                              disabled={!anterior || movendo === s.id}
                              onClick={() => mover(s, anterior)}
                              aria-label={`Mover para ${anterior}`}
                              title={anterior ? `Mover para ${anterior}` : ''}
                            >
                              ←
                            </button>
                            <button
                              className="botao-icone"
                              disabled={!proximo || movendo === s.id}
                              onClick={() => mover(s, proximo)}
                              aria-label={`Mover para ${proximo}`}
                              title={proximo ? `Mover para ${proximo}` : ''}
                            >
                              →
                            </button>
                          </div>
                          <button className="botao botao-pequeno botao-secundario" onClick={() => setAbertaId(s.id)}>
                            Abrir
                          </button>
                        </div>
                      </article>
                    );
                  })}
                  {!cartoes.length && <p className="coluna-vazia">Nada aqui</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {formulario && (
        <FormSolicitacao
          solicitacao={formulario.solicitacao}
          contratos={contratos}
          aoFechar={() => setFormulario(null)}
          aoSalvar={(nova) => {
            setFormulario(null);
            recarregar();
            if (nova?.id) setAbertaId(nova.id);
          }}
        />
      )}

      {abertaId && solicitacoes.find((s) => s.id === abertaId) && (
        <DetalheSolicitacao
          solicitacao={solicitacoes.find((s) => s.id === abertaId)}
          contratos={contratos}
          aoFechar={() => setAbertaId(null)}
          aoAtualizar={recarregar}
          abrirInquilino={abrirInquilino}
        />
      )}
    </div>
  );
}
