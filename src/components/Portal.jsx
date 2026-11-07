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
import {
  analisarContratos,
  dataBR,
  especificacoes,
  linkWhatsApp,
  moeda,
  primeiroNome,
  saudacao,
  nomeMes,
} from '../utils';

export default function Portal({ perfil, setPerfil }) {
  const { avisar } = useUI();
  const [contratos, setContratos] = useState([]);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [regras, setRegras] = useState(undefined);
  const [comunicados, setComunicados] = useState([]);
  const [imoveis, setImoveis] = useState([]);
  const [informes, setInformes] = useState([]);
  const [informando, setInformando] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [novaSolicitacao, setNovaSolicitacao] = useState(false);
  const [abertaId, setAbertaId] = useState(null);
  const [editandoPerfil, setEditandoPerfil] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      const [c, s, p, r, com, im, inf] = await Promise.all([
        api.listar('contratos'),
        api.listar('solicitacoes'),
        api.listar('pagamentos'),
        api.listar('configuracoes').catch(() => undefined),
        api.listar('comunicados').catch(() => []),
        api.listar('imoveis').catch(() => []),
        api.listar('informes').catch(() => []),
      ]);
      setInformes(inf);
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
          <MenuUsuario perfil={perfil} rotuloPapel="Inquilino" aoEditarPerfil={() => setEditandoPerfil(true)} />
        </div>
      </header>

      <main className="conteudo">
        {carregando ? (
          <Carregando texto="Buscando seu contrato…" />
        ) : (
          <div className="pagina">
            <div>
              <h1>
                {saudacao()}, {primeiroNome(perfil.nome)}!
              </h1>
            </div>

            <ComunicadosDoPortal comunicados={comunicados} recarregar={recarregar} />

            {!lista.length && (
              <section className="cartao">
                <Vazio titulo="Nenhum contrato encontrado" texto="Fale com o anfitrião se achar que isso é um erro." />
              </section>
            )}

            {lista.map((c) => (
              <div key={c.id} className="portal-grade">
                {/* Pagamento */}
                <section className={`cartao portal-pagamento pagamento-${c.status_pagamento === 'Em dia' ? 'ok' : c.status_pagamento === 'Atrasado' ? 'atrasado' : 'pendente'}`}>
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
                      {c.pagamento.ultimo && (
                        <p className="texto-suave">Último pagamento: {dataBR(c.pagamento.ultimo.data_pagamento)}</p>
                      )}
                      <p className="texto-suave">
                        Próximo vencimento: <strong>{dataBR(c.vencimento.data)}</strong>
                        {c.vencimento.dias === 0 ? ' (hoje)' : ` (em ${c.vencimento.dias} dia(s))`}
                      </p>
                    </>
                  )}
                  <AvisoPagamentoInformado
                    contrato={c}
                    informes={informes.filter((i) => i.contrato_id === c.id)}
                    anfitriao={anfitriao}
                    aoInformar={() => setInformando(c)}
                  />
                </section>

                {/* Contrato e imóvel: tudo o que é importante saber do aluguel */}
                <InfoAluguel contrato={c} imovel={imoveis.find((i) => i.id === c.imovel_id)} regras={c.regras} />

                <section className="cartao portal-largura-total">
                  <h2>Meus pagamentos</h2>
                  <HistoricoPagamentos contrato={c} somenteLeitura limite={6} />
                </section>
              </div>
            ))}

            <div className="portal-grade">
              {/* Solicitações */}
              <section className="cartao">
                <div className="cartao-topo">
                  <h2>Minhas solicitações</h2>
                  {lista.length > 0 && (
                    <button className="botao botao-primario botao-pequeno" onClick={() => setNovaSolicitacao(true)}>
                      + Nova solicitação
                    </button>
                  )}
                </div>
                {!solicitacoes.length ? (
                  <p className="texto-suave">
                    Precisa de um conserto ou quer pedir algo? Abra uma solicitação e acompanhe por aqui.
                  </p>
                ) : (
                  <ul className="lista-simples lista-clicavel">
                    {solicitacoes.map((s) => (
                      <li key={s.id} onClick={() => setAbertaId(s.id)} role="button" tabIndex={0} title="Abrir solicitação">
                        <div>
                          <strong>{s.titulo}</strong>
                          <span className="sub">
                            {s.tipo} · aberta em {dataBR(s.data_abertura)}
                            {s.prazo && !['Concluída', 'Recusada'].includes(s.status) ? ` · previsão ${dataBR(s.prazo)}` : ''}
                          </span>
                        </div>
                        <div className="etiquetas">
                          <Etiqueta valor={s.status} />
                          <span className="seta-direita">›</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="ficha-coluna">
                {/* Contato do anfitrião */}
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

                <Documentos somenteLeitura />
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="rodape">{APP.nome} · Portal do Inquilino</footer>

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

// Informações do aluguel para o inquilino: imóvel, o que está incluso, datas e regras de cobrança
function InfoAluguel({ contrato: c, imovel, regras }) {
  const specs = especificacoes(imovel);
  const tolerancia = Number(regras?.dias_tolerancia || 0);
  return (
    <section className="cartao info-aluguel">
      {imovel?.foto_url && <img className="info-aluguel-foto" src={imovel.foto_url} alt={`Foto de ${imovel.nome}`} />}
      <h2>Meu aluguel</h2>
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
