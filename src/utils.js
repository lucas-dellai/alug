// Listas de opções e funções de cálculo usadas no app.

export const STATUS_PAGAMENTO = ['Em dia', 'Pendente', 'Atrasado'];
export const GARANTIAS = ['Nenhuma', 'Fiador', 'Caução', 'Seguro-fiança'];
export const INDICES = ['IGP-M', 'IPCA', 'Livre'];
export const TIPOS_SOLICITACAO = ['Manutenção', 'Reclamação', 'Pedido', 'Outro'];
export const PRIORIDADES = ['Baixa', 'Média', 'Alta'];
export const STATUS_SOLICITACAO = ['Aberta', 'Em análise', 'Em andamento', 'Concluída'];
export const TIPOS_DOCUMENTO = [
  'RG',
  'CNH',
  'Comprovante de renda',
  'Comprovante de residência',
  'Contrato assinado',
  'Outro',
];

// ---------- Formatação ----------

const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const moeda = (valor) => formatoMoeda.format(Number(valor) || 0);

export const porcentagem = (valor) =>
  `${Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

// Converte "2026-11-06" em data local (sem erro de fuso horário)
export function lerData(iso) {
  if (!iso) return null;
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

export function dataBR(valor) {
  if (!valor) return '-';
  const data = valor instanceof Date ? valor : lerData(valor);
  return data.toLocaleDateString('pt-BR');
}

export function hoje() {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
}

export function paraISO(data) {
  const dois = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`;
}

export const diasEntre = (inicio, fim) => Math.round((fim - inicio) / 86400000);

export const arredondar = (valor) => Math.round(valor * 100) / 100;

export function mascaraCPF(valor) {
  return String(valor || '')
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function mascaraTelefone(valor) {
  const numeros = String(valor || '').replace(/\D/g, '').slice(0, 11);
  if (numeros.length <= 10) {
    return numeros.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return numeros.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

export function semAcento(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// ---------- Regras de negócio ----------

// Situação do contrato pela data de término
export function situacaoContrato(contrato, referencia = hoje()) {
  const dias = diasEntre(referencia, lerData(contrato.data_fim));
  if (dias < 0) return { tipo: 'encerrado', texto: 'Contrato vencido', dias };
  if (dias <= 30) {
    return { tipo: 'vencendo', texto: dias === 0 ? 'Vence hoje' : `Vence em ${dias} dia${dias > 1 ? 's' : ''}`, dias };
  }
  return { tipo: 'ativo', texto: 'Ativo', dias };
}

function vencimentoNoMes(ano, mes, dia) {
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  return new Date(ano, mes, Math.min(dia, ultimoDia));
}

// Próximo reajuste: 1 ano depois do último reajuste (ou do início do contrato)
export function infoReajuste(contrato, referencia = hoje()) {
  const base = lerData(contrato.data_ultimo_reajuste || contrato.data_inicio);
  const proximo = new Date(base.getFullYear() + 1, base.getMonth(), base.getDate());
  const dias = diasEntre(referencia, proximo);
  return { proximo, dias, disponivel: dias <= 30 };
}

export const calcularReajuste = (valor, percentual) =>
  arredondar(Number(valor) * (1 + Number(percentual || 0) / 100));

// Próximo dia de pagamento a partir de hoje
export function proximoVencimento(contrato, referencia = hoje()) {
  let data = vencimentoNoMes(referencia.getFullYear(), referencia.getMonth(), contrato.dia_vencimento);
  if (data < referencia) data = vencimentoNoMes(referencia.getFullYear(), referencia.getMonth() + 1, contrato.dia_vencimento);
  return { data, dias: diasEntre(referencia, data) };
}

// ---------- Pagamentos ----------

export const FORMAS_PAGAMENTO = ['Pix', 'Transferência', 'Boleto', 'Dinheiro', 'Outro'];

// "2026-11" identifica o mês de referência de um aluguel
export const chaveMes = (data) => `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;

export function nomeMes(chaveOuData) {
  const data = chaveOuData instanceof Date ? chaveOuData : lerData(`${String(chaveOuData).slice(0, 7)}-01`);
  const texto = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Multa + juros de UM mês em atraso
function encargos(contrato, vencimento, referencia) {
  const dias = Math.max(0, diasEntre(vencimento, referencia));
  const valor = Number(contrato.valor_aluguel);
  const multa = dias > 0 ? arredondar((valor * Number(contrato.multa_atraso || 0)) / 100) : 0;
  const juros = arredondar(valor * (Number(contrato.juros_mes || 0) / 100) * (dias / 30));
  return { dias, valor, multa, juros, total: arredondar(valor + multa + juros) };
}

// Valor sugerido ao registrar o pagamento de um mês (com multa e juros se estiver atrasado)
export function valorSugerido(contrato, chave, referencia = hoje()) {
  const [ano, mes] = chave.split('-').map(Number);
  const vencimento = vencimentoNoMes(ano, mes - 1, contrato.dia_vencimento);
  return encargos(contrato, vencimento, referencia).total;
}

// Descobre sozinho a situação do pagamento a partir dos pagamentos registrados:
//   Em dia   -> todos os meses vencidos foram pagos
//   Pendente -> vence hoje ou nos próximos 5 dias e ainda não foi pago
//   Atrasado -> algum mês já venceu e não foi pago
export function analisarPagamentos(contrato, pagamentos, referencia = hoje()) {
  const pagos = new Map(
    pagamentos.filter((p) => p.contrato_id === contrato.id).map((p) => [String(p.referencia).slice(0, 7), p]),
  );
  const inicio = lerData(contrato.data_inicio);
  const fim = lerData(contrato.data_fim);
  const dia = contrato.dia_vencimento;

  // Primeiro vencimento depois do início do contrato
  let vencimento = vencimentoNoMes(inicio.getFullYear(), inicio.getMonth(), dia);
  if (vencimento < inicio) vencimento = vencimentoNoMes(inicio.getFullYear(), inicio.getMonth() + 1, dia);

  // Todos os vencimentos que já chegaram
  const vencidos = [];
  while (vencimento <= referencia && vencimento <= fim && vencidos.length < 120) {
    vencidos.push(vencimento);
    vencimento = vencimentoNoMes(vencimento.getFullYear(), vencimento.getMonth() + 1, dia);
  }
  const proximo = vencimento <= fim ? vencimento : null;

  const emAberto = vencidos.filter((v) => !pagos.has(chaveMes(v)) && diasEntre(v, referencia) > 0);
  const venceHoje = vencidos.find((v) => diasEntre(v, referencia) === 0 && !pagos.has(chaveMes(v)));
  const proximoEmBreve =
    proximo && !pagos.has(chaveMes(proximo)) && diasEntre(referencia, proximo) <= 5 ? proximo : null;

  let atraso = null;
  if (emAberto.length) {
    const meses = emAberto.map((v) => ({ chave: chaveMes(v), vencimento: v, ...encargos(contrato, v, referencia) }));
    const soma = (campo) => arredondar(meses.reduce((s, m) => s + m[campo], 0));
    atraso = {
      meses,
      quantidade: meses.length,
      vencimento: emAberto[0],
      dias: meses[0].dias,
      valor: soma('valor'),
      multa: soma('multa'),
      juros: soma('juros'),
      total: soma('total'),
    };
  }

  const status = atraso ? 'Atrasado' : venceHoje || proximoEmBreve ? 'Pendente' : 'Em dia';
  const ultimo = [...pagos.values()].sort((a, b) => (a.data_pagamento < b.data_pagamento ? 1 : -1))[0] || null;

  return { status, atraso, vencidos, proximo, pagos, emAberto, ultimo };
}

// Calcula situação, pagamento e reajuste de cada contrato de uma vez.
// Os campos "status_pagamento" e "atraso" passam a ser calculados pelos pagamentos registrados.
export function analisarContratos(contratos, pagamentos = [], referencia = hoje()) {
  return contratos.map((c) => {
    const reajuste = infoReajuste(c, referencia);
    // Só vale reajustar se o contrato ainda estiver valendo na data do reajuste
    reajuste.disponivel = reajuste.disponivel && reajuste.proximo < lerData(c.data_fim);
    const pagamento = analisarPagamentos(c, pagamentos, referencia);
    return {
      ...c,
      situacao: situacaoContrato(c, referencia),
      status_pagamento: pagamento.status,
      atraso: pagamento.atraso,
      pagamento,
      reajuste,
      vencimento: proximoVencimento(c, referencia),
    };
  });
}

// Quantos dias cada status pode ficar parado antes de virar alerta
export const LIMITE_SEM_EVOLUCAO = { Aberta: 3, 'Em análise': 7, 'Em andamento': 14 };

// Pontos de atenção de uma solicitação: prazo e tempo parada
export function analisarSolicitacao(s, referencia = hoje()) {
  const resultado = { alertas: [], diasParada: 0, prazoDias: null };
  if (s.status === 'Concluída') return resultado;

  const desde = lerData(s.atualizado_em || s.data_abertura);
  resultado.diasParada = desde ? Math.max(0, diasEntre(desde, referencia)) : 0;
  if (resultado.diasParada > LIMITE_SEM_EVOLUCAO[s.status]) {
    resultado.alertas.push({ tipo: 'parada', texto: `Sem evolução há ${resultado.diasParada} dias` });
  }

  if (s.prazo) {
    const dias = diasEntre(referencia, lerData(s.prazo));
    resultado.prazoDias = dias;
    if (dias < 0) resultado.alertas.push({ tipo: 'vencido', texto: `Prazo vencido há ${-dias} dia(s)` });
    else if (dias <= 3) resultado.alertas.push({ tipo: 'prazo', texto: dias === 0 ? 'Prazo vence hoje' : `Prazo em ${dias} dia(s)` });
  }

  if (s.prioridade === 'Alta' && s.status === 'Aberta') {
    resultado.alertas.push({ tipo: 'alta', texto: 'Prioridade alta aguardando análise' });
  }
  return resultado;
}

export function saudacao(data = new Date()) {
  const hora = data.getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function primeiroNome(nome) {
  return String(nome || '').trim().split(' ')[0] || '';
}

export function iniciais(nome) {
  return String(nome || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export function linkWhatsApp(telefone) {
  const numeros = String(telefone || '').replace(/\D/g, '');
  if (numeros.length < 10) return null;
  return `https://wa.me/55${numeros}`;
}

// "sexta-feira, 6 de novembro" -> "Sexta-feira, 6 de novembro"
export function dataPorExtenso(data = new Date()) {
  const texto = data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
