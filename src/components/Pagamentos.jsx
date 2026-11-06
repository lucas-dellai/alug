// Registro de pagamentos (CRUD) e histórico mês a mês de cada contrato.
import { useState } from 'react';
import { api } from '../api';
import { Campo, Etiqueta, Modal, useUI } from './UI';
import {
  FORMAS_PAGAMENTO,
  chaveMes,
  dataBR,
  diasEntre,
  hoje,
  moeda,
  nomeMes,
  paraISO,
  valorSugerido,
} from '../utils';

// Janela para registrar (CREATE) ou corrigir (UPDATE) um pagamento
export function ModalPagamento({ contrato, pagamento, mesInicial, aoFechar, aoSalvar }) {
  const { avisar } = useUI();
  const sugestaoMes =
    mesInicial ||
    (pagamento && String(pagamento.referencia).slice(0, 7)) ||
    (contrato.pagamento.emAberto[0] && chaveMes(contrato.pagamento.emAberto[0])) ||
    (contrato.pagamento.proximo && chaveMes(contrato.pagamento.proximo)) ||
    chaveMes(hoje());

  const [mes, setMes] = useState(sugestaoMes);
  const [valor, setValor] = useState(pagamento?.valor_pago ?? valorSugerido(contrato, sugestaoMes));
  const [valorEditado, setValorEditado] = useState(!!pagamento);
  const [data, setData] = useState(pagamento?.data_pagamento || paraISO(hoje()));
  const [forma, setForma] = useState(pagamento?.forma || 'Pix');
  const [observacoes, setObservacoes] = useState(pagamento?.observacoes || '');
  const [salvando, setSalvando] = useState(false);

  function trocarMes(novo) {
    setMes(novo);
    if (!valorEditado && novo) setValor(valorSugerido(contrato, novo));
  }

  const sugerido = mes ? valorSugerido(contrato, mes) : Number(contrato.valor_aluguel);
  const temEncargos = sugerido > Number(contrato.valor_aluguel);

  async function enviar(e) {
    e.preventDefault();
    if (!mes) return avisar('Escolha o mês de referência.', 'erro');
    if (!(Number(valor) > 0)) return avisar('Informe o valor pago.', 'erro');
    setSalvando(true);
    const dados = {
      contrato_id: contrato.id,
      referencia: `${mes}-01`,
      data_pagamento: data,
      valor_pago: Number(valor),
      forma,
      observacoes,
    };
    try {
      if (pagamento) await api.atualizar('pagamentos', pagamento.id, dados);
      else await api.criar('pagamentos', dados);
      avisar(pagamento ? 'Pagamento corrigido.' : `Pagamento de ${nomeMes(mes).toLowerCase()} registrado.`);
      aoSalvar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      titulo={pagamento ? 'Corrigir pagamento' : 'Registrar pagamento'}
      subtitulo={`${contrato.inquilinos?.nome} · ${contrato.imovel}`}
      aoFechar={aoFechar}
      pequeno
    >
      <form onSubmit={enviar}>
        <Campo rotulo="Mês do aluguel" obrigatorio dica={mes ? nomeMes(mes) : ''}>
          <input type="month" value={mes} onChange={(e) => trocarMes(e.target.value)} required />
        </Campo>
        <Campo rotulo="Data do pagamento" obrigatorio>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        </Campo>
        <Campo
          rotulo="Valor pago (R$)"
          obrigatorio
          dica={
            temEncargos
              ? `Sugestão com multa e juros: ${moeda(sugerido)} (aluguel ${moeda(contrato.valor_aluguel)})`
              : `Aluguel: ${moeda(contrato.valor_aluguel)}`
          }
        >
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={valor}
            onChange={(e) => {
              setValor(e.target.value);
              setValorEditado(true);
            }}
            required
          />
        </Campo>
        <Campo rotulo="Forma de pagamento">
          <select value={forma} onChange={(e) => setForma(e.target.value)}>
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Observações">
          <input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" />
        </Campo>
        <div className="modal-acoes">
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="botao botao-primario" disabled={salvando}>
            {salvando ? 'Salvando…' : pagamento ? 'Salvar correção' : 'Registrar pagamento'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Histórico mês a mês (READ). No portal do inquilino fica só para consulta.
export function HistoricoPagamentos({ contrato, recarregar, somenteLeitura, limite = 12 }) {
  const { avisar, confirmar } = useUI();
  const [modal, setModal] = useState(null); // { pagamento?, mes? }
  const referencia = hoje();
  const { vencidos, proximo, pagos } = contrato.pagamento;

  const linhas = [...(proximo ? [proximo] : []), ...[...vencidos].reverse()].slice(0, limite).map((vencimento) => {
    const chave = chaveMes(vencimento);
    const pago = pagos.get(chave);
    const dias = diasEntre(vencimento, referencia);
    let situacao;
    if (pago) {
      const atrasou = diasEntre(vencimento, lerDataISO(pago.data_pagamento)) > 0;
      situacao = { valor: atrasou ? 'Pendente' : 'Em dia', texto: atrasou ? 'Pago com atraso' : 'Pago' };
    } else if (dias > 0) situacao = { valor: 'Atrasado', texto: `Em aberto há ${dias} dia(s)` };
    else situacao = { valor: 'cinza', texto: dias === 0 ? 'Vence hoje' : `Vence em ${-dias} dia(s)` };
    return { chave, vencimento, pago, situacao };
  });

  // DELETE
  async function excluir(pagamento) {
    const ok = await confirmar(
      'Excluir pagamento?',
      `O pagamento de ${nomeMes(pagamento.referencia).toLowerCase()} será apagado e o mês volta a ficar em aberto.`,
    );
    if (!ok) return;
    try {
      await api.excluir('pagamentos', pagamento.id);
      avisar('Pagamento excluído.');
      recarregar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    }
  }

  if (!linhas.length) return <p className="texto-suave">Ainda não há vencimentos neste contrato.</p>;

  return (
    <>
      <ul className="historico">
        {linhas.map((l) => (
          <li key={l.chave}>
            <div className="historico-mes">
              <strong>{nomeMes(l.vencimento)}</strong>
              <span className="sub">Vencimento {dataBR(l.vencimento)}</span>
            </div>
            <div className="historico-situacao">
              <Etiqueta valor={l.situacao.valor} cor={l.situacao.valor === 'cinza' ? 'cinza' : undefined}>
                {l.situacao.texto}
              </Etiqueta>
              {l.pago && (
                <span className="sub">
                  {moeda(l.pago.valor_pago)} em {dataBR(l.pago.data_pagamento)} · {l.pago.forma}
                </span>
              )}
            </div>
            {!somenteLeitura && (
              <div className="botoes">
                {l.pago ? (
                  <>
                    <button className="botao botao-pequeno botao-secundario" onClick={() => setModal({ pagamento: l.pago })}>
                      Corrigir
                    </button>
                    <button className="botao botao-pequeno botao-perigo-leve" onClick={() => excluir(l.pago)}>
                      Excluir
                    </button>
                  </>
                ) : (
                  <button className="botao botao-pequeno botao-primario" onClick={() => setModal({ mes: l.chave })}>
                    Registrar
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {modal && (
        <ModalPagamento
          contrato={contrato}
          pagamento={modal.pagamento}
          mesInicial={modal.mes}
          aoFechar={() => setModal(null)}
          aoSalvar={() => {
            setModal(null);
            recarregar();
          }}
        />
      )}
    </>
  );
}

function lerDataISO(iso) {
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d);
}
