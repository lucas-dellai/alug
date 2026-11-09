// Custos: o que o anfitrião gastou no mês (consertos, materiais, IPTU...), com comprovante,
// ligado ao imóvel e ao chamado. Mostra o resultado do mês: recebido menos custos.
import { useMemo, useState } from 'react';
import { api } from '../api';
import { supabase } from '../supabaseClient';
import { Campo, Etiqueta, Modal, Vazio, useUI } from './UI';
import DetalheSolicitacao from './DetalheSolicitacao';
import { CATEGORIAS_CUSTO, dataBR, hoje, mesAtual, moeda, nomeMes, paraISO, resumoDoMes, semAcento, somarMes } from '../utils';

const TIPOS_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const TAMANHO_MAXIMO = 5 * 1024 * 1024;

export default function Custos({ custos, contratos, solicitacoes, pagamentos, recarregar, abrirInquilino, mesInicial, voltar }) {
  const [mes, setMes] = useState(mesInicial || mesAtual());
  const [imovel, setImovel] = useState('');
  const [formulario, setFormulario] = useState(null); // {} novo, { custo } editar
  const [chamadoAberto, setChamadoAberto] = useState(null);

  const resumo = useMemo(() => resumoDoMes(mes, { contratos, pagamentos, custos }), [mes, contratos, pagamentos, custos]);
  const lista = imovel
    ? resumo.custos.filter((c) => (imovel === 'geral' ? !c.contrato_id : String(c.contrato_id) === imovel))
    : resumo.custos;
  const maiorCategoria = Math.max(1, ...resumo.porCategoria.map((c) => c.valor));
  const ehMesAtual = mes === mesAtual();

  return (
    <div className="pagina">
      {voltar && (
        <button className="voltar" onClick={voltar}>
          ← Início
        </button>
      )}
      <div className="pagina-topo">
        <div>
          <h1>Custos</h1>
          <p className="texto-suave">Gastos com os imóveis, ligados aos chamados, e o resultado de cada mês.</p>
        </div>
        <div className="botoes">
          <button className="botao botao-primario" onClick={() => setFormulario({})}>
            + Novo custo
          </button>
        </div>
      </div>

      {/* Escolha do mês */}
      <div className="seletor-mes">
        <button className="botao-icone" onClick={() => setMes(somarMes(mes, -1))} aria-label="Mês anterior">
          ‹
        </button>
        <strong>{nomeMes(mes)}</strong>
        <button className="botao-icone" onClick={() => setMes(somarMes(mes, 1))} aria-label="Próximo mês">
          ›
        </button>
        {!ehMesAtual && (
          <button className="link pequeno" onClick={() => setMes(mesAtual())}>
            Voltar para o mês atual
          </button>
        )}
      </div>

      {/* Resultado do mês */}
      <section className="resumo resumo-3">
        <div className="resumo-cartao">
          <span>Recebido no mês</span>
          <strong className="texto-verde">{moeda(resumo.recebido)}</strong>
          <small>Previsto: {moeda(resumo.previsto)}</small>
        </div>
        <div className={`resumo-cartao ${resumo.totalCustos ? 'alerta-amarelo' : ''}`}>
          <span>Custos do mês</span>
          <strong>{moeda(resumo.totalCustos)}</strong>
          <small>{resumo.custos.length} lançamento(s)</small>
        </div>
        <div className={`resumo-cartao ${resumo.resultado < 0 ? 'alerta-vermelho' : 'destaque'}`}>
          <span>Resultado do mês</span>
          <strong>{moeda(resumo.resultado)}</strong>
          <small>Recebido menos custos</small>
        </div>
      </section>

      <div className="custos-grade">
        <section className="cartao">
          <div className="cartao-topo">
            <h2>Custos de {nomeMes(mes).toLowerCase()}</h2>
            <div className="filtros">
              <select value={imovel} onChange={(e) => setImovel(e.target.value)} aria-label="Imóvel">
                <option value="">Todos os imóveis</option>
                <option value="geral">Sem imóvel (gerais)</option>
                {contratos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.imovel}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!lista.length ? (
            <Vazio
              titulo="Nenhum custo neste mês"
              texto="Lance aqui consertos, materiais, IPTU e outros gastos. Dá para anexar a nota e ligar ao chamado."
            >
              <button className="botao botao-primario" onClick={() => setFormulario({})}>
                + Novo custo
              </button>
            </Vazio>
          ) : (
            <ListaCustos
              custos={lista}
              aoEditar={(custo) => setFormulario({ custo })}
              aoAbrirChamado={(id) => setChamadoAberto(id)}
              recarregar={recarregar}
            />
          )}
        </section>

        <section className="cartao">
          <h2>Por categoria</h2>
          {!resumo.porCategoria.length ? (
            <p className="texto-suave">Sem custos neste mês.</p>
          ) : (
            <ul className="barras">
              {resumo.porCategoria.map((c) => (
                <li key={c.categoria}>
                  <div className="barras-botao">
                    <span className="barras-rotulo">
                      {c.categoria} <span className="texto-suave">({c.quantidade})</span>
                    </span>
                    <span className="barras-trilho">
                      <span className="barras-valor barras-custo" style={{ width: `${(c.valor / maiorCategoria) * 100}%` }} />
                    </span>
                    <span className="barras-numero">{moeda(c.valor)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {formulario && (
        <FormCusto
          custo={formulario.custo}
          contratos={contratos}
          solicitacoes={solicitacoes}
          dataPadrao={ehMesAtual ? undefined : `${mes}-01`}
          aoFechar={() => setFormulario(null)}
          aoSalvar={(salvo) => {
            setFormulario(null);
            if (salvo?.data) setMes(String(salvo.data).slice(0, 7));
            recarregar();
          }}
        />
      )}

      {chamadoAberto && solicitacoes.find((s) => s.id === chamadoAberto) && (
        <DetalheSolicitacao
          solicitacao={solicitacoes.find((s) => s.id === chamadoAberto)}
          contratos={contratos}
          aoFechar={() => setChamadoAberto(null)}
          aoAtualizar={recarregar}
          abrirInquilino={abrirInquilino}
        />
      )}
    </div>
  );
}

// Lista de custos (usada na aba Custos e dentro do chamado)
export function ListaCustos({ custos, aoEditar, aoAbrirChamado, recarregar, dentroDoChamado }) {
  const { avisar, confirmar } = useUI();

  async function excluir(custo) {
    const ok = await confirmar('Excluir custo?', `"${custo.descricao}" (${moeda(custo.valor)}) e o comprovante serão apagados.`);
    if (!ok) return;
    try {
      await api.excluir('custos', custo.id);
      avisar('Custo excluído.');
      recarregar?.();
    } catch (erro) {
      avisar(erro.message, 'erro');
    }
  }

  return (
    <ul className="lista-custos">
      {custos.map((c) => (
        <li key={c.id}>
          <div className="custo-data">
            <strong>{String(c.data).slice(8, 10)}</strong>
            <small>{nomeMes(c.data).slice(0, 3).toLowerCase()}</small>
          </div>
          <div className="custo-info">
            <strong>{c.descricao}</strong>
            <span className="sub">
              <Etiqueta cor="cinza">{c.categoria}</Etiqueta> {c.contratos?.imovel || 'Custo geral'}
            </span>
            {!dentroDoChamado && c.solicitacao_id && (
              <button className="link pequeno" onClick={() => aoAbrirChamado?.(c.solicitacao_id)}>
                Chamado: {c.solicitacoes?.titulo || `#${c.solicitacao_id}`} ›
              </button>
            )}
            {c.observacoes && <span className="sub">{c.observacoes}</span>}
          </div>
          <div className="custo-lado">
            <strong className="custo-valor">{moeda(c.valor)}</strong>
            <div className="botoes">
              {c.comprovante_caminho && <BotaoComprovante custo={c} />}
              <button className="botao botao-pequeno botao-secundario" onClick={() => aoEditar(c)}>
                Editar
              </button>
              <button className="botao botao-pequeno botao-perigo-leve" onClick={() => excluir(c)}>
                Excluir
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function BotaoComprovante({ custo }) {
  const { avisar } = useUI();
  async function abrir() {
    const janela = window.open('', '_blank');
    const { data, error } = await supabase.storage.from('custos').createSignedUrl(custo.comprovante_caminho, 120);
    if (error || !data?.signedUrl) {
      janela?.close();
      return avisar('Não foi possível abrir o comprovante.', 'erro');
    }
    if (janela) janela.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  }
  return (
    <button className="botao botao-pequeno botao-secundario" onClick={abrir} title={custo.comprovante_nome}>
      📎 Comprovante
    </button>
  );
}

// CREATE / UPDATE de um custo, com comprovante opcional
export function FormCusto({ custo, contratos = [], solicitacoes = [], fixo, dataPadrao, aoFechar, aoSalvar }) {
  const { avisar } = useUI();
  const [salvando, setSalvando] = useState(false);
  const [arquivo, setArquivo] = useState(null);
  const [v, setV] = useState({
    descricao: custo?.descricao || '',
    valor: custo?.valor ?? '',
    data: custo?.data || dataPadrao || paraISO(hoje()),
    categoria: custo?.categoria || 'Manutenção',
    contrato_id: custo?.contrato_id ?? fixo?.contrato_id ?? '',
    solicitacao_id: custo?.solicitacao_id ?? fixo?.solicitacao_id ?? '',
    observacoes: custo?.observacoes || '',
  });
  const muda = (campo) => (e) => setV((atual) => ({ ...atual, [campo]: e.target.value }));

  // Ao escolher um chamado, o imóvel vem junto
  function escolherChamado(e) {
    const id = e.target.value;
    const chamado = solicitacoes.find((s) => String(s.id) === id);
    setV((atual) => ({ ...atual, solicitacao_id: id, contrato_id: chamado ? chamado.contrato_id : atual.contrato_id }));
  }

  const chamadosDoImovel = solicitacoes.filter((s) => !v.contrato_id || String(s.contrato_id) === String(v.contrato_id));

  function escolherArquivo(e) {
    const escolhido = e.target.files?.[0];
    if (!escolhido) return;
    if (!TIPOS_ACEITOS.includes(escolhido.type)) {
      e.target.value = '';
      return avisar('Envie foto (JPG, PNG, WEBP) ou PDF.', 'erro');
    }
    if (escolhido.size > TAMANHO_MAXIMO) {
      e.target.value = '';
      return avisar('O arquivo passa de 5 MB.', 'erro');
    }
    setArquivo(escolhido);
  }

  async function enviar(e) {
    e.preventDefault();
    if (!v.descricao.trim()) return avisar('Descreva o custo.', 'erro');
    if (!(Number(v.valor) > 0)) return avisar('O valor precisa ser maior que zero.', 'erro');
    setSalvando(true);
    let novoCaminho = null;
    try {
      const dados = {
        ...v,
        valor: Number(v.valor),
        contrato_id: v.contrato_id ? Number(v.contrato_id) : null,
        solicitacao_id: v.solicitacao_id ? Number(v.solicitacao_id) : null,
      };
      if (arquivo) {
        const nomeSeguro = semAcento(arquivo.name).replace(/[^a-z0-9._-]/g, '_');
        // Pasta do anfitrião: cada um só acessa os próprios comprovantes
        const { data: sessao } = await supabase.auth.getSession();
        novoCaminho = `${sessao.session.user.id}/${v.data.slice(0, 7)}/${Date.now()}-${nomeSeguro}`;
        const { error } = await supabase.storage.from('custos').upload(novoCaminho, arquivo, { contentType: arquivo.type });
        if (error) throw new Error('Não foi possível enviar o comprovante.');
        dados.comprovante_nome = arquivo.name;
        dados.comprovante_caminho = novoCaminho;
      }
      const salvo = custo ? await api.atualizar('custos', custo.id, dados) : await api.criar('custos', dados);
      // Trocou o comprovante: apaga o antigo
      if (arquivo && custo?.comprovante_caminho) await supabase.storage.from('custos').remove([custo.comprovante_caminho]);
      avisar(custo ? 'Custo atualizado.' : 'Custo lançado.');
      aoSalvar(salvo);
    } catch (erro) {
      if (novoCaminho) await supabase.storage.from('custos').remove([novoCaminho]);
      avisar(erro.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={custo ? 'Editar custo' : 'Novo custo'} subtitulo={fixo ? 'Ligado a este chamado' : undefined} aoFechar={aoFechar}>
      <form onSubmit={enviar}>
        <div className="grade-formulario">
          <Campo rotulo="Descrição" obrigatorio largo>
            <input value={v.descricao} onChange={muda('descricao')} placeholder="Ex.: Troca do sifão da pia" required autoFocus />
          </Campo>
          <Campo rotulo="Valor (R$)" obrigatorio>
            <input type="number" min="0.01" step="0.01" inputMode="decimal" value={v.valor} onChange={muda('valor')} required />
          </Campo>
          <Campo rotulo="Data" obrigatorio>
            <input type="date" value={v.data} onChange={muda('data')} required />
          </Campo>
          <Campo rotulo="Categoria">
            <select value={v.categoria} onChange={muda('categoria')}>
              {CATEGORIAS_CUSTO.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Campo>
          {!fixo && (
            <>
              <Campo rotulo="Imóvel">
                <select
                  value={v.contrato_id}
                  onChange={(e) => setV((atual) => ({ ...atual, contrato_id: e.target.value, solicitacao_id: '' }))}
                >
                  <option value="">Custo geral (sem imóvel)</option>
                  {contratos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.imovel} · {c.inquilinos?.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Chamado (solicitação)" largo>
                <select value={v.solicitacao_id} onChange={escolherChamado}>
                  <option value="">Nenhum</option>
                  {chamadosDoImovel.map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.id} · {s.titulo} ({s.status})
                    </option>
                  ))}
                </select>
              </Campo>
            </>
          )}
          <Campo
            rotulo="Comprovante (nota, recibo)"
            largo
            dica={
              arquivo
                ? `Selecionado: ${arquivo.name}`
                : custo?.comprovante_nome
                  ? `Atual: ${custo.comprovante_nome}. Escolha outro para trocar.`
                  : 'Foto ou PDF de até 5 MB. Opcional.'
            }
          >
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={escolherArquivo} />
          </Campo>
          <Campo rotulo="Observações" largo>
            <textarea rows="2" value={v.observacoes} onChange={muda('observacoes')} />
          </Campo>
        </div>
        <div className="modal-acoes">
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="botao botao-primario" disabled={salvando}>
            {salvando ? 'Salvando…' : custo ? 'Salvar alterações' : 'Lançar custo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
