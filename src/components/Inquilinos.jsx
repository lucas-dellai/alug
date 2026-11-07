// Inquilinos: lista, ficha completa e documentos anexados.
import { useMemo, useState } from 'react';
import { api } from '../api';
import { Etiqueta, Vazio, useUI } from './UI';
import { FormContrato, FormInquilino } from './Formularios';
import Documentos from './Documentos';
import AcessoPortal from './AcessoPortal';
import { ComunicadosDoInquilino } from './Comunicados';
import { BotaoEngrenagem } from './Contratos';
import { InformacoesAdicionais, ModalConfigFicha } from './FichaPersonalizada';
import DetalheSolicitacao from './DetalheSolicitacao';
import {
  analisarContratos,
  analisarSolicitacao,
  dataBR,
  estaEncerrada,
  linkWhatsApp,
  moeda,
  nomeMes,
  primeiroNome,
  semAcento,
} from '../utils';
import { HistoricoPagamentos, ModalConferirPagamento, ModalPagamento } from './Pagamentos';

export default function Inquilinos({ inquilinos, imoveis = [], informes = [], contratos: contratosBrutos, solicitacoes, pagamentos, regras, recarregar, abertoId, abrir }) {
  // Contratos com o status de pagamento calculado pelos pagamentos registrados
  const contratos = useMemo(() => analisarContratos(contratosBrutos, pagamentos, regras), [contratosBrutos, pagamentos, regras]);
  const [busca, setBusca] = useState('');
  const [formulario, setFormulario] = useState(null);

  const aberto = inquilinos.find((i) => i.id === abertoId);
  if (aberto) {
    return (
      <FichaInquilino
        inquilino={aberto}
        inquilinos={inquilinos}
        contratos={contratos.filter((c) => c.inquilino_id === aberto.id)}
        solicitacoes={solicitacoes.filter((s) => s.contratos?.inquilino_id === aberto.id)}
        regras={regras}
        imoveis={imoveis}
        informes={informes}
        recarregar={recarregar}
        voltar={() => abrir(null)}
      />
    );
  }

  const filtrados = inquilinos.filter((i) =>
    semAcento(`${i.nome} ${i.cpf || ''} ${i.telefone || ''} ${i.email || ''}`).includes(semAcento(busca)),
  );

  return (
    <div className="pagina">
      <div className="pagina-topo">
        <div>
          <h1>Inquilinos</h1>
          <p className="texto-suave">Cadastro, documentos e histórico de cada inquilino.</p>
        </div>
        <button className="botao botao-primario" onClick={() => setFormulario({})}>
          + Novo inquilino
        </button>
      </div>

      <section className="cartao">
        <div className="cartao-topo">
          <h2>{inquilinos.length} cadastrado(s)</h2>
          <div className="filtros">
            <input
              type="search"
              placeholder="Buscar por nome, CPF, telefone…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar inquilino"
            />
          </div>
        </div>

        {!inquilinos.length ? (
          <Vazio titulo="Nenhum inquilino ainda" texto="Comece cadastrando o primeiro inquilino.">
            <button className="botao botao-primario" onClick={() => setFormulario({})}>
              + Novo inquilino
            </button>
          </Vazio>
        ) : (
          <div className="lista-inquilinos">
            {filtrados.map((i) => {
              const seus = contratos.filter((c) => c.inquilino_id === i.id);
              const atrasado = seus.some((c) => c.status_pagamento === 'Atrasado');
              return (
                <button key={i.id} className="inquilino-item" onClick={() => abrir(i.id)}>
                  <span className="avatar">{iniciais(i.nome)}</span>
                  <span className="inquilino-dados">
                    <strong>{i.nome}</strong>
                    <span className="sub">
                      {[i.telefone, i.email].filter(Boolean).join(' · ') || 'Sem contato cadastrado'}
                    </span>
                  </span>
                  <span className="inquilino-extra">
                    {seus.length ? (
                      <span className="sub">{seus.length} contrato(s)</span>
                    ) : (
                      <span className="sub">Sem contrato</span>
                    )}
                    {atrasado && <Etiqueta valor="Atrasado" />}
                  </span>
                  <span className="seta-direita">›</span>
                </button>
              );
            })}
            {!filtrados.length && <p className="texto-suave centro">Nenhum inquilino encontrado.</p>}
          </div>
        )}
      </section>

      {formulario && (
        <FormInquilino
          aoFechar={() => setFormulario(null)}
          aoSalvar={(novo) => {
            setFormulario(null);
            recarregar();
            if (novo?.id) abrir(novo.id);
          }}
        />
      )}
    </div>
  );
}

function iniciais(nome) {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

function idade(dataNascimento) {
  if (!dataNascimento) return null;
  const [a, m, d] = dataNascimento.split('-').map(Number);
  const agora = new Date();
  let anos = agora.getFullYear() - a;
  if (agora.getMonth() + 1 < m || (agora.getMonth() + 1 === m && agora.getDate() < d)) anos -= 1;
  return anos;
}

function FichaInquilino({ inquilino, inquilinos, contratos, solicitacoes, regras, imoveis, informes = [], recarregar, voltar }) {
  const [conferindo, setConferindo] = useState(null);
  const { avisar, confirmar } = useUI();
  const [editando, setEditando] = useState(false);
  const [novoContrato, setNovoContrato] = useState(false);
  const [pagando, setPagando] = useState(null);
  const [abertaId, setAbertaId] = useState(null);
  const [configurando, setConfigurando] = useState(false);

  // O que o anfitrião escolheu ver na ficha e os campos que ele criou
  const ocultas = regras?.ficha_ocultas || [];
  const ver = (secao) => !ocultas.includes(secao);
  const camposPersonalizados = regras?.campos_personalizados || [];

  // DELETE
  async function excluir() {
    const ok = await confirmar(
      'Excluir inquilino?',
      `${inquilino.nome} e todos os documentos anexados serão apagados. Essa ação não pode ser desfeita.`,
    );
    if (!ok) return;
    try {
      await api.excluir('inquilinos', inquilino.id);
      avisar('Inquilino excluído.');
      voltar();
      recarregar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    }
  }

  const anos = idade(inquilino.data_nascimento);
  const dados = [
    ['CPF', inquilino.cpf],
    ['RG', inquilino.rg],
    ['Nascimento', inquilino.data_nascimento && `${dataBR(inquilino.data_nascimento)}${anos !== null ? ` (${anos} anos)` : ''}`],
    ['Telefone', inquilino.telefone],
    ['E-mail', inquilino.email],
    ['Profissão', inquilino.profissao],
    ['Renda mensal', inquilino.renda_mensal !== null && inquilino.renda_mensal !== undefined ? moeda(inquilino.renda_mensal) : null],
    ['Contato de emergência', inquilino.contato_emergencia],
  ];

  // Comprometimento de renda: aluguel / renda
  const aluguelTotal = contratos.reduce((s, c) => s + Number(c.valor_aluguel), 0);
  const comprometimento =
    inquilino.renda_mensal > 0 && aluguelTotal > 0 ? Math.round((aluguelTotal / inquilino.renda_mensal) * 100) : null;

  return (
    <div className="pagina">
      <button className="voltar" onClick={voltar}>
        ← Todos os inquilinos
      </button>

      <div className="pagina-topo">
        <div className="ficha-titulo">
          <span className="avatar avatar-grande">{iniciais(inquilino.nome)}</span>
          <div>
            <h1>{inquilino.nome}</h1>
          </div>
        </div>
        <div className="botoes">
          <BotaoEngrenagem aoClicar={() => setConfigurando(true)} />
          <button className="botao botao-secundario" onClick={() => setEditando(true)}>
            Editar dados
          </button>
          <button className="botao botao-perigo-leve" onClick={excluir}>
            Excluir
          </button>
        </div>
      </div>

      {ver('resumo') && (
      <ResumoInquilino
        inquilino={inquilino}
        contratos={contratos}
        solicitacoes={solicitacoes}
        aoPagar={setPagando}
        aoAbrirSolicitacao={setAbertaId}
        informes={informes.filter((i) => contratos.some((c) => c.id === i.contrato_id))}
        aoConferir={setConferindo}
      />
      )}
      {conferindo && (
        <ModalConferirPagamento
          informe={conferindo}
          aoFechar={() => setConferindo(null)}
          aoSalvar={() => {
            setConferindo(null);
            recarregar();
          }}
        />
      )}

      {ver('comunicados') && <ComunicadosDoInquilino inquilino={inquilino} />}

      <div className="ficha-grade">
        <div className="ficha-coluna">
        {ver('dados') && (
        <section className="cartao">
          <h2>Dados pessoais</h2>
          <dl className="dados">
            {dados.map(([rotulo, valor]) => (
              <div key={rotulo}>
                <dt>{rotulo}</dt>
                <dd>{valor || <span className="texto-suave">Não informado</span>}</dd>
              </div>
            ))}
          </dl>
          <p className="sub pequeno">Cadastrado em {dataBR(inquilino.criado_em)}</p>
          {comprometimento !== null && (
            <p className={`comprometimento ${comprometimento > 30 ? 'alto' : ''}`}>
              O aluguel compromete <strong>{comprometimento}%</strong> da renda informada
              {comprometimento > 30 ? ' (acima dos 30% recomendados)' : ''}.
            </p>
          )}
          {inquilino.observacoes && (
            <div className="observacoes">
              <dt>Observações</dt>
              <dd>{inquilino.observacoes}</dd>
            </div>
          )}
        </section>
        )}
        {ver('adicionais') && (
          <InformacoesAdicionais
            inquilino={inquilino}
            campos={camposPersonalizados.filter((c) => c.tipo !== 'anexo')}
            aoConfigurar={() => setConfigurando(true)}
          />
        )}
        </div>

        <div className="ficha-coluna">
          {ver('documentos') && (
            <Documentos inquilinoId={inquilino.id} camposAnexo={camposPersonalizados.filter((c) => c.tipo === 'anexo')} />
          )}
          {ver('acesso') && <AcessoPortal inquilino={inquilino} />}
        </div>
      </div>

      {ver('contratos') && (
      <section className="cartao">
        <div className="cartao-topo">
          <h2>Contratos</h2>
          <button className="botao botao-pequeno botao-secundario" onClick={() => setNovoContrato(true)}>
            + Novo contrato
          </button>
        </div>
        {!contratos.length ? (
          <p className="texto-suave">Nenhum contrato para este inquilino.</p>
        ) : (
          contratos.map((c) => (
            <div key={c.id} className="contrato-bloco">
              <div className="contrato-bloco-topo">
                <div>
                  <strong>{c.imovel}</strong>
                  <span className="sub">
                    {moeda(c.valor_aluguel)} · todo dia {c.dia_vencimento} · {dataBR(c.data_inicio)} a {dataBR(c.data_fim)}
                  </span>
                </div>
                <div className="etiquetas">
                  <Etiqueta valor={c.situacao.tipo}>{c.situacao.texto}</Etiqueta>
                  <Etiqueta valor={c.status_pagamento} />
                  {c.situacao.tipo !== 'encerrado' && (
                    <button className="botao botao-pequeno botao-primario" onClick={() => setPagando(c)}>
                      Registrar pagamento
                    </button>
                  )}
                </div>
              </div>
              {c.atraso && (
                <p className="atraso-resumo">
                  {c.atraso.quantidade} mês(es) em aberto · cobrar <strong>{moeda(c.atraso.total)}</strong> (aluguel{' '}
                  {moeda(c.atraso.valor)} + multa {moeda(c.atraso.multa)} + juros {moeda(c.atraso.juros)})
                </p>
              )}
              <h3 className="subtitulo-secao">Pagamentos</h3>
              <HistoricoPagamentos contrato={c} recarregar={recarregar} limite={6} />
            </div>
          ))
        )}
      </section>
      )}

      {ver('solicitacoes') && (
      <section className="cartao">
        <h2>Solicitações</h2>
        {!solicitacoes.length ? (
          <p className="texto-suave">Nenhuma solicitação registrada.</p>
        ) : (
          <ul className="lista-simples lista-clicavel">
            {solicitacoes.map((s) => (
              <li key={s.id} onClick={() => setAbertaId(s.id)} role="button" tabIndex={0} title="Abrir solicitação">
                <div>
                  <strong>{s.titulo}</strong>
                  <span className="sub">
                    {s.tipo} · aberta em {dataBR(s.data_abertura)}
                  </span>
                </div>
                <div className="etiquetas">
                  <Etiqueta valor={s.prioridade}>Prioridade {s.prioridade.toLowerCase()}</Etiqueta>
                  <Etiqueta valor={s.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {configurando && (
        <ModalConfigFicha
          regras={regras}
          aoFechar={() => setConfigurando(false)}
          aoSalvar={() => {
            setConfigurando(false);
            recarregar();
          }}
        />
      )}

      {abertaId && solicitacoes.find((s) => s.id === abertaId) && (
        <DetalheSolicitacao
          solicitacao={solicitacoes.find((s) => s.id === abertaId)}
          contratos={contratos}
          aoFechar={() => setAbertaId(null)}
          aoAtualizar={recarregar}
        />
      )}

      {editando && (
        <FormInquilino
          inquilino={inquilino}
          aoFechar={() => setEditando(false)}
          aoSalvar={() => {
            setEditando(false);
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
      {novoContrato && (
        <FormContrato
          inquilinos={inquilinos}
          imoveis={imoveis}
          regras={regras}
          inquilinoFixo={inquilino.id}
          aoFechar={() => setNovoContrato(false)}
          aoSalvar={() => {
            setNovoContrato(false);
            recarregar();
          }}
        />
      )}
    </div>
  );
}

// Resumo no topo da ficha: o que precisa de atenção com este inquilino, já com o botão para resolver.
function ResumoInquilino({ inquilino, contratos, solicitacoes, aoPagar, aoAbrirSolicitacao, informes = [], aoConferir }) {
  const ativos = contratos.filter((c) => c.situacao.tipo !== 'encerrado');
  const abertas = solicitacoes.filter((s) => !estaEncerrada(s));
  const totalAtraso = contratos.reduce((s, c) => s + (c.atraso?.total || 0), 0);
  const aluguel = ativos.reduce((s, c) => s + Number(c.valor_aluguel), 0);
  const statusGeral = contratos.some((c) => c.status_pagamento === 'Atrasado')
    ? 'Atrasado'
    : ativos.some((c) => c.status_pagamento === 'Pendente')
      ? 'Pendente'
      : ativos.length
        ? 'Em dia'
        : null;
  const proximoFim = ativos.map((c) => c.data_fim).sort()[0];
  // Parcela do contrato principal (o que define a situação do pagamento)
  const principal =
    contratos.find((c) => c.status_pagamento === 'Atrasado') ||
    ativos.find((c) => c.status_pagamento === 'Pendente') ||
    ativos[0];
  const parcela = principal?.parcela;

  const pontos = [];
  for (const i of informes) {
    pontos.push({
      cor: 'azul',
      titulo: 'Pagamento informado, aguardando sua conferência',
      texto: `${nomeMes(i.referencia)} · ${moeda(i.valor)} · ${i.forma} · pago em ${dataBR(i.data_pagamento)}`,
      acoes: (
        <button className="botao botao-pequeno botao-primario" onClick={() => aoConferir(i)}>
          Conferir
        </button>
      ),
    });
  }
  for (const c of contratos) {
    if (c.atraso) {
      const texto = `Olá, ${primeiroNome(inquilino.nome)}! Tudo bem? Consta em aberto o aluguel de ${c.imovel}: ${moeda(c.atraso.total)} (com multa e juros). Pode me confirmar o pagamento?`;
      const whatsapp = linkWhatsApp(inquilino.telefone);
      pontos.push({
        cor: 'vermelho',
        titulo: `Aluguel atrasado há ${c.atraso.dias} dia(s)${c.parcela ? ` · parcela ${c.parcela.texto}` : ''}`,
        texto: `${c.imovel} · ${c.atraso.quantidade} mês(es) em aberto · cobrar ${moeda(c.atraso.total)} (aluguel ${moeda(c.atraso.valor)} + multa ${moeda(c.atraso.multa)} + juros ${moeda(c.atraso.juros)})`,
        acoes: (
          <>
            <button className="botao botao-pequeno botao-primario" onClick={() => aoPagar(c)}>
              Registrar pagamento
            </button>
            {whatsapp && (
              <a className="botao botao-pequeno botao-secundario" href={`${whatsapp}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer">
                Cobrar no WhatsApp
              </a>
            )}
          </>
        ),
      });
    } else if (c.status_pagamento === 'Pendente' && c.situacao.tipo !== 'encerrado') {
      pontos.push({
        cor: 'amarelo',
        titulo: c.vencimento.dias > 0 ? 'Aluguel do mês ainda não pago' : 'Pagamento do mês pendente',
        texto: `${c.imovel} · ${moeda(c.valor_aluguel)} · ${c.vencimento.dias > 0 ? `vence em ${dataBR(c.vencimento.data)} (faltam ${c.vencimento.dias} dia(s))` : `venceu em ${dataBR(c.vencimento.data)}, ainda na tolerância`}`,
        acoes: (
          <button className="botao botao-pequeno botao-primario" onClick={() => aoPagar(c)}>
            Registrar pagamento
          </button>
        ),
      });
    }
    if (c.situacao.tipo === 'encerrado' && !c.atraso) {
      pontos.push({ cor: 'vermelho', titulo: 'Contrato vencido', texto: `${c.imovel} · terminou em ${dataBR(c.data_fim)}. Renove na aba Contratos.` });
    } else if (c.situacao.tipo === 'vencendo') {
      pontos.push({ cor: 'amarelo', titulo: `Contrato ${c.situacao.texto.toLowerCase()}`, texto: `${c.imovel} · termina em ${dataBR(c.data_fim)}. ${c.renovacao?.disponivel ? 'A renovação já está liberada na aba Contratos.' : `A renovação libera em ${dataBR(c.renovacao?.inicioJanela)}.`}` });
    }
    if (c.reajuste?.disponivel && c.situacao.tipo !== 'encerrado') {
      pontos.push({ cor: 'azul', titulo: 'Reajuste disponível', texto: `${c.imovel} · ${c.indice_reajuste} · aplique na aba Contratos.` });
    }
  }
  for (const s of abertas) {
    const analise = analisarSolicitacao(s);
    if (!analise.alertas.length) continue;
    const grave = analise.alertas.some((a) => a.tipo === 'vencido' || a.tipo === 'alta');
    pontos.push({
      cor: grave ? 'vermelho' : 'amarelo',
      titulo: `Solicitação: ${s.titulo}`,
      texto: `${s.status} · ${analise.alertas.map((a) => a.texto).join(' · ')}`,
      acoes: (
        <button className="botao botao-pequeno botao-secundario" onClick={() => aoAbrirSolicitacao(s.id)}>
          Abrir
        </button>
      ),
    });
  }

  return (
    <section className="resumo-inquilino">
      <div className="resumo-inquilino-numeros">
        <div className={`mini-resumo ${statusGeral === 'Atrasado' ? 'mini-vermelho' : statusGeral === 'Pendente' ? 'mini-amarelo' : ''}`}>
          <span>
            Pagamento do mês
            {parcela && <em className="parcela" title={`Parcela ${parcela.numero} de ${parcela.total} (${parcela.mes})`}>{parcela.texto}</em>}
          </span>
          <strong>{statusGeral === 'Atrasado' ? `Atrasado · ${moeda(totalAtraso)}` : statusGeral || 'Sem contrato'}</strong>
        </div>
        <div className="mini-resumo">
          <span>Aluguel</span>
          <strong>{ativos.length ? moeda(aluguel) : '—'}</strong>
        </div>
        <div className="mini-resumo">
          <span>Contrato vence em</span>
          <strong>{proximoFim ? dataBR(proximoFim) : '—'}</strong>
        </div>
        <div className={`mini-resumo ${abertas.length ? 'mini-azul' : ''}`}>
          <span>Solicitações abertas</span>
          <strong>{abertas.length}</strong>
        </div>
      </div>

      {pontos.length ? (
        <ul className="pontos-inquilino">
          {pontos.map((p, i) => (
            <li key={i} className={`alerta alerta-${p.cor}`}>
              <div>
                <strong>{p.titulo}</strong>
                <span>{p.texto}</span>
              </div>
              {p.acoes && <div className="alerta-acoes">{p.acoes}</div>}
            </li>
          ))}
        </ul>
      ) : (
        contratos.length > 0 && (
          <p className="alerta alerta-verde">
            <strong>✓ Tudo em dia com {primeiroNome(inquilino.nome)}</strong>
          </p>
        )
      )}
    </section>
  );
}
