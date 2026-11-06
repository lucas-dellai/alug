// Inquilinos: lista, ficha completa e documentos anexados.
import { useMemo, useState } from 'react';
import { api } from '../api';
import { Etiqueta, Vazio, useUI } from './UI';
import { FormContrato, FormInquilino } from './Formularios';
import Documentos from './Documentos';
import AcessoPortal from './AcessoPortal';
import DetalheSolicitacao from './DetalheSolicitacao';
import { analisarContratos, dataBR, moeda, semAcento } from '../utils';
import { HistoricoPagamentos, ModalPagamento } from './Pagamentos';

export default function Inquilinos({ inquilinos, contratos: contratosBrutos, solicitacoes, pagamentos, recarregar, abertoId, abrir }) {
  // Contratos com o status de pagamento calculado pelos pagamentos registrados
  const contratos = useMemo(() => analisarContratos(contratosBrutos, pagamentos), [contratosBrutos, pagamentos]);
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

function FichaInquilino({ inquilino, inquilinos, contratos, solicitacoes, recarregar, voltar }) {
  const { avisar, confirmar } = useUI();
  const [editando, setEditando] = useState(false);
  const [novoContrato, setNovoContrato] = useState(false);
  const [pagando, setPagando] = useState(null);
  const [abertaId, setAbertaId] = useState(null);

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
            <p className="texto-suave">Cadastrado em {dataBR(inquilino.criado_em)}</p>
          </div>
        </div>
        <div className="botoes">
          <button className="botao botao-secundario" onClick={() => setEditando(true)}>
            Editar dados
          </button>
          <button className="botao botao-perigo-leve" onClick={excluir}>
            Excluir
          </button>
        </div>
      </div>

      <div className="ficha-grade">
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

        <div className="ficha-coluna">
          <Documentos inquilinoId={inquilino.id} />
          <AcessoPortal inquilino={inquilino} />
        </div>
      </div>

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
