// Portal do Inquilino: o que o inquilino vê quando faz login.
// O banco só entrega os dados dele (regras RLS), então ele nunca vê outros inquilinos.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { APP } from '../config';
import { Carregando, Etiqueta, Vazio, useUI } from './UI';
import { Avatar, MenuUsuario, ModalPerfil } from './Perfil';
import { FormSolicitacao } from './Formularios';
import DetalheSolicitacao from './DetalheSolicitacao';
import Documentos from './Documentos';
import { HistoricoPagamentos, ModalInformarPagamento } from './Pagamentos';
import { ComunicadosDoPortal } from './Comunicados';
import { AdvertenciasDoPortal } from './Advertencias';
import {
  analisarContratos,
  dataBR,
  especificacoes,
  listaDeRegras,
  linkWhatsApp,
  moeda,
  primeiroNome,
  saudacao,
  nomeMes,
} from '../utils';

const FINALIZADAS = ['Concluída', 'Recusada'];

const PORTAL_ABAS = [
  { id: 'inicio', rotulo: 'Início', icone: 'M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { id: 'aluguel', rotulo: 'Meu aluguel', icone: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm6 1v5h5M9 13h7M9 17h5' },
  { id: 'solicitacoes', rotulo: 'Solicitações', icone: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z' },
  { id: 'avisos', rotulo: 'Avisos', icone: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0' },
];

function Icone({ caminho }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={caminho} />
    </svg>
  );
}

export default function Portal({ perfil, setPerfil }) {
  const { avisar } = useUI();
  const [contratos, setContratos] = useState([]);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [regras, setRegras] = useState(undefined);
  const [comunicados, setComunicados] = useState([]);
  const [imoveis, setImoveis] = useState([]);
  const [informes, setInformes] = useState([]);
  const [advertencias, setAdvertencias] = useState([]);
  const [informando, setInformando] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [novaSolicitacao, setNovaSolicitacao] = useState(false);
  const [abertaId, setAbertaId] = useState(null);
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [aba, setAba] = useState('inicio');

  const recarregar = useCallback(async () => {
    try {
      const [c, s, p, r, com, im, inf, adv] = await Promise.all([
        api.listar('contratos'),
        api.listar('solicitacoes'),
        api.listar('pagamentos'),
        api.listar('configuracoes').catch(() => undefined),
        api.listar('comunicados').catch(() => []),
        api.listar('imoveis').catch(() => []),
        api.listar('informes').catch(() => []),
        api.listar('advertencias').catch(() => []),
      ]);
      setInformes(inf);
      setAdvertencias(adv);
      setRegras(r);
      setComunicados(com);
      setImoveis(im);
      setContratos(c);
      setSolicitacoes(s);
      setPagamentos(p);
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setCarregando(false);
    }
  }, [avisar]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const lista = useMemo(() => analisarContratos(contratos, pagamentos, regras), [contratos, pagamentos, regras]);
  const anfitriao = perfil.anfitriao;
  const whatsapp = linkWhatsApp(anfitriao?.telefone);

  const avisosPendentes =
    advertencias.filter((a) => !a.resposta).length + comunicados.filter((c) => c.pede_resposta && !c.resposta).length;
  const solicitacoesAbertas = solicitacoes.filter((s) => !FINALIZADAS.includes(s.status));

  function irPara(id) {
    setAba(id);
    window.scrollTo(0, 0);
  }

  const botoesAbas = (classe) =>
    PORTAL_ABAS.map((a) => (
      <button
        key={a.id}
        className={`${classe} ${aba === a.id ? `${classe}-ativa` : ''}`}
        onClick={() => irPara(a.id)}
        aria-current={aba === a.id ? 'page' : undefined}
      >
        <Icone caminho={a.icone} />
        <span>{a.rotulo}</span>
        {a.id === 'avisos' && avisosPendentes > 0 && <span className="aba-contador">{avisosPendentes}</span>}
        {a.id === 'solicitacoes' && solicitacoesAbertas.length > 0 && (
          <span className="aba-contador aba-contador-neutro">{solicitacoesAbertas.length}</span>
        )}
      </button>
    ));

  const semContrato = (
    <section className="cartao">
      <Vazio titulo="Nenhum contrato encontrado" texto="Fale com o anfitrião se achar que isso é um erro." />
    </section>
  );

  return (
    <div className="app">
      <header className="cabecalho">
        <div className="cabecalho-conteudo">
          <div className="marca">
            <img src={APP.logo} alt="" width="34" height="34" />
            <div>
              <strong>{APP.nome}</strong>
              <span>Portal do Inquilino</span>
            </div>
          </div>
          <nav className="abas" aria-label="Seções">
            {botoesAbas('aba')}
          </nav>
          <MenuUsuario perfil={perfil} rotuloPapel="Inquilino" aoEditarPerfil={() => setEditandoPerfil(true)} />
        </div>
      </header>

      <main className="conteudo">
        {carregando ? (
          <Carregando texto="Buscando seu contrato…" />
        ) : (
          <div className="pagina">
            {/* ===== INÍCIO: só o essencial do mês ===== */}
            {aba === 'inicio' && (
              <>
                <div>
                  <h1>
                    {saudacao()}, {primeiroNome(perfil.nome)}!
                  </h1>
                  {lista[0] && (
                    <p className="texto-suave">
                      {imoveis.find((i) => i.id === lista[0].imovel_id)?.nome || lista[0].imovel}
                    </p>
                  )}
                </div>

                {avisosPendentes > 0 && (
                  <button className="faixa-pendencia" onClick={() => irPara('avisos')}>
                    <span className="faixa-pendencia-icone" aria-hidden="true">!</span>
                    <span>
                      <strong>
                        {avisosPendentes === 1 ? 'Você tem 1 aviso para responder' : `Você tem ${avisosPendentes} avisos para responder`}
                      </strong>
                      <span className="sub">O anfitrião está aguardando sua resposta</span>
                    </span>
                    <span className="seta-direita">›</span>
                  </button>
                )}

                {!lista.length && semContrato}

                {lista.map((c) => (
                  <div key={c.id} className="portal-grade">
                    <CartaoPagamento
                      contrato={c}
                      informes={informes.filter((i) => i.contrato_id === c.id)}
                      anfitriao={anfitriao}
                      aoInformar={() => setInformando(c)}
                    />
                    <ResumoContrato contrato={c} aoVerMais={() => irPara('aluguel')} />
                  </div>
                ))}

                <div className="portal-grade">
                  <section className="cartao">
                    <div className="cartao-topo">
                      <h2>Solicitações em andamento</h2>
                      <button className="link pequeno" onClick={() => irPara('solicitacoes')}>
                        Ver todas ›
                      </button>
                    </div>
                    {!solicitacoesAbertas.length ? (
                      <p className="texto-suave">Nenhuma solicitação em aberto.</p>
                    ) : (
                      <ListaSolicitacoes itens={solicitacoesAbertas.slice(0, 3)} abrir={setAbertaId} />
                    )}
                  </section>

                  <section className="cartao">
                    <h2>Atalhos</h2>
                    <div className="atalhos">
                      {lista.length > 0 && (
                        <button className="atalho" onClick={() => setNovaSolicitacao(true)}>
                          <Icone caminho="M12 5v14M5 12h14" />
                          <span>Nova solicitação</span>
                        </button>
                      )}
                      {whatsapp && (
                        <a className="atalho" href={whatsapp} target="_blank" rel="noreferrer">
                          <Icone caminho="M21 12a9 9 0 0 1-13.4 7.8L3 21l1.3-4.5A9 9 0 1 1 21 12z" />
                          <span>Falar com o anfitrião</span>
                        </a>
                      )}
                      <button className="atalho" onClick={() => irPara('aluguel')}>
                        <Icone caminho="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
                        <span>Regras do imóvel</span>
                      </button>
                      <button className="atalho" onClick={() => irPara('aluguel')}>
                        <Icone caminho="M3 7h18M3 12h18M3 17h12" />
                        <span>Meus pagamentos</span>
                      </button>
                    </div>
                  </section>
                </div>
              </>
            )}

            {/* ===== MEU ALUGUEL: contrato, imóvel, regras, pagamentos e documentos ===== */}
            {aba === 'aluguel' && (
              <>
                <h1>Meu aluguel</h1>
                {!lista.length && semContrato}
                {lista.map((c) => (
                  <div key={c.id} className="portal-grade">
                    <InfoAluguel contrato={c} imovel={imoveis.find((i) => i.id === c.imovel_id)} regras={c.regras} />
                    <div className="ficha-coluna">
                      <section className="cartao">
                        <h2>Histórico de pagamentos</h2>
                        <HistoricoPagamentos contrato={c} somenteLeitura limite={12} />
                      </section>
                    </div>
                  </div>
                ))}
                <div className="portal-grade">
                  <Documentos somenteLeitura />
                  {anfitriao && (
                    <section className="cartao contato-anfitriao">
                      <h2>Seu anfitrião</h2>
                      <div className="contato">
                        <Avatar nome={anfitriao.nome} foto={anfitriao.foto_url} tamanho={52} />
                        <div>
                          <strong>{anfitriao.nome}</strong>
                          {anfitriao.telefone && <span className="sub">{anfitriao.telefone}</span>}
                          {anfitriao.email && <span className="sub">{anfitriao.email}</span>}
                        </div>
                      </div>
                      {whatsapp && (
                        <a className="botao botao-primario botao-pequeno" href={whatsapp} target="_blank" rel="noreferrer">
                          Chamar no WhatsApp
                        </a>
                      )}
                    </section>
                  )}
                </div>
              </>
            )}

            {/* ===== SOLICITAÇÕES: abrir e acompanhar ===== */}
            {aba === 'solicitacoes' && (
              <AbaSolicitacoes
                solicitacoes={solicitacoes}
                podeAbrir={lista.length > 0}
                aoNova={() => setNovaSolicitacao(true)}
                abrir={setAbertaId}
              />
            )}

            {/* ===== AVISOS: comunicados e advertências ===== */}
            {aba === 'avisos' && (
              <>
                <div>
                  <h1>Avisos</h1>
                  <p className="texto-suave">Comunicados e advertências enviados pelo anfitrião.</p>
                </div>
                {!comunicados.length && !advertencias.length ? (
                  <section className="cartao">
                    <Vazio titulo="Nenhum aviso por aqui" texto="Quando o anfitrião enviar um comunicado, ele aparece nesta aba." />
                  </section>
                ) : (
                  <>
                    <AdvertenciasDoPortal advertencias={advertencias} recarregar={recarregar} completo />
                    <ComunicadosDoPortal comunicados={comunicados} recarregar={recarregar} completo />
                  </>
                )}
              </>
            )}
          </div>
        )}
      </main>

      <footer className="rodape">{APP.nome} · Portal do Inquilino</footer>

      <nav className="nav-inferior nav-inferior-4" aria-label="Seções">
        {botoesAbas('nav-item')}
      </nav>

      {informando && (
        <ModalInformarPagamento
          contrato={informando}
          aoFechar={() => setInformando(null)}
          aoSalvar={() => {
            setInformando(null);
            recarregar();
          }}
        />
      )}
      {novaSolicitacao && (
        <FormSolicitacao
          modoInquilino
          contratos={contratos}
          aoFechar={() => setNovaSolicitacao(false)}
          aoSalvar={(nova) => {
            setNovaSolicitacao(false);
            recarregar();
            // Abre a solicitação para o inquilino poder anexar fotos
            if (nova?.id) setAbertaId(nova.id);
          }}
        />
      )}
      {abertaId && solicitacoes.find((s) => s.id === abertaId) && (
        <DetalheSolicitacao
          modoInquilino
          solicitacao={solicitacoes.find((s) => s.id === abertaId)}
          aoFechar={() => setAbertaId(null)}
          aoAtualizar={recarregar}
        />
      )}
      {editandoPerfil && (
        <ModalPerfil
          perfil={perfil}
          aoFechar={() => setEditandoPerfil(false)}
          aoSalvar={(novo) => {
            setPerfil((p) => ({ ...p, ...novo }));
            setEditandoPerfil(false);
          }}
        />
      )}
    </div>
  );
}

// Cartão principal do Início: quanto pagar, até quando, e o botão "Realizei o pagamento"
function CartaoPagamento({ contrato: c, informes, anfitriao, aoInformar }) {
  const classe = c.status_pagamento === 'Em dia' ? 'ok' : c.status_pagamento === 'Atrasado' ? 'atrasado' : 'pendente';
  return (
    <section className={`cartao portal-pagamento pagamento-${classe}`}>
      <span className="texto-suave">
        Pagamento do mês
        {c.parcela && <em className="parcela" title={`Parcela ${c.parcela.numero} de ${c.parcela.total}`}>{c.parcela.texto}</em>}
      </span>
      {c.atraso ? (
        <>
          <strong className="portal-valor">{moeda(c.atraso.total)}</strong>
          <Etiqueta valor="Atrasado">
            {c.atraso.quantidade > 1 ? `${c.atraso.quantidade} meses em aberto` : `Atrasado há ${c.atraso.dias} dia(s)`}
          </Etiqueta>
          <dl className="portal-conta">
            <div>
              <dt>Aluguel{c.atraso.quantidade > 1 ? ` (${c.atraso.quantidade} meses)` : ''}</dt>
              <dd>{moeda(c.atraso.valor)}</dd>
            </div>
            <div>
              <dt>Multa ({Number(c.multa_atraso)}%)</dt>
              <dd>{moeda(c.atraso.multa)}</dd>
            </div>
            <div>
              <dt>Juros ({Number(c.juros_mes)}% ao mês)</dt>
              <dd>{moeda(c.atraso.juros)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <>
          <strong className="portal-valor">{moeda(c.valor_aluguel)}</strong>
          <Etiqueta valor={c.status_pagamento}>
            {c.status_pagamento === 'Em dia' ? 'Pagamento em dia' : 'Pagamento pendente'}
          </Etiqueta>
          <p className="texto-suave">
            Próximo vencimento: <strong>{dataBR(c.vencimento.data)}</strong>
            {c.vencimento.dias === 0 ? ' (hoje)' : ` (em ${c.vencimento.dias} dia(s))`}
          </p>
        </>
      )}
      <AvisoPagamentoInformado contrato={c} informes={informes} anfitriao={anfitriao} aoInformar={aoInformar} />
    </section>
  );
}

// Resumo curto do contrato no Início, com atalho para a aba "Meu aluguel"
function ResumoContrato({ contrato: c, aoVerMais }) {
  return (
    <section className="cartao">
      <div className="cartao-topo">
        <h2>Meu contrato</h2>
        <button className="link pequeno" onClick={aoVerMais}>
          Ver detalhes ›
        </button>
      </div>
      <dl className="dados dados-compactos">
        <div>
          <dt>Parcela</dt>
          <dd>{c.parcela ? `${c.parcela.numero} de ${c.parcela.total}` : '—'}</dd>
        </div>
        <div>
          <dt>Vencimento</dt>
          <dd>Todo dia {c.dia_vencimento}</dd>
        </div>
        <div>
          <dt>Contrato até</dt>
          <dd>{dataBR(c.data_fim)}</dd>
        </div>
        <div>
          <dt>Situação</dt>
          <dd>
            <Etiqueta valor={c.situacao.tipo}>{c.situacao.texto}</Etiqueta>
          </dd>
        </div>
      </dl>
      {c.pagamento.ultimo && (
        <p className="texto-suave pequeno">
          Último pagamento registrado: {dataBR(c.pagamento.ultimo.data_pagamento)} · {moeda(c.pagamento.ultimo.valor_pago)}
        </p>
      )}
    </section>
  );
}

function ListaSolicitacoes({ itens, abrir }) {
  return (
    <ul className="lista-simples lista-clicavel">
      {itens.map((s) => (
        <li key={s.id} onClick={() => abrir(s.id)} role="button" tabIndex={0} title="Abrir solicitação">
          <div>
            <strong>{s.titulo}</strong>
            <span className="sub">
              {s.tipo} · aberta em {dataBR(s.data_abertura)}
              {s.prazo && !FINALIZADAS.includes(s.status) ? ` · previsão ${dataBR(s.prazo)}` : ''}
            </span>
          </div>
          <div className="etiquetas">
            <Etiqueta valor={s.status} />
            <span className="seta-direita">›</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Aba de solicitações: abrir uma nova e acompanhar as anteriores por situação
function AbaSolicitacoes({ solicitacoes, podeAbrir, aoNova, abrir }) {
  const abertas = solicitacoes.filter((s) => !FINALIZADAS.includes(s.status));
  const finalizadas = solicitacoes.filter((s) => FINALIZADAS.includes(s.status));
  const [filtro, setFiltro] = useState(abertas.length || !finalizadas.length ? 'abertas' : 'finalizadas');
  const FILTROS = [
    { id: 'abertas', rotulo: 'Em andamento', itens: abertas },
    { id: 'finalizadas', rotulo: 'Finalizadas', itens: finalizadas },
    { id: 'todas', rotulo: 'Todas', itens: solicitacoes },
  ];
  const atual = FILTROS.find((f) => f.id === filtro);

  return (
    <>
      <div className="pagina-topo">
        <div>
          <h1>Solicitações</h1>
          <p className="texto-suave">Peça consertos, manutenções ou o que precisar e acompanhe a resposta.</p>
        </div>
        {podeAbrir && (
          <button className="botao botao-primario" onClick={aoNova}>
            + Nova solicitação
          </button>
        )}
      </div>

      <div className="filtro-chips" role="tablist" aria-label="Situação">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filtro === f.id}
            className={`chip ${filtro === f.id ? 'chip-ativo' : ''}`}
            onClick={() => setFiltro(f.id)}
          >
            {f.rotulo} <span className="chip-numero">{f.itens.length}</span>
          </button>
        ))}
      </div>

      <section className="cartao">
        {!atual.itens.length ? (
          <Vazio
            titulo={filtro === 'finalizadas' ? 'Nenhuma solicitação finalizada' : 'Nenhuma solicitação em andamento'}
            texto={podeAbrir ? 'Precisa de algo? Toque em "+ Nova solicitação".' : ''}
          />
        ) : (
          <ListaSolicitacoes itens={atual.itens} abrir={abrir} />
        )}
      </section>
    </>
  );
}

// Informações do aluguel para o inquilino: imóvel, o que está incluso, datas e regras de cobrança
function InfoAluguel({ contrato: c, imovel, regras }) {
  const specs = especificacoes(imovel);
  const tolerancia = Number(regras?.dias_tolerancia || 0);
  return (
    <section className="cartao info-aluguel">
      {imovel?.foto_url && <img className="info-aluguel-foto" src={imovel.foto_url} alt={`Foto de ${imovel.nome}`} />}
      <h2>Imóvel e contrato</h2>
      <p className="info-aluguel-imovel">
        <strong>{imovel?.nome || c.imovel}</strong>
        <span className="sub">{imovel ? `${imovel.tipo} · ${imovel.endereco}` : ''}</span>
        {specs && <span className="sub">{specs}</span>}
      </p>

      {(imovel?.incluso?.length > 0 || imovel?.nao_incluso?.length > 0) && (
        <div className="imovel-inclusos">
          {imovel.incluso?.length > 0 && (
            <p>
              <span className="inclui-sim">✓ Incluso no aluguel:</span> {imovel.incluso.join(', ')}
            </p>
          )}
          {imovel.nao_incluso?.length > 0 && (
            <p>
              <span className="inclui-nao">✕ Por sua conta:</span> {imovel.nao_incluso.join(', ')}
            </p>
          )}
        </div>
      )}

      {listaDeRegras(imovel?.regras).length > 0 && (
        <div className="regras-imovel">
          <h3>Regras do imóvel</h3>
          <ul>
            {listaDeRegras(imovel.regras).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <dl className="dados">
        <div>
          <dt>Valor do aluguel</dt>
          <dd>{moeda(c.valor_aluguel)}</dd>
        </div>
        <div>
          <dt>Vencimento</dt>
          <dd>Todo dia {c.dia_vencimento}</dd>
        </div>
        <div>
          <dt>Parcela atual</dt>
          <dd>{c.parcela ? `${c.parcela.numero} de ${c.parcela.total}` : '—'}</dd>
        </div>
        <div>
          <dt>Contrato</dt>
          <dd>
            {dataBR(c.data_inicio)} a {dataBR(c.data_fim)}
          </dd>
        </div>
        <div>
          <dt>Situação</dt>
          <dd>
            <Etiqueta valor={c.situacao.tipo}>{c.situacao.texto}</Etiqueta>
          </dd>
        </div>
        <div>
          <dt>Próximo reajuste</dt>
          <dd>
            {dataBR(c.reajuste.proximo)} ({c.indice_reajuste})
          </dd>
        </div>
        <div>
          <dt>Garantia</dt>
          <dd>{c.tipo_garantia}</dd>
        </div>
        <div>
          <dt>Se atrasar</dt>
          <dd>
            {[
              regras?.cobrar_multa !== false && Number(c.multa_atraso) > 0 && `multa de ${Number(c.multa_atraso)}%`,
              regras?.cobrar_juros !== false && Number(c.juros_mes) > 0 && `juros de ${Number(c.juros_mes)}% ao mês`,
            ]
              .filter(Boolean)
              .join(' + ') || 'sem multa e juros'}
            {tolerancia > 0 && ` (após ${tolerancia} dia${tolerancia > 1 ? 's' : ''} de tolerância)`}
          </dd>
        </div>
      </dl>
      {imovel?.descricao && <p className="sub">{imovel.descricao}</p>}
    </section>
  );
}

// Botão "Realizei o pagamento" e a situação do que o inquilino já informou
function AvisoPagamentoInformado({ contrato, informes, anfitriao, aoInformar }) {
  const aguardando = informes.find((i) => i.status === 'Aguardando');
  const ultimo = informes[0];
  const mesesAbertos = contrato.pagamento.emAberto.map((d) => d.toISOString().slice(0, 7));
  const recusado =
    ultimo?.status === 'Recusado' && mesesAbertos.includes(String(ultimo.referencia).slice(0, 7)) ? ultimo : null;
  const confirmadoRecente =
    ultimo?.status === 'Confirmado' && Date.now() - new Date(ultimo.analisado_em).getTime() < 7 * 86400000 ? ultimo : null;

  return (
    <div className="pagamento-informar">
      {aguardando && (
        <p className="aviso-pagamento aviso-analise">
          <strong>⏳ Pagamento informado, aguardando conferência</strong>
          <span>
            {nomeMes(aguardando.referencia)} · {moeda(aguardando.valor)} · enviado em {new Date(aguardando.criado_em).toLocaleDateString('pt-BR')}
          </span>
        </p>
      )}
      {recusado && !aguardando && (
        <p className="aviso-pagamento aviso-recusado">
          <strong>✕ O anfitrião não confirmou o pagamento de {nomeMes(recusado.referencia).toLowerCase()}</strong>
          <span>“{recusado.motivo_recusa}”</span>
        </p>
      )}
      {confirmadoRecente && !aguardando && !recusado && (
        <p className="aviso-pagamento aviso-confirmado">
          <strong>✓ Pagamento de {nomeMes(confirmadoRecente.referencia).toLowerCase()} confirmado</strong>
        </p>
      )}
      {!aguardando && contrato.status_pagamento === 'Pendente' && !contrato.atraso && contrato.vencimento.dias <= 5 && (
        <p className="aviso-pagamento aviso-lembrete">
          <strong>⏰ {contrato.vencimento.dias === 0 ? 'Seu aluguel vence hoje' : `Seu aluguel vence em ${contrato.vencimento.dias} dia(s)`}</strong>
        </p>
      )}
      {!aguardando && contrato.status_pagamento !== 'Em dia' && anfitriao?.pix_chave && <CaixaPix anfitriao={anfitriao} />}
      {!aguardando && contrato.situacao.tipo !== 'encerrado' && (
        <button className="botao botao-primario botao-largo" onClick={aoInformar}>
          Realizei o pagamento
        </button>
      )}
    </div>
  );
}

// Chave Pix do anfitrião com botão de copiar
function CaixaPix({ anfitriao }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(anfitriao.pix_chave);
    } catch {
      // Celulares antigos: seleciona o texto para copiar manualmente
      const campo = document.createElement('textarea');
      campo.value = anfitriao.pix_chave;
      document.body.appendChild(campo);
      campo.select();
      document.execCommand('copy');
      campo.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }
  return (
    <div className="caixa-pix">
      <div>
        <span className="texto-suave pequeno">Pague com Pix · {anfitriao.pix_tipo || 'Chave'}</span>
        <strong className="pix-chave">{anfitriao.pix_chave}</strong>
        {(anfitriao.pix_favorecido || anfitriao.pix_banco) && (
          <span className="sub">{[anfitriao.pix_favorecido, anfitriao.pix_banco].filter(Boolean).join(' · ')}</span>
        )}
      </div>
      <button type="button" className={`botao botao-pequeno ${copiado ? 'botao-sucesso' : 'botao-secundario'}`} onClick={copiar}>
        {copiado ? '✓ Copiada' : 'Copiar chave'}
      </button>
    </div>
  );
}
