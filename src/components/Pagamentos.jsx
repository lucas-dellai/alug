// Registro de pagamentos (CRUD) e histórico mês a mês de cada contrato.
import { useState } from 'react';
import { api } from '../api';
import { supabase } from '../supabaseClient';
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
  semAcento,
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

// ================= "Realizei o pagamento" =================
const TIPOS_COMPROVANTE = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

// Abre um comprovante guardado no Storage (link temporário de 2 minutos)
export function BotaoVerComprovante({ caminho, nome, bucket = 'comprovantes', rotulo = '📎 Ver comprovante' }) {
  const { avisar } = useUI();
  async function abrir() {
    const janela = window.open('', '_blank');
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(caminho, 120);
    if (error || !data?.signedUrl) {
      janela?.close();
      return avisar('Não foi possível abrir o comprovante.', 'erro');
    }
    if (janela) janela.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  }
  return (
    <button type="button" className="botao botao-pequeno botao-secundario" onClick={abrir} title={nome}>
      {rotulo}
    </button>
  );
}

// Inquilino: informa que pagou e anexa o print do Pix / TED
export function ModalInformarPagamento({ contrato, aoFechar, aoSalvar }) {
  const { avisar } = useUI();
  // Meses que podem ser informados: os em aberto e o próximo vencimento
  const meses = [
    ...new Set([...contrato.pagamento.emAberto.map((d) => chaveMes(d)), contrato.pagamento.proximo && chaveMes(contrato.pagamento.proximo)]),
  ].filter(Boolean);
  const [mes, setMes] = useState(meses[0] || chaveMes(hoje()));
  const [valor, setValor] = useState(valorSugerido(contrato, meses[0] || chaveMes(hoje())));
  const [data, setData] = useState(paraISO(hoje()));
  const [forma, setForma] = useState('Pix');
  const [arquivo, setArquivo] = useState(null);
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  function trocarMes(novo) {
    setMes(novo);
    setValor(valorSugerido(contrato, novo));
  }

  function escolherArquivo(e) {
    const escolhido = e.target.files?.[0];
    e.target.value = '';
    if (!escolhido) return;
    if (!TIPOS_COMPROVANTE.includes(escolhido.type)) return avisar('Envie um print (JPG, PNG) ou PDF.', 'erro');
    if (escolhido.size > 5 * 1024 * 1024) return avisar('O arquivo passa de 5 MB.', 'erro');
    setArquivo(escolhido);
  }

  async function enviar(e) {
    e.preventDefault();
    if (!(Number(valor) > 0)) return avisar('Informe o valor pago.', 'erro');
    if (!arquivo) return avisar('Anexe o comprovante (print do Pix, TED ou boleto).', 'erro');
    setSalvando(true);
    let caminho = null;
    try {
      const nomeSeguro = semAcento(arquivo.name).replace(/[^a-z0-9._-]/g, '_');
      caminho = `${contrato.id}/${Date.now()}-${nomeSeguro}`;
      const { error } = await supabase.storage.from('comprovantes').upload(caminho, arquivo, { contentType: arquivo.type });
      if (error) throw new Error('Não foi possível enviar o comprovante. Tente de novo.');
      await api.criar('informes', {
        contrato_id: contrato.id,
        referencia: `${mes}-01`,
        data_pagamento: data,
        valor: Number(valor),
        forma,
        comprovante_nome: arquivo.name,
        comprovante_caminho: caminho,
        observacao,
      });
      avisar('Pagamento informado! O anfitrião vai conferir o comprovante.');
      aoSalvar();
    } catch (erro) {
      if (caminho) await supabase.storage.from('comprovantes').remove([caminho]);
      avisar(erro.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  const sugerido = valorSugerido(contrato, mes);

  return (
    <Modal titulo="Realizei o pagamento" subtitulo="Anexe o comprovante para o anfitrião conferir" aoFechar={aoFechar} pequeno>
      <form onSubmit={enviar}>
        <Campo rotulo="Mês do aluguel" obrigatorio>
          <select value={mes} onChange={(e) => trocarMes(e.target.value)}>
            {meses.map((m) => (
              <option key={m} value={m}>
                {nomeMes(m)}
                {contrato.pagamento.emAberto.some((d) => chaveMes(d) === m) ? ' (em aberto)' : ''}
              </option>
            ))}
          </select>
        </Campo>
        <div className="grade-formulario">
          <Campo
            rotulo="Valor pago (R$)"
            obrigatorio
            dica={sugerido > Number(contrato.valor_aluguel) ? `Com multa e juros: ${moeda(sugerido)}` : `Aluguel: ${moeda(sugerido)}`}
          >
            <input type="number" min="0.01" step="0.01" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} required />
          </Campo>
          <Campo rotulo="Data do pagamento" obrigatorio>
            <input type="date" value={data} max={paraISO(hoje())} onChange={(e) => setData(e.target.value)} required />
          </Campo>
        </div>
        <Campo rotulo="Forma de pagamento">
          <select value={forma} onChange={(e) => setForma(e.target.value)}>
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </Campo>
        <div className="campo">
          <span className="campo-rotulo">
            Comprovante <span className="obrigatorio">*</span>
          </span>
          <label className={`arquivo-comprovante ${arquivo ? 'com-arquivo' : ''}`}>
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={escolherArquivo} />
            <span className="arquivo-icone">{arquivo ? '✓' : '📎'}</span>
            <span>
              <strong>{arquivo ? arquivo.name : 'Anexar print do Pix, TED ou boleto'}</strong>
              <small>{arquivo ? 'Toque para trocar' : 'Foto ou PDF de até 5 MB'}</small>
            </span>
          </label>
        </div>
        <Campo rotulo="Observação (opcional)">
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: paguei pela conta da minha esposa" />
        </Campo>
        <div className="modal-acoes">
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="botao botao-primario" disabled={salvando}>
            {salvando ? 'Enviando…' : 'Enviar comprovante'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Anfitrião: confere o comprovante e confirma (registra o pagamento) ou recusa
export function ModalConferirPagamento({ informe, aoFechar, aoSalvar }) {
  const { avisar } = useUI();
  const [valor, setValor] = useState(informe.valor);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function decidir(acao) {
    if (acao === 'recusar' && !motivo.trim()) return avisar('Escreva o motivo para o inquilino.', 'erro');
    setSalvando(true);
    try {
      await api.atualizar('informes', informe.id, { acao, valor: Number(valor), motivo });
      avisar(acao === 'confirmar' ? 'Pagamento confirmado e registrado.' : 'Pagamento recusado. O inquilino verá o motivo.');
      aoSalvar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      titulo="Conferir pagamento"
      subtitulo={`${informe.contratos?.inquilinos?.nome || 'Inquilino'} · ${informe.contratos?.imovel || ''}`}
      aoFechar={aoFechar}
      pequeno
    >
      <dl className="dados dados-conferir">
        <div>
          <dt>Mês do aluguel</dt>
          <dd>{nomeMes(informe.referencia)}</dd>
        </div>
        <div>
          <dt>Pago em</dt>
          <dd>
            {dataBR(informe.data_pagamento)} · {informe.forma}
          </dd>
        </div>
        <div>
          <dt>Valor informado</dt>
          <dd>
            <strong>{moeda(informe.valor)}</strong>
          </dd>
        </div>
        <div>
          <dt>Informado em</dt>
          <dd>{new Date(informe.criado_em).toLocaleDateString('pt-BR')}</dd>
        </div>
      </dl>
      {informe.observacao && <p className="sub">Observação: “{informe.observacao}”</p>}
      {informe.comprovante_caminho && (
        <p>
          <BotaoVerComprovante caminho={informe.comprovante_caminho} nome={informe.comprovante_nome} rotulo="📎 Abrir comprovante" />
        </p>
      )}

      {!recusando ? (
        <>
          <Campo rotulo="Valor a registrar (R$)" dica="Mude só se o valor do comprovante for diferente">
            <input type="number" min="0.01" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
          </Campo>
          <div className="modal-acoes">
            <button className="botao botao-perigo-leve" onClick={() => setRecusando(true)} disabled={salvando}>
              Recusar
            </button>
            <button className="botao botao-primario" onClick={() => decidir('confirmar')} disabled={salvando}>
              {salvando ? 'Salvando…' : '✓ Confirmar pagamento'}
            </button>
          </div>
        </>
      ) : (
        <>
          <Campo rotulo="Motivo da recusa" obrigatorio dica="O inquilino vê essa mensagem no portal">
            <textarea
              rows="3"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: o valor não caiu na conta. Pode conferir?"
              autoFocus
            />
          </Campo>
          <div className="modal-acoes">
            <button className="botao botao-secundario" onClick={() => setRecusando(false)} disabled={salvando}>
              Voltar
            </button>
            <button className="botao botao-perigo" onClick={() => decidir('recusar')} disabled={salvando}>
              Recusar pagamento
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
