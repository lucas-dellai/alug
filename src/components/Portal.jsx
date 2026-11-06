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
import { HistoricoPagamentos } from './Pagamentos';
import { analisarContratos, dataBR, linkWhatsApp, moeda, primeiroNome, saudacao, dataPorExtenso } from '../utils';

export default function Portal({ perfil, setPerfil }) {
  const { avisar } = useUI();
  const [contratos, setContratos] = useState([]);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [regras, setRegras] = useState(undefined);
  const [carregando, setCarregando] = useState(true);
  const [novaSolicitacao, setNovaSolicitacao] = useState(false);
  const [abertaId, setAbertaId] = useState(null);
  const [editandoPerfil, setEditandoPerfil] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      const [c, s, p, r] = await Promise.all([
        api.listar('contratos'),
        api.listar('solicitacoes'),
        api.listar('pagamentos'),
        api.listar('configuracoes').catch(() => undefined),
      ]);
      setRegras(r);
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
              <p className="texto-suave data-hoje">
                {dataPorExtenso(new Date())}
              </p>
              <h1>
                {saudacao()}, {primeiroNome(perfil.nome)}!
              </h1>
            </div>

            {!lista.length && (
              <section className="cartao">
                <Vazio titulo="Nenhum contrato encontrado" texto="Fale com o anfitrião se achar que isso é um erro." />
              </section>
            )}

            {lista.map((c) => (
              <div key={c.id} className="portal-grade">
                {/* Pagamento */}
                <section className={`cartao portal-pagamento pagamento-${c.status_pagamento === 'Em dia' ? 'ok' : c.status_pagamento === 'Atrasado' ? 'atrasado' : 'pendente'}`}>
                  <span className="texto-suave">Seu aluguel</span>
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
                </section>

                {/* Contrato */}
                <section className="cartao">
                  <h2>Meu contrato</h2>
                  <dl className="dados">
                    <div>
                      <dt>Imóvel</dt>
                      <dd>{c.imovel}</dd>
                    </div>
                    <div>
                      <dt>Vencimento</dt>
                      <dd>Todo dia {c.dia_vencimento}</dd>
                    </div>
                    <div>
                      <dt>Período</dt>
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
                      <dt>Garantia</dt>
                      <dd>{c.tipo_garantia}</dd>
                    </div>
                    <div>
                      <dt>Próximo reajuste</dt>
                      <dd>
                        {dataBR(c.reajuste.proximo)} ({c.indice_reajuste}){c.reajuste.dias < 0 ? ' · a combinar' : ''}
                      </dd>
                    </div>
                  </dl>
                </section>

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
