// Imóveis: cadastro de cada imóvel (foto de capa, especificações, o que está incluso)
// e a situação pelo contrato: Alugado, Reservado ou Disponível.
import { useMemo, useState } from 'react';
import { api } from '../api';
import { supabase } from '../supabaseClient';
import { Campo, Etiqueta, Modal, Vazio, useUI } from './UI';
import { FormContrato } from './Formularios';
import {
  ITENS_INCLUSOS_PADRAO,
  TIPOS_IMOVEL,
  analisarContratos,
  dataBR,
  especificacoes,
  moeda,
  reduzirFoto,
  semAcento,
  situacaoImoveis,
} from '../utils';

const FILTROS = ['Todos', 'Alugado', 'Disponível', 'Reservado'];
const CORES = { Alugado: 'verde', Disponível: 'azul', Reservado: 'amarelo' };

export default function Imoveis({ imoveis = [], contratos, inquilinos, pagamentos, regras, recarregar, abrirInquilino }) {
  const [filtro, setFiltro] = useState('Todos');
  const [busca, setBusca] = useState('');
  const [formulario, setFormulario] = useState(null); // {} novo, { imovel } editar
  const [alugando, setAlugando] = useState(null); // imóvel para novo contrato

  const analisados = useMemo(() => analisarContratos(contratos, pagamentos, regras), [contratos, pagamentos, regras]);
  const lista = useMemo(() => situacaoImoveis(imoveis, analisados), [imoveis, analisados]);
  const contagem = (f) => (f === 'Todos' ? lista.length : lista.filter((i) => i.situacao === f).length);

  const filtrados = lista.filter((i) => {
    if (filtro !== 'Todos' && i.situacao !== filtro) return false;
    if (busca && !semAcento(`${i.nome} ${i.endereco} ${i.contrato?.inquilinos?.nome || ''}`).includes(semAcento(busca))) return false;
    return true;
  });

  // Itens personalizados que o anfitrião já criou em outros imóveis
  const itensConhecidos = useMemo(() => {
    const todos = new Set(ITENS_INCLUSOS_PADRAO);
    for (const i of imoveis) [...(i.incluso || []), ...(i.nao_incluso || [])].forEach((item) => todos.add(item));
    return [...todos];
  }, [imoveis]);

  return (
    <div className="pagina">
      <div className="pagina-topo">
        <div>
          <h1>Imóveis</h1>
          <p className="texto-suave">Seus imóveis, quem está em cada um e o que está incluso no aluguel.</p>
        </div>
        <div className="botoes">
          <button className="botao botao-primario" onClick={() => setFormulario({})}>
            + Novo imóvel
          </button>
        </div>
      </div>

      <div className="filtro-chips" role="tablist" aria-label="Situação">
        {FILTROS.filter((f) => f !== 'Reservado' || contagem('Reservado')).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filtro === f}
            className={`chip ${filtro === f ? 'chip-ativo' : ''}`}
            onClick={() => setFiltro(f)}
          >
            {f === 'Todos' ? 'Todos' : f === 'Alugado' ? 'Alugados' : f === 'Disponível' ? 'Disponíveis' : 'Reservados'}
            <span className="chip-numero">{contagem(f)}</span>
          </button>
        ))}
        <input
          type="search"
          className="filtro-busca"
          placeholder="Buscar imóvel ou inquilino…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar imóvel"
        />
      </div>

      {!imoveis.length ? (
        <section className="cartao">
          <Vazio titulo="Nenhum imóvel cadastrado" texto="Cadastre seus imóveis com foto, quartos e o que está incluso no aluguel.">
            <button className="botao botao-primario" onClick={() => setFormulario({})}>
              + Novo imóvel
            </button>
          </Vazio>
        </section>
      ) : !filtrados.length ? (
        <p className="texto-suave centro">Nenhum imóvel nesta lista.</p>
      ) : (
        <div className="grade-imoveis">
          {filtrados.map((i) => (
            <CartaoImovel
              key={i.id}
              imovel={i}
              aoEditar={() => setFormulario({ imovel: i })}
              aoAlugar={() => setAlugando(i)}
              abrirInquilino={abrirInquilino}
            />
          ))}
        </div>
      )}

      {formulario && (
        <FormImovel
          imovel={formulario.imovel}
          itensConhecidos={itensConhecidos}
          aoFechar={() => setFormulario(null)}
          aoSalvar={() => {
            setFormulario(null);
            recarregar();
          }}
        />
      )}

      {alugando && (
        <FormContrato
          inquilinos={inquilinos}
          imoveis={imoveis}
          imovelFixo={alugando}
          regras={regras}
          aoFechar={() => setAlugando(null)}
          aoSalvar={() => {
            setAlugando(null);
            recarregar();
          }}
        />
      )}
    </div>
  );
}

function CartaoImovel({ imovel, aoEditar, aoAlugar, abrirInquilino }) {
  const c = imovel.contrato;
  const specs = especificacoes(imovel);
  return (
    <article className="cartao-imovel">
      <button className="imovel-capa" onClick={aoEditar} title="Editar imóvel">
        {imovel.foto_url ? (
          <img src={imovel.foto_url} alt={`Foto de ${imovel.nome}`} loading="lazy" />
        ) : (
          <span className="imovel-sem-foto" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
            </svg>
            <small>Adicionar foto</small>
          </span>
        )}
        <span className={`imovel-selo selo-${CORES[imovel.situacao]}`}>{imovel.situacao}</span>
        <span className="imovel-editar" aria-hidden="true">
          ✎
        </span>
      </button>

      <div className="imovel-corpo">
        <div>
          <h3>{imovel.nome}</h3>
          <p className="sub">
            {imovel.tipo} · {imovel.endereco}
          </p>
          {specs && <p className="imovel-specs">{specs}</p>}
          {(imovel.mobiliado || imovel.aceita_pet) && (
            <p className="etiquetas">
              {imovel.mobiliado && <Etiqueta cor="cinza">Mobiliado</Etiqueta>}
              {imovel.aceita_pet && <Etiqueta cor="cinza">Aceita pet</Etiqueta>}
            </p>
          )}
        </div>

        {(imovel.incluso?.length > 0 || imovel.nao_incluso?.length > 0) && (
          <div className="imovel-inclusos">
            {imovel.incluso?.length > 0 && (
              <p>
                <span className="inclui-sim">✓ Incluso:</span> {imovel.incluso.join(', ')}
              </p>
            )}
            {imovel.nao_incluso?.length > 0 && (
              <p>
                <span className="inclui-nao">✕ Não incluso:</span> {imovel.nao_incluso.join(', ')}
              </p>
            )}
          </div>
        )}

        {c ? (
          <div className="imovel-contrato">
            <div className="imovel-contrato-topo">
              <span className="texto-suave pequeno">{imovel.situacao === 'Reservado' ? 'Reservado para' : 'Inquilino'}</span>
              <button className="link" onClick={() => abrirInquilino(c.inquilino_id)}>
                {c.inquilinos?.nome} ›
              </button>
            </div>
            <div className="imovel-contrato-linha">
              <strong>{moeda(c.valor_aluguel)}</strong>
              {imovel.situacao === 'Alugado' && (
                <span className="pagamento-mes">
                  <Etiqueta valor={c.status_pagamento} />
                  {c.parcela && (
                    <span className="parcela" title={`Parcela ${c.parcela.numero} de ${c.parcela.total}`}>
                      {c.parcela.texto}
                    </span>
                  )}
                </span>
              )}
            </div>
            <p className="sub">
              {imovel.situacao === 'Reservado'
                ? `Começa em ${dataBR(c.data_inicio)}`
                : `Desde ${dataBR(c.data_inicio)} · vence em ${dataBR(c.data_fim)}`}
            </p>
          </div>
        ) : (
          <div className="imovel-contrato imovel-livre">
            <span>
              Disponível
              {imovel.valor_sugerido ? (
                <>
                  {' '}
                  · <strong>{moeda(imovel.valor_sugerido)}</strong>
                </>
              ) : null}
            </span>
            <button className="botao botao-pequeno botao-primario" onClick={aoAlugar}>
              Alugar (novo contrato)
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

// CREATE / UPDATE / DELETE de um imóvel, com foto de capa
export function FormImovel({ imovel, itensConhecidos = ITENS_INCLUSOS_PADRAO, aoFechar, aoSalvar }) {
  const { avisar, confirmar } = useUI();
  const [salvando, setSalvando] = useState(false);
  const [foto, setFoto] = useState(null); // arquivo novo
  const [previa, setPrevia] = useState(imovel?.foto_url || '');
  const [removerFoto, setRemoverFoto] = useState(false);
  const [novoItem, setNovoItem] = useState('');
  const [itens, setItens] = useState(() => {
    const todos = new Set(itensConhecidos);
    [...(imovel?.incluso || []), ...(imovel?.nao_incluso || [])].forEach((i) => todos.add(i));
    return [...todos];
  });
  const [v, setV] = useState({
    nome: imovel?.nome || '',
    endereco: imovel?.endereco || '',
    tipo: imovel?.tipo || 'Casa',
    quartos: imovel?.quartos ?? '',
    banheiros: imovel?.banheiros ?? '',
    vagas: imovel?.vagas ?? '',
    area_m2: imovel?.area_m2 ?? '',
    valor_sugerido: imovel?.valor_sugerido ?? '',
    mobiliado: imovel?.mobiliado ?? false,
    aceita_pet: imovel?.aceita_pet ?? false,
    descricao: imovel?.descricao || '',
    incluso: imovel?.incluso || [],
    nao_incluso: imovel?.nao_incluso || [],
  });
  const muda = (campo) => (e) =>
    setV((atual) => ({ ...atual, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  // Cada item alterna: sem marcar -> Incluso -> Não incluso -> sem marcar
  function estadoItem(item) {
    if (v.incluso.includes(item)) return 'sim';
    if (v.nao_incluso.includes(item)) return 'nao';
    return '';
  }
  function marcar(item, estado) {
    setV((atual) => ({
      ...atual,
      incluso: estado === 'sim' ? [...atual.incluso.filter((i) => i !== item), item] : atual.incluso.filter((i) => i !== item),
      nao_incluso:
        estado === 'nao' ? [...atual.nao_incluso.filter((i) => i !== item), item] : atual.nao_incluso.filter((i) => i !== item),
    }));
  }
  function adicionarItem() {
    const nome = novoItem.trim().slice(0, 40);
    if (!nome) return;
    const existente = itens.find((i) => semAcento(i) === semAcento(nome));
    if (!existente) setItens((lista) => [...lista, nome]);
    marcar(existente || nome, 'sim');
    setNovoItem('');
  }

  function escolherFoto(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type)) return avisar('Envie uma foto JPG, PNG ou WEBP.', 'erro');
    if (arquivo.size > 15 * 1024 * 1024) return avisar('A foto passa de 15 MB.', 'erro');
    setFoto(arquivo);
    setRemoverFoto(false);
    setPrevia(URL.createObjectURL(arquivo));
  }

  async function enviar(e) {
    e.preventDefault();
    if (!v.nome.trim() || !v.endereco.trim()) return avisar('Informe o nome e o endereço do imóvel.', 'erro');
    setSalvando(true);
    let novoCaminho = null;
    try {
      const numero = (x) => (x === '' || x === null ? null : Number(x));
      const dados = {
        ...v,
        quartos: numero(v.quartos),
        banheiros: numero(v.banheiros),
        vagas: numero(v.vagas),
        area_m2: numero(v.area_m2),
        valor_sugerido: numero(v.valor_sugerido),
      };
      if (foto) {
        const reduzida = await reduzirFoto(foto);
        novoCaminho = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from('imoveis').upload(novoCaminho, reduzida, { contentType: 'image/jpeg' });
        if (error) throw new Error('Não foi possível enviar a foto.');
        dados.foto_caminho = novoCaminho;
        dados.foto_url = supabase.storage.from('imoveis').getPublicUrl(novoCaminho).data.publicUrl;
      } else if (removerFoto) {
        dados.foto_caminho = null;
        dados.foto_url = null;
      }
      const salvo = imovel ? await api.atualizar('imoveis', imovel.id, dados) : await api.criar('imoveis', dados);
      // Trocou ou removeu a foto: apaga a antiga
      if ((foto || removerFoto) && imovel?.foto_caminho) await supabase.storage.from('imoveis').remove([imovel.foto_caminho]);
      avisar(imovel ? 'Imóvel atualizado.' : 'Imóvel cadastrado.');
      aoSalvar(salvo);
    } catch (erro) {
      if (novoCaminho) await supabase.storage.from('imoveis').remove([novoCaminho]);
      avisar(erro.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    const ok = await confirmar(
      'Excluir imóvel?',
      `"${imovel.nome}" e a foto serão apagados. Os contratos continuam, só deixam de apontar para este cadastro.`,
    );
    if (!ok) return;
    try {
      await api.excluir('imoveis', imovel.id);
      avisar('Imóvel excluído.');
      aoSalvar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    }
  }

  return (
    <Modal titulo={imovel ? 'Editar imóvel' : 'Novo imóvel'} aoFechar={aoFechar} largo>
      <form onSubmit={enviar}>
        <div className="foto-imovel-campo">
          <div className="foto-imovel-previa">
            {previa && !removerFoto ? <img src={previa} alt="Foto de capa" /> : <span>Sem foto de capa</span>}
          </div>
          <div className="botoes">
            <label className="botao botao-pequeno botao-secundario">
              {previa && !removerFoto ? 'Trocar foto' : '+ Foto de capa'}
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={escolherFoto} />
            </label>
            {previa && !removerFoto && (
              <button
                type="button"
                className="botao botao-pequeno botao-perigo-leve"
                onClick={() => {
                  setFoto(null);
                  setRemoverFoto(true);
                }}
              >
                Remover foto
              </button>
            )}
          </div>
        </div>

        <h3 className="secao-formulario">Identificação</h3>
        <div className="grade-formulario">
          <Campo rotulo="Nome do imóvel" obrigatorio dica="Como você chama, ex.: Casa da Rua das Flores">
            <input value={v.nome} onChange={muda('nome')} required autoFocus={!imovel} />
          </Campo>
          <Campo rotulo="Tipo">
            <select value={v.tipo} onChange={muda('tipo')}>
              {TIPOS_IMOVEL.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Endereço" obrigatorio largo>
            <input value={v.endereco} onChange={muda('endereco')} placeholder="Rua, número, bairro" required />
          </Campo>
        </div>

        <h3 className="secao-formulario">Especificações</h3>
        <div className="grade-formulario grade-4">
          <Campo rotulo="Quartos">
            <input type="number" min="0" max="50" inputMode="numeric" value={v.quartos} onChange={muda('quartos')} />
          </Campo>
          <Campo rotulo="Banheiros">
            <input type="number" min="0" max="50" inputMode="numeric" value={v.banheiros} onChange={muda('banheiros')} />
          </Campo>
          <Campo rotulo="Vagas">
            <input type="number" min="0" max="50" inputMode="numeric" value={v.vagas} onChange={muda('vagas')} />
          </Campo>
          <Campo rotulo="Área (m²)">
            <input type="number" min="0" step="0.01" inputMode="decimal" value={v.area_m2} onChange={muda('area_m2')} />
          </Campo>
          <Campo rotulo="Valor sugerido do aluguel (R$)" largo>
            <input type="number" min="0" step="0.01" inputMode="decimal" value={v.valor_sugerido} onChange={muda('valor_sugerido')} />
          </Campo>
        </div>
        <div className="botoes marcadores">
          <label className="caixa-marcar">
            <input type="checkbox" checked={v.mobiliado} onChange={muda('mobiliado')} />
            <span>Mobiliado</span>
          </label>
          <label className="caixa-marcar">
            <input type="checkbox" checked={v.aceita_pet} onChange={muda('aceita_pet')} />
            <span>Aceita pet</span>
          </label>
        </div>

        <h3 className="secao-formulario">O que está incluso no aluguel</h3>
        <p className="texto-suave pequeno">Toque para marcar: ✓ Incluso ou ✕ Não incluso (o inquilino paga à parte).</p>
        <ul className="itens-inclusos">
          {itens.map((item) => {
            const estado = estadoItem(item);
            return (
              <li key={item} className={`item-incluso item-${estado || 'vazio'}`}>
                <span className="item-nome">{item}</span>
                <span className="item-opcoes">
                  <button
                    type="button"
                    className={estado === 'sim' ? 'ativo' : ''}
                    onClick={() => marcar(item, estado === 'sim' ? '' : 'sim')}
                    aria-pressed={estado === 'sim'}
                  >
                    ✓ Incluso
                  </button>
                  <button
                    type="button"
                    className={estado === 'nao' ? 'ativo' : ''}
                    onClick={() => marcar(item, estado === 'nao' ? '' : 'nao')}
                    aria-pressed={estado === 'nao'}
                  >
                    ✕ Não incluso
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
        <div className="novo-item">
          <input
            value={novoItem}
            onChange={(e) => setNovoItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                adicionarItem();
              }
            }}
            placeholder="Outro item, ex.: Wi-Fi, Piscina, Portaria"
            maxLength={40}
            aria-label="Novo item"
          />
          <button type="button" className="botao botao-secundario" onClick={adicionarItem}>
            + Adicionar
          </button>
        </div>

        <h3 className="secao-formulario">Descrição</h3>
        <Campo rotulo="Detalhes do imóvel" largo>
          <textarea rows="3" value={v.descricao} onChange={muda('descricao')} placeholder="Ex.: Casa com quintal, cozinha planejada…" />
        </Campo>

        <div className="modal-acoes">
          {imovel && (
            <>
              <button type="button" className="botao botao-perigo-leve" onClick={excluir}>
                Excluir imóvel
              </button>
              <span className="espaco" />
            </>
          )}
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="botao botao-primario" disabled={salvando}>
            {salvando ? 'Salvando…' : imovel ? 'Salvar alterações' : 'Cadastrar imóvel'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
