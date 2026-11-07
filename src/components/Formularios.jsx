// Formulários de cadastro e edição (CREATE e UPDATE) e o cálculo de reajuste.
import { useState } from 'react';
import { api } from '../api';
import { Campo, Modal, useUI } from './UI';
import {
  GARANTIAS,
  REGRAS_PADRAO,
  INDICES,
  PRIORIDADES,
  STATUS_SOLICITACAO,
  TIPOS_SOLICITACAO,
  calcularReajuste,
  dataBR,
  hoje,
  infoReajuste,
  mascaraCPF,
  mascaraTelefone,
  moeda,
  paraISO,
} from '../utils';

// Hook simples para controlar os campos do formulário
function useFormulario(inicial) {
  const [valores, setValores] = useState(inicial);
  const alterar = (campo, transformar) => (e) => {
    const valor = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setValores((v) => ({ ...v, [campo]: transformar ? transformar(valor) : valor }));
  };
  return [valores, alterar, setValores];
}

function Rodape({ salvando, aoCancelar, editando }) {
  return (
    <div className="modal-acoes">
      <button type="button" className="botao botao-secundario" onClick={aoCancelar}>
        Cancelar
      </button>
      <button className="botao botao-primario" disabled={salvando}>
        {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar'}
      </button>
    </div>
  );
}

// Envia para a API: cria (POST) se não tiver id, atualiza (PUT) se tiver
async function salvarRegistro({ recurso, id, dados, avisar, aoSalvar, setSalvando, mensagens }) {
  setSalvando(true);
  try {
    const registro = id ? await api.atualizar(recurso, id, dados) : await api.criar(recurso, dados);
    avisar(id ? mensagens.editado : mensagens.criado);
    aoSalvar(registro);
  } catch (erro) {
    avisar(erro.message, 'erro');
  } finally {
    setSalvando(false);
  }
}

// ---------------- INQUILINO ----------------

export function FormInquilino({ inquilino, aoFechar, aoSalvar }) {
  const { avisar } = useUI();
  const [salvando, setSalvando] = useState(false);
  const [v, alterar] = useFormulario({
    nome: inquilino?.nome || '',
    cpf: inquilino?.cpf || '',
    rg: inquilino?.rg || '',
    data_nascimento: inquilino?.data_nascimento || '',
    telefone: inquilino?.telefone || '',
    email: inquilino?.email || '',
    profissao: inquilino?.profissao || '',
    renda_mensal: inquilino?.renda_mensal ?? '',
    contato_emergencia: inquilino?.contato_emergencia || '',
    observacoes: inquilino?.observacoes || '',
  });

  function enviar(e) {
    e.preventDefault();
    if (!v.nome.trim()) return avisar('Informe o nome do inquilino.', 'erro');
    salvarRegistro({
      recurso: 'inquilinos',
      id: inquilino?.id,
      dados: v,
      avisar,
      aoSalvar,
      setSalvando,
      mensagens: { criado: 'Inquilino cadastrado com sucesso.', editado: 'Dados do inquilino atualizados.' },
    });
  }

  return (
    <Modal titulo={inquilino ? 'Editar inquilino' : 'Novo inquilino'} aoFechar={aoFechar}>
      <form onSubmit={enviar}>
        <div className="grade-formulario">
          <Campo rotulo="Nome completo" obrigatorio largo>
            <input value={v.nome} onChange={alterar('nome')} required autoFocus />
          </Campo>
          <Campo rotulo="CPF">
            <input value={v.cpf} onChange={alterar('cpf', mascaraCPF)} placeholder="000.000.000-00" inputMode="numeric" />
          </Campo>
          <Campo rotulo="RG">
            <input value={v.rg} onChange={alterar('rg')} />
          </Campo>
          <Campo rotulo="Data de nascimento">
            <input type="date" value={v.data_nascimento} onChange={alterar('data_nascimento')} />
          </Campo>
          <Campo rotulo="Telefone">
            <input value={v.telefone} onChange={alterar('telefone', mascaraTelefone)} placeholder="(00) 00000-0000" inputMode="tel" />
          </Campo>
          <Campo rotulo="E-mail">
            <input type="email" value={v.email} onChange={alterar('email')} />
          </Campo>
          <Campo rotulo="Profissão">
            <input value={v.profissao} onChange={alterar('profissao')} />
          </Campo>
          <Campo rotulo="Renda mensal (R$)">
            <input type="number" min="0" step="0.01" value={v.renda_mensal} onChange={alterar('renda_mensal')} />
          </Campo>
          <Campo rotulo="Contato de emergência" dica="Nome e telefone">
            <input value={v.contato_emergencia} onChange={alterar('contato_emergencia')} />
          </Campo>
          <Campo rotulo="Observações" largo>
            <textarea rows="3" value={v.observacoes} onChange={alterar('observacoes')} />
          </Campo>
        </div>
        <Rodape salvando={salvando} aoCancelar={aoFechar} editando={!!inquilino} />
      </form>
    </Modal>
  );
}

// ---------------- CONTRATO ----------------

export function FormContrato({ contrato, inquilinos, inquilinoFixo, imoveis = [], imovelFixo, regras = REGRAS_PADRAO, aoFechar, aoSalvar }) {
  const { avisar } = useUI();
  const [salvando, setSalvando] = useState(false);
  const [v, alterar, setV] = useFormulario({
    inquilino_id: contrato?.inquilino_id ?? inquilinoFixo ?? '',
    imovel_id: contrato?.imovel_id ?? imovelFixo?.id ?? '',
    imovel: contrato?.imovel || imovelFixo?.endereco || '',
    valor_aluguel: contrato?.valor_aluguel ?? imovelFixo?.valor_sugerido ?? '',
    dia_vencimento: contrato?.dia_vencimento ?? (regras?.dia_vencimento_padrao ?? 10),
    data_inicio: contrato?.data_inicio || '',
    data_fim: contrato?.data_fim || '',
    tipo_garantia: contrato?.tipo_garantia || 'Nenhuma',
    indice_reajuste: contrato?.indice_reajuste || regras?.indice_padrao || 'IGP-M',
    // Contrato novo já vem com os percentuais das regras de cobrança
    multa_atraso: contrato?.multa_atraso ?? (regras?.multa_padrao ?? 2),
    juros_mes: contrato?.juros_mes ?? (regras?.juros_padrao ?? 1),
    observacoes: contrato?.observacoes || '',
  });

  function enviar(e) {
    e.preventDefault();
    if (!v.inquilino_id) return avisar('Escolha o inquilino.', 'erro');
    if (!(Number(v.valor_aluguel) > 0)) return avisar('O valor do aluguel precisa ser maior que zero.', 'erro');
    if (v.data_fim <= v.data_inicio) return avisar('O fim do contrato precisa ser depois do início.', 'erro');
    salvarRegistro({
      recurso: 'contratos',
      id: contrato?.id,
      dados: (({ fimAutomatico, ...resto }) => ({
        ...resto,
        inquilino_id: Number(resto.inquilino_id),
        imovel_id: resto.imovel_id ? Number(resto.imovel_id) : null,
        dia_vencimento: Number(resto.dia_vencimento),
      }))(v),
      avisar,
      aoSalvar,
      setSalvando,
      mensagens: { criado: 'Contrato cadastrado com sucesso.', editado: 'Contrato atualizado.' },
    });
  }

  return (
    <Modal titulo={contrato ? 'Editar contrato' : 'Novo contrato'} aoFechar={aoFechar} largo>
      <form onSubmit={enviar}>
        <h3 className="secao-formulario">Imóvel e inquilino</h3>
        <div className="grade-formulario">
          <Campo rotulo="Inquilino" obrigatorio>
            <select value={v.inquilino_id} onChange={alterar('inquilino_id')} required disabled={!!inquilinoFixo}>
              <option value="">Selecione…</option>
              {inquilinos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome}
                </option>
              ))}
            </select>
          </Campo>
          {imoveis.length > 0 && (
            <Campo rotulo="Imóvel cadastrado" dica="Escolha para preencher o endereço e o valor sugerido">
              <select
                value={v.imovel_id}
                disabled={!!imovelFixo}
                onChange={(e) => {
                  const escolhido = imoveis.find((i) => String(i.id) === e.target.value);
                  setV((atual) => ({
                    ...atual,
                    imovel_id: e.target.value,
                    imovel: escolhido ? escolhido.endereco : atual.imovel,
                    valor_aluguel: atual.valor_aluguel || escolhido?.valor_sugerido || '',
                  }));
                }}
              >
                <option value="">Não vincular</option>
                {imoveis.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          <Campo rotulo="Endereço do imóvel" obrigatorio>
            <input value={v.imovel} onChange={alterar('imovel')} placeholder="Rua, número, bairro" required />
          </Campo>
          <Campo rotulo="Tipo de garantia">
            <select value={v.tipo_garantia} onChange={alterar('tipo_garantia')}>
              {GARANTIAS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </Campo>
        </div>

        <h3 className="secao-formulario">Valores e datas</h3>
        <div className="grade-formulario">
          <Campo rotulo="Valor do aluguel (R$)" obrigatorio>
            <input type="number" min="0.01" step="0.01" value={v.valor_aluguel} onChange={alterar('valor_aluguel')} required />
          </Campo>
          <Campo rotulo="Dia de vencimento" obrigatorio>
            <input type="number" min="1" max="31" value={v.dia_vencimento} onChange={alterar('dia_vencimento')} required />
          </Campo>
          <Campo rotulo="Início do contrato" obrigatorio>
            <input
              type="date"
              value={v.data_inicio}
              onChange={(e) => {
                const inicio = e.target.value;
                // Contrato novo: o fim já é preenchido com a duração padrão das configurações
                setV((atual) => {
                  const novo = { ...atual, data_inicio: inicio };
                  if (!contrato && inicio && (!atual.data_fim || atual.fimAutomatico)) {
                    const [a, m, d] = inicio.split('-').map(Number);
                    novo.data_fim = paraISO(new Date(a, m - 1 + Number(regras?.duracao_meses ?? 12), d));
                    novo.fimAutomatico = true;
                  }
                  return novo;
                });
              }}
              required
            />
          </Campo>
          <Campo rotulo="Fim do contrato" obrigatorio>
            <input
              type="date"
              value={v.data_fim}
              onChange={(e) => setV((atual) => ({ ...atual, data_fim: e.target.value, fimAutomatico: false }))}
              min={v.data_inicio || undefined}
              required
            />
          </Campo>
          <Campo rotulo="Índice de reajuste">
            <select value={v.indice_reajuste} onChange={alterar('indice_reajuste')}>
              {INDICES.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Multa por atraso (%)" dica="Cobrada uma vez">
            <input type="number" min="0" step="0.01" value={v.multa_atraso} onChange={alterar('multa_atraso')} />
          </Campo>
          <Campo rotulo="Juros ao mês (%)" dica="Proporcional aos dias">
            <input type="number" min="0" step="0.01" value={v.juros_mes} onChange={alterar('juros_mes')} />
          </Campo>
          <Campo rotulo="Observações" largo>
            <textarea rows="2" value={v.observacoes} onChange={alterar('observacoes')} />
          </Campo>
        </div>
        <Rodape salvando={salvando} aoCancelar={aoFechar} editando={!!contrato} />
      </form>
    </Modal>
  );
}

// ---------------- SOLICITAÇÃO ----------------

// modoInquilino: versão simplificada usada no Portal do Inquilino
export function FormSolicitacao({ solicitacao, contratos, aoFechar, aoSalvar, modoInquilino }) {
  const { avisar } = useUI();
  const [salvando, setSalvando] = useState(false);
  const [v, alterar] = useFormulario({
    contrato_id: solicitacao?.contrato_id ?? (contratos.length === 1 ? contratos[0].id : ''),
    prazo: solicitacao?.prazo || '',
    titulo: solicitacao?.titulo || '',
    descricao: solicitacao?.descricao || '',
    tipo: solicitacao?.tipo || 'Manutenção',
    prioridade: solicitacao?.prioridade || 'Média',
    status: solicitacao?.status || 'Aberta',
    data_abertura: solicitacao?.data_abertura || paraISO(hoje()),
  });

  function enviar(e) {
    e.preventDefault();
    if (!v.contrato_id) return avisar('Escolha o contrato.', 'erro');
    const dados = modoInquilino
      ? { contrato_id: Number(v.contrato_id), titulo: v.titulo, descricao: v.descricao, tipo: v.tipo, prioridade: v.prioridade }
      : { ...v, contrato_id: Number(v.contrato_id) };
    salvarRegistro({
      recurso: 'solicitacoes',
      id: solicitacao?.id,
      dados,
      avisar,
      aoSalvar,
      setSalvando,
      mensagens: {
        criado: modoInquilino ? 'Solicitação enviada ao anfitrião.' : 'Solicitação registrada.',
        editado: 'Solicitação atualizada.',
      },
    });
  }

  return (
    <Modal titulo={solicitacao ? 'Editar solicitação' : 'Nova solicitação'} aoFechar={aoFechar}>
      <form onSubmit={enviar}>
        <div className="grade-formulario">
          {(!modoInquilino || contratos.length > 1) && (
            <Campo rotulo={modoInquilino ? 'Imóvel' : 'Contrato (imóvel e inquilino)'} obrigatorio largo>
              <select value={v.contrato_id} onChange={alterar('contrato_id')} required>
                <option value="">Selecione…</option>
                {contratos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.imovel}
                    {modoInquilino ? '' : ` · ${c.inquilinos?.nome}`}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          <Campo rotulo="Título" obrigatorio largo>
            <input value={v.titulo} onChange={alterar('titulo')} placeholder="Ex.: Vazamento no banheiro" required />
          </Campo>
          <Campo rotulo="Descrição" largo>
            <textarea rows="3" value={v.descricao} onChange={alterar('descricao')} />
          </Campo>
          <Campo rotulo="Tipo">
            <select value={v.tipo} onChange={alterar('tipo')}>
              {TIPOS_SOLICITACAO.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo={modoInquilino ? 'Urgência' : 'Prioridade'}>
            <select value={v.prioridade} onChange={alterar('prioridade')}>
              {PRIORIDADES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Campo>
          {!modoInquilino && (
            <>
              <Campo rotulo="Status">
                <select value={v.status} onChange={alterar('status')}>
                  {STATUS_SOLICITACAO.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Data de abertura">
                <input type="date" value={v.data_abertura} onChange={alterar('data_abertura')} />
              </Campo>
              <Campo rotulo="Prazo para resolver" dica="Gera alerta quando estiver perto ou vencido">
                <input type="date" value={v.prazo} onChange={alterar('prazo')} min={v.data_abertura || undefined} />
              </Campo>
            </>
          )}
        </div>
        <Rodape salvando={salvando} aoCancelar={aoFechar} editando={!!solicitacao} />
      </form>
    </Modal>
  );
}

// ---------------- REAJUSTE ----------------

export function ModalReajuste({ contrato, aoFechar, aoSalvar }) {
  const { avisar } = useUI();
  const [indice, setIndice] = useState(contrato.indice_reajuste === 'Livre' ? 'IGP-M' : contrato.indice_reajuste);
  const [percentual, setPercentual] = useState('');
  const [consulta, setConsulta] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const info = infoReajuste(contrato);
  const valorAtual = Number(contrato.valor_aluguel);
  const novoValor = calcularReajuste(valorAtual, percentual);
  const temPercentual = percentual !== '' && !Number.isNaN(Number(percentual));

  async function buscarIndice() {
    setBuscando(true);
    try {
      const resultado = await api.indice(indice);
      setConsulta(resultado);
      setPercentual(String(resultado.acumulado));
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setBuscando(false);
    }
  }

  async function aplicar() {
    setSalvando(true);
    try {
      // UPDATE: grava o novo valor e a data do reajuste
      await api.atualizar('contratos', contrato.id, {
        valor_aluguel: novoValor,
        data_ultimo_reajuste: paraISO(hoje()),
      });
      avisar(`Reajuste aplicado. Novo aluguel: ${moeda(novoValor)}.`);
      aoSalvar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Calcular reajuste" subtitulo={`${contrato.imovel} · ${contrato.inquilinos?.nome}`} aoFechar={aoFechar}>
      <div className="reajuste-info">
        <div>
          <span className="texto-suave">Aluguel atual</span>
          <strong>{moeda(valorAtual)}</strong>
        </div>
        <div>
          <span className="texto-suave">Próximo reajuste</span>
          <strong>{dataBR(info.proximo)}</strong>
        </div>
        <div>
          <span className="texto-suave">Índice do contrato</span>
          <strong>{contrato.indice_reajuste}</strong>
        </div>
      </div>

      <div className="reajuste-busca">
        <Campo rotulo="Buscar índice no Banco Central">
          <div className="linha-campo">
            <select value={indice} onChange={(e) => setIndice(e.target.value)}>
              <option>IGP-M</option>
              <option>IPCA</option>
            </select>
            <button type="button" className="botao botao-secundario" onClick={buscarIndice} disabled={buscando}>
              {buscando ? 'Buscando…' : 'Buscar acumulado 12 meses'}
            </button>
          </div>
        </Campo>
        {consulta && (
          <p className="texto-suave pequeno">
            {consulta.indice} acumulado de {consulta.inicio.slice(3)} a {consulta.fim.slice(3)}:{' '}
            <strong>{consulta.acumulado.toLocaleString('pt-BR')}%</strong>
          </p>
        )}

        <Campo rotulo="Percentual de reajuste (%)" dica="Preenchido pela busca, ou digite o combinado com o inquilino">
          <input
            type="number"
            step="0.01"
            value={percentual}
            onChange={(e) => setPercentual(e.target.value)}
            placeholder="Ex.: 4,50"
          />
        </Campo>
      </div>

      {temPercentual && (
        <div className="reajuste-resultado">
          <span>{moeda(valorAtual)}</span>
          <span className="seta">→</span>
          <strong>{moeda(novoValor)}</strong>
          <span className="texto-suave">({Number(novoValor - valorAtual) >= 0 ? '+' : ''}{moeda(novoValor - valorAtual)} por mês)</span>
        </div>
      )}

      <div className="modal-acoes">
        <button className="botao botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button className="botao botao-primario" onClick={aplicar} disabled={!temPercentual || salvando || novoValor <= 0}>
          {salvando ? 'Aplicando…' : 'Aplicar reajuste'}
        </button>
      </div>
    </Modal>
  );
}

// ---------------- CONFIGURAÇÕES (engrenagem) ----------------

export function ModalRegrasCobranca({ regras, aoFechar, aoSalvar }) {
  const { avisar } = useUI();
  const r = { ...REGRAS_PADRAO, ...(regras || {}) };
  const [v, setV] = useState({
    cobrar_multa: r.cobrar_multa,
    multa_padrao: r.multa_padrao,
    cobrar_juros: r.cobrar_juros,
    juros_padrao: r.juros_padrao,
    dias_tolerancia: r.dias_tolerancia,
    indice_padrao: r.indice_padrao,
    duracao_meses: r.duracao_meses,
    dia_vencimento_padrao: r.dia_vencimento_padrao,
    aviso_vencimento_dias: r.aviso_vencimento_dias,
  });
  const [aplicarTodos, setAplicarTodos] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const muda = (campo) => (e) =>
    setV((atual) => ({ ...atual, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  // Exemplo com um aluguel de R$ 1.000,00 pago 10 dias atrasado
  const diasExemplo = 10;
  const cobra = diasExemplo > Number(v.dias_tolerancia || 0);
  const multaEx = cobra && v.cobrar_multa ? (1000 * Number(v.multa_padrao || 0)) / 100 : 0;
  const jurosEx = cobra && v.cobrar_juros ? 1000 * (Number(v.juros_padrao || 0) / 100) * (diasExemplo / 30) : 0;

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      const resposta = await api.atualizarRegras({ ...v, aplicar_todos: aplicarTodos });
      avisar(
        aplicarTodos
          ? `Configurações salvas. Multa e juros aplicados em ${resposta.contratosAtualizados} contrato(s).`
          : 'Configurações salvas.',
      );
      aoSalvar(resposta);
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Configurações" subtitulo="Cobrança, padrões dos contratos e avisos" aoFechar={aoFechar}>
      <form onSubmit={salvar}>
        <h3 className="secao-formulario">Cobrança de atraso</h3>
        <div className="regra">
          <label className="interruptor">
            <input type="checkbox" checked={v.cobrar_multa} onChange={muda('cobrar_multa')} />
            <span className="interruptor-trilho" aria-hidden="true" />
            <span>
              <strong>Cobrar multa</strong>
              <small>Cobrada uma vez quando o aluguel atrasa.</small>
            </span>
          </label>
          <Campo rotulo="Multa (%)">
            <input type="number" min="0" max="100" step="0.01" value={v.multa_padrao} onChange={muda('multa_padrao')} disabled={!v.cobrar_multa} />
          </Campo>
        </div>

        <div className="regra">
          <label className="interruptor">
            <input type="checkbox" checked={v.cobrar_juros} onChange={muda('cobrar_juros')} />
            <span className="interruptor-trilho" aria-hidden="true" />
            <span>
              <strong>Cobrar juros</strong>
              <small>Por mês, proporcional aos dias de atraso.</small>
            </span>
          </label>
          <Campo rotulo="Juros (% ao mês)">
            <input type="number" min="0" max="100" step="0.01" value={v.juros_padrao} onChange={muda('juros_padrao')} disabled={!v.cobrar_juros} />
          </Campo>
        </div>

        <div className="grade-formulario">
          <Campo rotulo="Dias de tolerância" dica="Sem multa e juros nesses dias após o vencimento.">
            <input type="number" min="0" max="31" step="1" value={v.dias_tolerancia} onChange={muda('dias_tolerancia')} />
          </Campo>
        </div>

        <p className="regra-exemplo">
          <strong>Exemplo:</strong> aluguel de {moeda(1000)} pago {diasExemplo} dias atrasado: multa {moeda(multaEx)} + juros{' '}
          {moeda(jurosEx)} = <strong>{moeda(1000 + multaEx + jurosEx)}</strong>
        </p>

        <label className="caixa-marcar">
          <input type="checkbox" checked={aplicarTodos} onChange={(e) => setAplicarTodos(e.target.checked)} />
          <span>
            Usar essa multa e esses juros também nos <strong>contratos já cadastrados</strong>
            <small>Sem marcar, valem só para os contratos novos.</small>
          </span>
        </label>

        <h3 className="secao-formulario">Padrões para contratos novos</h3>
        <div className="grade-formulario">
          <Campo rotulo="Duração do contrato">
            <select value={v.duracao_meses} onChange={muda('duracao_meses')}>
              {[6, 12, 24, 30, 36].map((m) => (
                <option key={m} value={m}>
                  {m} meses
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Dia de vencimento">
            <input type="number" min="1" max="31" value={v.dia_vencimento_padrao} onChange={muda('dia_vencimento_padrao')} />
          </Campo>
          <Campo rotulo="Índice de reajuste">
            <select value={v.indice_padrao} onChange={muda('indice_padrao')}>
              {INDICES.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </Campo>
        </div>

        <h3 className="secao-formulario">Avisos</h3>
        <div className="grade-formulario">
          <Campo rotulo="Avisar contrato vencendo com" dica="Dias de antecedência para o alerta aparecer no Início.">
            <select value={v.aviso_vencimento_dias} onChange={muda('aviso_vencimento_dias')}>
              {[15, 30, 45, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {d} dias
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <div className="modal-acoes">
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="botao botao-primario" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
