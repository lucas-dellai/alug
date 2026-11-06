// Tela inicial do anfitrião: situação geral, pontos de atenção, gráficos e agenda.
import { useMemo, useState } from 'react';
import { Etiqueta } from './UI';
import { ModalReajuste } from './Formularios';
import {
  analisarContratos,
  analisarSolicitacao,
  dataBR,
  moeda,
  primeiroNome,
  saudacao,
  dataPorExtenso,
  estaEncerrada,
} from '../utils';

const CORES_PAGAMENTO = { 'Em dia': 'var(--verde)', Pendente: '#d99a1e', Atrasado: 'var(--vermelho)' };

export default function Inicio({ perfil, contratos, inquilinos, solicitacoes, pagamentos, regras, recarregar, irPara, abrirInquilino }) {
  const [reajuste, setReajuste] = useState(null);
  const lista = useMemo(() => analisarContratos(contratos, pagamentos, regras), [contratos, pagamentos, regras]);
  const ativos = lista.filter((c) => c.situacao.tipo !== 'encerrado');

  // ---------- Pontos de atenção ----------
  const pontos = [];
  for (const c of ativos) {
    if (c.atraso) {
      pontos.push({
        id: `pag${c.id}`,
        grupo: 'Pagamentos',
        nivel: 'vermelho',
        titulo: `${c.inquilinos?.nome} está com o aluguel atrasado`,
        texto: `${c.atraso.quantidade > 1 ? `${c.atraso.quantidade} meses em aberto` : `${c.atraso.dias} dia(s) de atraso`} · cobrar ${moeda(c.atraso.total)}`,
        abrir: () => abrirInquilino(c.inquilino_id),
      });
    }
  }
  for (const c of lista) {
    if (c.situacao.tipo === 'vencendo' || c.situacao.tipo === 'encerrado') {
      pontos.push({
        id: `ctr${c.id}`,
        grupo: 'Contratos',
        nivel: c.situacao.tipo === 'encerrado' ? 'vermelho' : 'amarelo',
        titulo:
          c.situacao.tipo === 'encerrado'
            ? `Contrato de ${c.inquilinos?.nome} já terminou`
            : `Contrato de ${c.inquilinos?.nome} termina em breve`,
        texto: `${c.situacao.texto} (${dataBR(c.data_fim)}) · ${c.imovel}`,
        abrir: () => abrirInquilino(c.inquilino_id),
      });
    }
    if (c.reajuste.disponivel && c.situacao.tipo !== 'encerrado') {
      pontos.push({
        id: `rea${c.id}`,
        grupo: 'Contratos',
        nivel: 'azul',
        titulo: `Reajuste anual de ${c.inquilinos?.nome}`,
        texto:
          c.reajuste.dias < 0
            ? `Disponível desde ${dataBR(c.reajuste.proximo)} (${c.indice_reajuste})`
            : `Disponível em ${dataBR(c.reajuste.proximo)} (${c.indice_reajuste})`,
        acao: { rotulo: 'Calcular', executar: () => setReajuste(c) },
      });
    }
  }
  for (const s of solicitacoes) {
    const analise = analisarSolicitacao(s);
    if (!analise.alertas.length) continue;
    const grave = analise.alertas.some((a) => a.tipo === 'vencido' || a.tipo === 'alta');
    pontos.push({
      id: `sol${s.id}`,
      grupo: 'Solicitações',
      nivel: grave ? 'vermelho' : 'amarelo',
      titulo: `${s.titulo} · ${s.contratos?.inquilinos?.nome || ''}`,
      texto: `${s.status} · ${analise.alertas.map((a) => a.texto).join(' · ')}`,
      abrir: () => irPara('solicitacoes'),
    });
  }

  const graves = pontos.filter((p) => p.nivel === 'vermelho').length;
  const situacaoGeral = !pontos.length ? 'ok' : graves ? 'grave' : 'atencao';

  // ---------- Números ----------
  const receita = ativos.reduce((s, c) => s + Number(c.valor_aluguel), 0);
  const porStatus = ['Em dia', 'Pendente', 'Atrasado'].map((status) => {
    const doStatus = ativos.filter((c) => c.status_pagamento === status);
    return { status, quantidade: doStatus.length, valor: doStatus.reduce((s, c) => s + Number(c.valor_aluguel), 0) };
  });
  const recebido = porStatus[0].valor;
  const percentualRecebido = receita ? Math.round((recebido / receita) * 100) : 0;

  const porImovel = [...ativos].sort((a, b) => b.valor_aluguel - a.valor_aluguel).slice(0, 6);
  const maiorAluguel = Math.max(1, ...porImovel.map((c) => Number(c.valor_aluguel)));

  const agenda = [...ativos].sort((a, b) => a.vencimento.data - b.vencimento.data).slice(0, 6);

  const grupos = ['Pagamentos', 'Contratos', 'Solicitações'].map((grupo) => ({
    grupo,
    itens: pontos.filter((p) => p.grupo === grupo),
  }));

  const hoje = new Date();

  return (
    <div className="pagina">
      <div className="pagina-topo">
        <div>
          <p className="texto-suave data-hoje">
            {dataPorExtenso(hoje)}
          </p>
          <h1>
            {saudacao(hoje)}, {primeiroNome(perfil.nome) || 'anfitrião'}!
          </h1>
        </div>
      </div>

      {/* Situação geral */}
      <section className={`situacao situacao-${situacaoGeral}`}>
        <span className="situacao-icone">{situacaoGeral === 'ok' ? '✓' : '!'}</span>
        <div>
          <strong>
            {situacaoGeral === 'ok'
              ? 'Tudo em dia!'
              : `${pontos.length} ponto${pontos.length > 1 ? 's' : ''} precisa${pontos.length > 1 ? 'm' : ''} da sua atenção`}
          </strong>
          <span>
            {situacaoGeral === 'ok'
              ? 'Pagamentos, contratos e solicitações estão em ordem.'
              : grupos
                  .filter((g) => g.itens.length)
                  .map((g) => `${g.itens.length} em ${g.grupo.toLowerCase()}`)
                  .join(' · ')}
          </span>
        </div>
      </section>

      {/* Números principais (todos clicáveis) */}
      <section className="resumo">
        <button className="resumo-cartao clicavel" onClick={() => irPara('contratos', { situacao: 'ativos' })}>
          <span>Contratos ativos</span>
          <strong>{ativos.length}</strong>
          <small>{inquilinos.length} inquilino(s) cadastrado(s)</small>
        </button>
        <button className="resumo-cartao destaque clicavel" onClick={() => irPara('contratos', { situacao: 'ativos' })}>
          <span>Receita mensal</span>
          <strong>{moeda(receita)}</strong>
          <small>Soma dos aluguéis ativos</small>
        </button>
        <button
          className={`resumo-cartao clicavel ${porStatus[2].quantidade ? 'alerta-vermelho' : ''}`}
          onClick={() => irPara('contratos', { status: 'Atrasado' })}
        >
          <span>Pagamentos atrasados</span>
          <strong>{porStatus[2].quantidade}</strong>
          <small>{porStatus[2].quantidade ? `${moeda(porStatus[2].valor)} em aberto` : 'Nenhum atraso'}</small>
        </button>
        <button
          className={`resumo-cartao clicavel ${lista.some((c) => c.situacao.tipo === 'vencendo') ? 'alerta-amarelo' : ''}`}
          onClick={() => irPara('contratos', { situacao: 'vencendo' })}
        >
          <span>Vencem em 30 dias</span>
          <strong>{lista.filter((c) => c.situacao.tipo === 'vencendo').length}</strong>
          <small>Contratos para renovar</small>
        </button>
        <button className="resumo-cartao clicavel" onClick={() => irPara('solicitacoes')}>
          <span>Solicitações abertas</span>
          <strong>{solicitacoes.filter((s) => !estaEncerrada(s)).length}</strong>
          <small>Ver quadro</small>
        </button>
      </section>

      <div className="inicio-grade">
        {/* Pontos de atenção */}
        <section className="cartao atencao">
          <h2>Pontos de atenção</h2>
          {!pontos.length ? (
            <p className="texto-suave">Nada pendente por aqui. 🎉</p>
          ) : (
            grupos
              .filter((g) => g.itens.length)
              .map((g) => (
                <div key={g.grupo} className="atencao-grupo">
                  <h3>
                    {g.grupo} <span className="contador">{g.itens.length}</span>
                  </h3>
                  <ul>
                    {g.itens.map((p) => (
                      <li key={p.id} className={`alerta alerta-${p.nivel}`}>
                        <div>
                          <strong>{p.titulo}</strong>
                          <span>{p.texto}</span>
                        </div>
                        {p.acao ? (
                          <button className="botao botao-pequeno botao-secundario" onClick={p.acao.executar}>
                            {p.acao.rotulo}
                          </button>
                        ) : (
                          p.abrir && (
                            <button className="botao botao-pequeno botao-secundario" onClick={p.abrir}>
                              Ver
                            </button>
                          )
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
          )}
        </section>

        <div className="inicio-coluna">
          {/* Gráfico: aluguéis do mês por situação do pagamento */}
          <section className="cartao">
            <h2>Aluguéis do mês</h2>
            <p className="grafico-destaque">
              <strong>{percentualRecebido}%</strong> <span className="texto-suave">em dia · {moeda(recebido)} de {moeda(receita)}</span>
            </p>
            <div className="barra-partes" role="img" aria-label={porStatus.map((p) => `${p.status}: ${moeda(p.valor)}`).join(', ')}>
              {porStatus
                .filter((p) => p.valor > 0)
                .map((p) => (
                  <span
                    key={p.status}
                    className="barra-parte"
                    style={{ flexGrow: p.valor, background: CORES_PAGAMENTO[p.status] }}
                    title={`${p.status}: ${moeda(p.valor)} (${p.quantidade} contrato(s))`}
                  />
                ))}
            </div>
            <ul className="legenda">
              {porStatus.map((p) => (
                <li key={p.status}>
                  <button
                    className="legenda-botao"
                    onClick={() => irPara('contratos', { status: p.status })}
                    title={`Ver contratos "${p.status}"`}
                  >
                    <span className="legenda-cor" style={{ background: CORES_PAGAMENTO[p.status] }} />
                    <span>{p.status}</span>
                    <strong>{moeda(p.valor)}</strong>
                    <span className="texto-suave">({p.quantidade})</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Gráfico: receita por imóvel */}
          <section className="cartao">
            <h2>Aluguel por imóvel</h2>
            {!porImovel.length ? (
              <p className="texto-suave">Nenhum contrato ativo.</p>
            ) : (
              <ul className="barras">
                {porImovel.map((c) => (
                  <li key={c.id}>
                    <button
                      className="barras-botao"
                      onClick={() => abrirInquilino(c.inquilino_id)}
                      title={`${c.imovel} · ${c.inquilinos?.nome}: ${moeda(c.valor_aluguel)}`}
                    >
                      <span className="barras-rotulo">{c.imovel.split('·')[0].trim()}</span>
                      <span className="barras-trilho">
                        <span className="barras-valor" style={{ width: `${(Number(c.valor_aluguel) / maiorAluguel) * 100}%` }} />
                      </span>
                      <span className="barras-numero">{moeda(c.valor_aluguel)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Agenda de recebimentos */}
          <section className="cartao">
            <h2>Próximos recebimentos</h2>
            {!agenda.length ? (
              <p className="texto-suave">Nenhum contrato ativo.</p>
            ) : (
              <ul className="agenda">
                {agenda.map((c) => (
                  <li key={c.id}>
                    <span className="agenda-dia">
                      <strong>{String(c.vencimento.data.getDate()).padStart(2, '0')}</strong>
                      <small>{c.vencimento.data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</small>
                    </span>
                    <div>
                      <button className="link" onClick={() => abrirInquilino(c.inquilino_id)}>
                        {c.inquilinos?.nome}
                      </button>
                      <span className="sub">
                        {c.vencimento.dias === 0 ? 'Vence hoje' : `Em ${c.vencimento.dias} dia(s)`} · {c.imovel}
                      </span>
                    </div>
                    <div className="agenda-valor">
                      <strong>{moeda(c.valor_aluguel)}</strong>
                      <Etiqueta valor={c.status_pagamento} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

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
