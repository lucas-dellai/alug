// Contratos: lista com filtros, cadastro, edição, reajuste e exclusão (CRUD de contratos).
import { useMemo, useState } from 'react';
import { api } from '../api';
import { Etiqueta, Vazio, useUI } from './UI';
import { FormContrato, ModalRegrasCobranca, ModalReajuste } from './Formularios';
import { ModalPagamento } from './Pagamentos';
import { REGRAS_PADRAO, STATUS_PAGAMENTO, analisarContratos, dataBR, moeda, paraISO, semAcento } from '../utils';

export default function Contratos({ contratos, inquilinos, pagamentos, regras, recarregar, abrirInquilino, irPara, filtroInicial }) {
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
          <button className="botao botao-secundario" onClick={() => setEditandoRegras(true)} title="Regras de multa, juros e tolerância">
            ⚙ Multa e juros
          </button>
          <button className="botao botao-primario" onClick={novoContrato}>
            + Novo contrato
          </button>
        </div>
      </div>

      <ResumoRegras regras={regras || REGRAS_PADRAO} aoEditar={() => setEditandoRegras(true)} />

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
            <table className="tabela">
              <thead>
                <tr>
                  <th>Inquilino / Imóvel</th>
                  <th>Aluguel</th>
                  <th>Vencimento</th>
                  <th>Contrato</th>
                  <th>Pagamento</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id}>
                    <td data-rotulo="Inquilino">
                      <button className="link" onClick={() => abrirInquilino(c.inquilino_id)}>
                        {c.inquilinos?.nome}
                      </button>
                      <span className="sub">{c.imovel}</span>
                      <span className="sub">Garantia: {c.tipo_garantia}</span>
                    </td>
                    <td data-rotulo="Aluguel">
                      <strong>{moeda(c.valor_aluguel)}</strong>
                      {c.reajuste.disponivel && c.situacao.tipo !== 'encerrado' && (
                        <span className="sub destaque-azul">Reajuste disponível</span>
                      )}
                    </td>
                    <td data-rotulo="Vencimento">Todo dia {c.dia_vencimento}</td>
                    <td data-rotulo="Contrato">
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
                    <td data-rotulo="Pagamento">
                      <Etiqueta valor={c.status_pagamento} />
                      {c.atraso && (
                        <span className="sub atraso" title={`Aluguel ${moeda(c.atraso.valor)} + multa ${moeda(c.atraso.multa)} + juros ${moeda(c.atraso.juros)}`}>
                          {c.atraso.quantidade > 1 ? `${c.atraso.quantidade} meses` : `${c.atraso.dias} dia(s)`} · cobrar{' '}
                          <strong>{moeda(c.atraso.total)}</strong>
                          <br />
                          multa {moeda(c.atraso.multa)} + juros {moeda(c.atraso.juros)}
                        </span>
                      )}
                      {!c.atraso && c.pagamento.ultimo && (
                        <span className="sub">Último: {dataBR(c.pagamento.ultimo.data_pagamento)}</span>
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
          regras={regras || REGRAS_PADRAO}
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

// Faixa com as regras de cobrança atuais
function ResumoRegras({ regras, aoEditar }) {
  const itens = [
    regras.cobrar_multa ? `Multa padrão de ${Number(regras.multa_padrao)}%` : 'Sem multa',
    regras.cobrar_juros ? `Juros padrão de ${Number(regras.juros_padrao)}% ao mês` : 'Sem juros',
    Number(regras.dias_tolerancia) > 0 ? `${regras.dias_tolerancia} dia(s) de tolerância` : 'Sem tolerância',
  ];
  return (
    <button className="faixa-regras" onClick={aoEditar} title="Alterar regras de cobrança">
      <span className="faixa-regras-icone">⚙</span>
      <span>
        <strong>Regras de cobrança:</strong> {itens.join(' · ')}
      </span>
      <span className="faixa-regras-editar">Alterar</span>
    </button>
  );
}
