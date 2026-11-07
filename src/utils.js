// Listas de opções e funções de cálculo usadas no app.

export const STATUS_PAGAMENTO = ['Em dia', 'Pendente', 'Atrasado'];
export const GARANTIAS = ['Nenhuma', 'Fiador', 'Caução', 'Seguro-fiança'];
export const INDICES = ['IGP-M', 'IPCA', 'Livre'];
export const TIPOS_SOLICITACAO = ['Manutenção', 'Reclamação', 'Pedido', 'Outro'];
export const PRIORIDADES = ['Baixa', 'Média', 'Alta'];
// Etapas do quadro (Kanban). "Recusada" fica junto com as concluídas, na última coluna.
export const STATUS_SOLICITACAO = ['Aberta', 'Em análise', 'Em andamento', 'Concluída'];
export const STATUS_FINAIS = ['Concluída', 'Recusada'];
export const estaEncerrada = (s) => STATUS_FINAIS.includes(s.status);
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
export function situacaoContrato(contrato, referencia = hoje(), diasAviso = 30) {
  const dias = diasEntre(referencia, lerData(contrato.data_fim));
  if (dias < 0) return { tipo: 'encerrado', texto: 'Contrato vencido', dias };
  if (dias <= diasAviso) {
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
// Regras de cobrança padrão (o anfitrião muda na engrenagem da tela de Contratos)
export const REGRAS_PADRAO = {
  cobrar_multa: true,
  multa_padrao: 2,
  cobrar_juros: true,
  juros_padrao: 1,
  dias_tolerancia: 0,
  // Padrões para contratos novos e avisos
  indice_padrao: 'IGP-M',
  duracao_meses: 12,
  dia_vencimento_padrao: 10,
  aviso_vencimento_dias: 30,
};

// Multa + juros de UM mês em atraso, respeitando as regras de cobrança
function encargos(contrato, vencimento, referencia) {
  const regras = contrato.regras || REGRAS_PADRAO;
  const dias = Math.max(0, diasEntre(vencimento, referencia));
  const valor = Number(contrato.valor_aluguel);
  const cobra = dias > Number(regras.dias_tolerancia || 0); // dentro da tolerância não cobra nada
  const multa = cobra && regras.cobrar_multa ? arredondar((valor * Number(contrato.multa_atraso || 0)) / 100) : 0;
  const juros = cobra && regras.cobrar_juros ? arredondar(valor * (Number(contrato.juros_mes || 0) / 100) * (dias / 30)) : 0;
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

  const tolerancia = Number((contrato.regras || REGRAS_PADRAO).dias_tolerancia || 0);
  // Atrasado só depois da tolerância. Dentro dela, o mês fica "Pendente".
  const emAberto = vencidos.filter((v) => !pagos.has(chaveMes(v)) && diasEntre(v, referencia) > tolerancia);
  const venceHoje = vencidos.find(
    (v) => !pagos.has(chaveMes(v)) && diasEntre(v, referencia) >= 0 && diasEntre(v, referencia) <= tolerancia,
  );
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

  // Parcela do contrato a que o status se refere (ex.: 8/12 = oitavo mês de 12)
  const primeiro = vencidos[0] || proximo;
  let ultimoVencimento = vencimentoNoMes(fim.getFullYear(), fim.getMonth(), dia);
  if (ultimoVencimento > fim) ultimoVencimento = vencimentoNoMes(fim.getFullYear(), fim.getMonth() - 1, dia);
  const difMeses = (a, b) => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  let parcela = null;
  const referenteA = (atraso && atraso.vencimento) || venceHoje || proximoEmBreve || vencidos[vencidos.length - 1] || proximo;
  if (primeiro && referenteA) {
    const total = Math.max(1, difMeses(primeiro, ultimoVencimento) + 1);
    const numero = Math.min(total, Math.max(1, difMeses(primeiro, referenteA) + 1));
    parcela = { numero, total, mes: nomeMes(referenteA), texto: `${numero}/${total}` };
  }
  const ultimo = [...pagos.values()].sort((a, b) => (a.data_pagamento < b.data_pagamento ? 1 : -1))[0] || null;

  return { status, atraso, vencidos, proximo, pagos, emAberto, ultimo, parcela };
}

// Calcula situação, pagamento e reajuste de cada contrato de uma vez.
// Os campos "status_pagamento" e "atraso" passam a ser calculados pelos pagamentos registrados.
export function analisarContratos(contratos, pagamentos = [], regras = REGRAS_PADRAO, referencia = hoje()) {
  return contratos.map((original) => {
    const c = { ...original, regras: { ...REGRAS_PADRAO, ...(regras || {}) } };
    const reajuste = infoReajuste(c, referencia);
    // Só vale reajustar se o contrato ainda estiver valendo na data do reajuste
    reajuste.disponivel = reajuste.disponivel && reajuste.proximo < lerData(c.data_fim);
    const pagamento = analisarPagamentos(c, pagamentos, referencia);
    return {
      ...c,
      situacao: situacaoContrato(c, referencia, Number(c.regras.aviso_vencimento_dias ?? 30)),
      status_pagamento: pagamento.status,
      atraso: pagamento.atraso,
      pagamento,
      parcela: pagamento.parcela,
      reajuste,
      vencimento: proximoVencimento(c, referencia),
      renovacao: infoRenovacao(c, referencia),
    };
  });
}

// Renovação: o botão só fica ativo no mês em que o contrato vence (ou se já venceu)
export function infoRenovacao(contrato, referencia = hoje()) {
  const fim = lerData(contrato.data_fim);
  const inicioJanela = new Date(fim.getFullYear(), fim.getMonth(), 1);
  const novoFim = new Date(fim.getFullYear() + 1, fim.getMonth(), fim.getDate());
  return { fim, inicioJanela, novoFim, disponivel: referencia >= inicioJanela };
}

// Quantos dias cada status pode ficar parado antes de virar alerta
export const LIMITE_SEM_EVOLUCAO = { Aberta: 3, 'Em análise': 7, 'Em andamento': 14 };

// Pontos de atenção de uma solicitação: prazo e tempo parada
export function analisarSolicitacao(s, referencia = hoje()) {
  const resultado = { alertas: [], diasParada: 0, prazoDias: null };
  if (estaEncerrada(s)) return resultado;

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

// ---------- Custos e resultado do mês ----------

export const CATEGORIAS_CUSTO = ['Manutenção', 'Material', 'Mão de obra', 'IPTU', 'Condomínio', 'Seguro', 'Taxas', 'Outro'];

// "2026-11" do mês atual (ou de uma data)
export const mesAtual = (data = new Date()) => chaveMes(data);

// Anda N meses a partir de "2026-11" (ex.: -1 = mês anterior)
export function somarMes(chave, quantos) {
  const [ano, mes] = chave.split('-').map(Number);
  return chaveMes(new Date(ano, mes - 1 + quantos, 1));
}

// Junta o que entrou (aluguéis pagos) e o que saiu (custos) num mês
export function resumoDoMes(chave, { contratos = [], pagamentos = [], custos = [] }) {
  const [ano, mes] = chave.split('-').map(Number);
  const inicioMes = new Date(ano, mes - 1, 1);
  const fimMes = new Date(ano, mes, 0);

  const doMes = custos.filter((c) => String(c.data).slice(0, 7) === chave);
  const totalCustos = arredondar(doMes.reduce((s, c) => s + Number(c.valor), 0));

  const pagos = pagamentos.filter((p) => String(p.referencia).slice(0, 7) === chave);
  const recebido = arredondar(pagos.reduce((s, p) => s + Number(p.valor_pago), 0));

  // Previsto: aluguel de todo contrato que estava valendo naquele mês
  const previsto = arredondar(
    contratos
      .filter((c) => lerData(c.data_inicio) <= fimMes && lerData(c.data_fim) >= inicioMes)
      .reduce((s, c) => s + Number(c.valor_aluguel), 0),
  );

  const porCategoria = CATEGORIAS_CUSTO.map((categoria) => {
    const itens = doMes.filter((c) => c.categoria === categoria);
    return { categoria, quantidade: itens.length, valor: arredondar(itens.reduce((s, c) => s + Number(c.valor), 0)) };
  }).filter((c) => c.quantidade);

  return {
    chave,
    custos: doMes,
    totalCustos,
    recebido,
    previsto,
    resultado: arredondar(recebido - totalCustos),
    porCategoria,
  };
}

// ---------- Imóveis ----------

export const TIPOS_IMOVEL = ['Casa', 'Apartamento', 'Kitnet', 'Sobrado', 'Sala comercial', 'Outro'];

// Situação de cada imóvel pelo contrato: Alugado (contrato valendo hoje), Reservado (contrato começa depois) ou Disponível
export function situacaoImoveis(imoveis, contratosAnalisados, referencia = hoje()) {
  return imoveis.map((imovel) => {
    const doImovel = contratosAnalisados.filter((c) => c.imovel_id === imovel.id);
    const atual = doImovel.find((c) => lerData(c.data_inicio) <= referencia && lerData(c.data_fim) >= referencia);
    const futuro = !atual && doImovel.find((c) => lerData(c.data_inicio) > referencia);
    const situacao = atual ? 'Alugado' : futuro ? 'Reservado' : 'Disponível';
    return { ...imovel, situacao, contrato: atual || futuro || null, contratos: doImovel };
  });
}

// "3 quartos · 2 banheiros · 1 vaga · 80 m²"
export function especificacoes(imovel) {
  if (!imovel) return '';
  const plural = (n, um, varios) => `${n} ${Number(n) === 1 ? um : varios}`;
  return [
    imovel.quartos != null && plural(imovel.quartos, 'quarto', 'quartos'),
    imovel.banheiros != null && plural(imovel.banheiros, 'banheiro', 'banheiros'),
    imovel.vagas != null && plural(imovel.vagas, 'vaga', 'vagas'),
    imovel.area_m2 && `${Number(imovel.area_m2).toLocaleString('pt-BR')} m²`,
  ]
    .filter(Boolean)
    .join(' · ');
}

// Diminui a foto antes de enviar (máx. 1600 px, JPEG), para carregar rápido no celular
export async function reduzirFoto(arquivo, maximo = 1600) {
  try {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, maximo / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
    return blob || arquivo;
  } catch {
    return arquivo;
  }
}

// ---------- Comunicados ----------

export const TIPOS_COMUNICADO = [
  'Aviso',
  'Cobrança',
  'Visita ao imóvel',
  'Manutenção programada',
  'Reajuste',
  'Renovação',
  'Regras do imóvel',
  'Outro',
];

export function situacaoComunicado(c) {
  if (c.resposta === 'Confirmado') return { texto: 'Confirmado', cor: 'verde' };
  if (c.resposta === 'Recusado') return { texto: 'Recusado', cor: 'vermelho' };
  if (c.pede_resposta) return { texto: c.lido_em ? 'Lido, sem resposta' : 'Aguardando leitura', cor: 'amarelo' };
  return { texto: c.lido_em ? 'Lido' : 'Não lido', cor: c.lido_em ? 'verde' : 'cinza' };
}

export const dataHoraBR = (iso) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

// Itens que o anfitrião marca como "incluso" ou "não incluso" no aluguel (ele pode criar outros)
export const ITENS_INCLUSOS_PADRAO = ['Água', 'Luz', 'Gás', 'Internet', 'IPTU', 'Condomínio', 'Lixo', 'Limpeza', 'Jardinagem', 'Seguro'];

// ---------- Ficha do inquilino personalizável ----------

export const SECOES_FICHA = [
  { id: 'resumo', rotulo: 'Resumo e pontos de atenção' },
  { id: 'comunicados', rotulo: 'Comunicados' },
  { id: 'advertencias', rotulo: 'Advertências' },
  { id: 'dados', rotulo: 'Dados pessoais' },
  { id: 'adicionais', rotulo: 'Informações adicionais (seus campos)' },
  { id: 'documentos', rotulo: 'Documentos' },
  { id: 'acesso', rotulo: 'Acesso ao portal' },
  { id: 'contratos', rotulo: 'Contratos e pagamentos' },
  { id: 'solicitacoes', rotulo: 'Solicitações' },
];

export const TIPOS_CAMPO = [
  { id: 'texto', rotulo: 'Texto' },
  { id: 'numero', rotulo: 'Número' },
  { id: 'data', rotulo: 'Data' },
  { id: 'sim_nao', rotulo: 'Sim ou não' },
  { id: 'anexo', rotulo: 'Anexo (PDF ou imagem)' },
];

// ---------- Advertências e regras ----------
export const MOTIVOS_ADVERTENCIA = ['Barulho', 'Atraso de pagamento', 'Danos ao imóvel', 'Regras do imóvel', 'Animais', 'Uso indevido', 'Outro'];

export const SUGESTOES_REGRAS = [
  'Silêncio das 22h às 8h',
  'Proibido fumar dentro do imóvel',
  'Animais só com aviso prévio',
  'Não é permitido sublocar',
  'Lixo só nos dias de coleta',
  'Visitas de pernoite com aviso',
  'Reformas só com autorização',
];

// Texto com uma regra por linha vira lista
export const listaDeRegras = (texto) =>
  String(texto || '')
    .split('\n')
    .map((l) => l.replace(/^[-•*\s]+/, '').trim())
    .filter(Boolean);
