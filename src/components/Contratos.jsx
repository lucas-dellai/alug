// Contratos: lista com filtros, cadastro, edição, reajuste e exclusão (CRUD de contratos).
import { useMemo, useState } from 'react';
import { api } from '../api';
import { Etiqueta, Vazio, useUI } from './UI';
import { FormContrato, ModalReajuste } from './Formularios';
import { ModalPagamento } from './Pagamentos';
import { STATUS_PAGAMENTO, analisarContratos, dataBR, moeda, semAcento } from '../utils';

export default function Contratos({ contratos, inquilinos, pagamentos, recarregar, abrirInquilino, irPara, filtroInicial }) {
  const { avisar, confirmar } = useUI();
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState(filtroInicial?.status || '');
  const [filtroSituacao, setFiltroSituacao] = useState(filtroInicial?.situacao || '');
  const [formulario, setFormulario] = useState(null); // { contrato } ou {} para novo
  const [reajuste, setReajuste] = useState(null);
  const [pagando, setPagando] = useState(null);

  // Contratos com os cálculos já feitos (situação, atraso, reajuste)
  const lista = useMemo(() => analisarContratos(contratos, pagamentos), [contratos, pagamentos]);

  const filtrados = lista.filter((c) => {
    const texto = semAcento(`${c.imovel} ${c.inquilinos?.nome}`);
    if (busca && !texto.includes(semAcento(busca))) return false;
    if (filtroStatus && c.status_pagamento !== filtroStatus) return false;
    if (filtroSituacao === 'ativos' && c.situacao.tipo === 'encerrado') return false;
    if (filtroSituacao && filtroSituacao !== 'ativos' && c.situacao.tipo !== filtroSituacao) return false;
    return true;
  });

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
        <button className="botao botao-primario" onClick={novoContrato}>
          + Novo contrato
        </button>
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
                      <Etiqueta valor={c.situacao.tipo}>{c.situacao.texto}</Etiqueta>
                      <span className="sub">
                        {dataBR(c.data_inicio)} a {dataBR(c.data_fim)}
                      </span>
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
          aoFechar={() => setFormulario(null)}
          aoSalvar={() => {
            setFormulario(null);
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
