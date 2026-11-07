// Contratos: lista com filtros, cadastro, edição, reajuste e exclusão (CRUD de contratos).
import { useMemo, useState } from 'react';
import { api } from '../api';
import { EtiquetaCategoria } from './Imoveis';
import { Etiqueta, Vazio, useUI } from './UI';
import { FormContrato, ModalRegrasCobranca, ModalReajuste } from './Formularios';
import { ModalPagamento } from './Pagamentos';
import { STATUS_PAGAMENTO, analisarContratos, dataBR, moeda, paraISO, semAcento } from '../utils';

export default function Contratos({ contratos, inquilinos, imoveis = [], pagamentos, regras, recarregar, abrirInquilino, irPara, filtroInicial }) {
  const { avisar, confirmar } = useUI();
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState(filtroInicial?.status || '');
  const [filtroSituacao, setFiltroSituacao] = useState(filtroInicial?.situacao || '');
  const [formulario, setFormulario] = useState(null); // { contrato } ou {} para novo
  const [reajuste, setReajuste] = useState(null);
  const [pagando, setPagando] = useState(null);
  const [editandoRegras, setEditandoRegras] = useState(false);

  // Contratos com os cálculos já feitos (situação, atraso, reajuste)
  const lista = useMemo(() => analisarContratos(contratos, pagamentos, regras), [contratos, pagamentos, regras]);

  const filtrados = lista.filter((c) => {
    const texto = semAcento(`${c.imovel} ${c.inquilinos?.nome}`);
    if (busca && !texto.includes(semAcento(busca))) return false;
    if (filtroStatus && c.status_pagamento !== filtroStatus) return false;
    if (filtroSituacao === 'ativos' && c.situacao.tipo === 'encerrado') return false;
    if (filtroSituacao && filtroSituacao !== 'ativos' && c.situacao.tipo !== filtroSituacao) return false;
    return true;
  });

  // UPDATE: renova o contrato por mais 1 ano
  async function renovar(contrato) {
    const ok = await confirmar(
      'Renovar contrato por mais 1 ano?',
      `O contrato de ${contrato.inquilinos?.nome} passa a vencer em ${dataBR(contrato.renovacao.novoFim)}. Depois, confira se é hora de aplicar o reajuste.`,
      'Renovar',
    );
    if (!ok) return;
    try {
      await api.atualizar('contratos', contrato.id, { data_fim: paraISO(contrato.renovacao.novoFim) });
      avisar(`Contrato renovado até ${dataBR(contrato.renovacao.novoFim)}.`);
      recarregar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    }
  }

  // DELETE
  async function excluir(contrato) {
    const ok = await confirmar(
      'Excluir contrato?',
      `O contrato de ${contrato.inquilinos?.nome} (${contrato.imovel}) e as solicitações ligadas a ele serão apagados. Essa ação não pode ser desfeita.`,
    );
    if (!ok) return;
    try {
      await api.excluir('contratos', contrato.id);
      avisar('Contrato excluído.');
      recarregar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    }
  }

  function novoContrato() {
    if (!inquilinos.length) {
      avisar('Cadastre um inquilino antes de criar um contrato.', 'erro');
      irPara('inquilinos');
      return;
    }
    setFormulario({});
  }

  return (
    <div className="pagina">
      <div className="pagina-topo">
        <div>
          <h1>Contratos</h1>
          <p className="texto-suave">Cadastre, edite, reajuste e exclua contratos de aluguel.</p>
        </div>
        <div className="botoes">
          <BotaoEngrenagem aoClicar={() => setEditandoRegras(true)} />
          <button className="botao botao-primario" onClick={novoContrato}>
            + Novo contrato
          </button>
        </div>
      </div>

      <section className="cartao">
        <div className="cartao-topo">
          <div className="botoes">
            <h2>
              {filtrados.length === contratos.length ? `${contratos.length} contrato(s)` : `${filtrados.length} de ${contratos.length} contrato(s)`}
            </h2>
            {(busca || filtroStatus || filtroSituacao) && (
              <span className="filtro-ativo">
                Filtro aplicado
                <button
                  onClick={() => {
                    setBusca('');
                    setFiltroStatus('');
                    setFiltroSituacao('');
                  }}
                  aria-label="Limpar filtros"
                  title="Limpar filtros"
                >
                  ×
                </button>
              </span>
            )}
          </div>
          <div className="filtros">
            <input
              type="search"
              placeholder="Buscar inquilino ou imóvel…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar"
            />
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} aria-label="Pagamento">
              <option value="">Todos os pagamentos</option>
              {STATUS_PAGAMENTO.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value)} aria-label="Situação">
              <option value="">Todas as situações</option>
              <option value="ativos">Ativos (inclui vencendo)</option>
              <option value="ativo">Ativos sem alerta</option>
              <option value="vencendo">Vencendo</option>
              <option value="encerrado">Vencidos</option>
            </select>
          </div>
        </div>

        {!contratos.length ? (
          <Vazio titulo="Nenhum contrato ainda" texto="Cadastre o primeiro contrato para ver tudo aqui.">
            <button className="botao botao-primario" onClick={novoContrato}>
              + Novo contrato
            </button>
          </Vazio>
        ) : !filtrados.length ? (
          <p className="texto-suave centro">Nenhum contrato encontrado com esses filtros.</p>
        ) : (
          <div className="tabela-contorno">
            <table className="tabela tabela-contratos">
              <thead>
                <tr>
                  <th>Inquilino / Imóvel</th>
                  <th>Aluguel</th>
                  <th>Vencimento</th>
                  <th>Contrato</th>
                  <th>Pagamento do mês</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id}>
                    <td className="celula-inquilino">
                      <button className="link nome-inquilino" onClick={() => abrirInquilino(c.inquilino_id)}>
                        {c.inquilinos?.nome}
                      </button>
                      <span className="imovel-linha">
                        <EtiquetaCategoria nome={c.imoveis?.finalidade} />
                        <span>{c.imoveis?.nome || c.imovel}</span>
                      </span>
                    </td>
                    <td data-rotulo="Aluguel">
                      <strong>{moeda(c.valor_aluguel)}</strong>
                      {c.reajuste.disponivel && c.situacao.tipo !== 'encerrado' && (
                        <span className="sub destaque-azul">Reajuste disponível</span>
                      )}
                    </td>
                    <td data-rotulo="Vencimento">Dia {c.dia_vencimento}</td>
                    <td data-rotulo="Contrato" className="celula-contrato">
                      <strong className={`vence-em vence-${c.situacao.tipo}`}>
                        {c.situacao.tipo === 'encerrado' ? 'Venceu em' : 'Vence em'} {dataBR(c.data_fim)}
                      </strong>
                      <Etiqueta valor={c.situacao.tipo}>{c.situacao.texto}</Etiqueta>
                      <span className="sub">Início em {dataBR(c.data_inicio)}</span>
                      <button
                        className="botao botao-pequeno botao-renovar"
                        disabled={!c.renovacao.disponivel}
                        onClick={() => renovar(c)}
                        title={
                          c.renovacao.disponivel
                            ? `Renovar até ${dataBR(c.renovacao.novoFim)}`
                            : `Disponível a partir de ${dataBR(c.renovacao.inicioJanela)}`
                        }
                      >
                        ↻ Renovar +1 ano
                      </button>
                      {!c.renovacao.disponivel && (
                        <span className="sub pequeno">Libera em {dataBR(c.renovacao.inicioJanela)}</span>
                      )}
                    </td>
                    <td data-rotulo="Pagamento do mês" className="celula-pagamento">
                      <span className="pagamento-mes">
                        <Etiqueta valor={c.status_pagamento} />
                        {c.parcela && (
                          <span className="parcela" title={`Parcela ${c.parcela.numero} de ${c.parcela.total} (${c.parcela.mes})`}>
                            {c.parcela.texto}
                          </span>
                        )}
                      </span>
                      {c.atraso && (
                        <span className="sub atraso" title={`Aluguel ${moeda(c.atraso.valor)} + multa ${moeda(c.atraso.multa)} + juros ${moeda(c.atraso.juros)}`}>
                          {c.atraso.quantidade > 1 ? `${c.atraso.quantidade} meses` : `${c.atraso.dias} dia(s)`} · cobrar{' '}
                          <strong>{moeda(c.atraso.total)}</strong>
                          <br />
                          multa {moeda(c.atraso.multa)} + juros {moeda(c.atraso.juros)}
                        </span>
                      )}
                    </td>
                    <td className="acoes">
                      {c.situacao.tipo !== 'encerrado' && (
                        <button className="botao botao-pequeno botao-primario" onClick={() => setPagando(c)}>
                          Registrar pagamento
                        </button>
                      )}
                      <button className="botao botao-pequeno botao-secundario" onClick={() => setReajuste(c)}>
                        Reajuste
                      </button>
                      <button className="botao botao-pequeno botao-secundario" onClick={() => setFormulario({ contrato: c })}>
                        Editar
                      </button>
                      <button className="botao botao-pequeno botao-perigo-leve" onClick={() => excluir(c)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formulario && (
        <FormContrato
          contrato={formulario.contrato}
          inquilinos={inquilinos}
          imoveis={imoveis}
          regras={regras}
          aoFechar={() => setFormulario(null)}
          aoSalvar={() => {
            setFormulario(null);
            recarregar();
          }}
        />
      )}

      {editandoRegras && (
        <ModalRegrasCobranca
          regras={regras}
          aoFechar={() => setEditandoRegras(false)}
          aoSalvar={() => {
            setEditandoRegras(false);
            recarregar();
          }}
        />
      )}

      {pagando && (
        <ModalPagamento
          contrato={pagando}
          aoFechar={() => setPagando(null)}
          aoSalvar={() => {
            setPagando(null);
            recarregar();
          }}
        />
      )}

      {reajuste && (
        <ModalReajuste
          contrato={reajuste}
          aoFechar={() => setReajuste(null)}
          aoSalvar={() => {
            setReajuste(null);
            recarregar();
          }}
        />
      )}
    </div>
  );
}

// Engrenagem discreta que abre as configurações
export function BotaoEngrenagem({ aoClicar }) {
  return (
    <button className="botao-engrenagem" onClick={aoClicar} title="Configurações" aria-label="Configurações">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </svg>
    </button>
  );
}
