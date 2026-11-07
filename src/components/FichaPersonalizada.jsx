// Ficha do inquilino do jeito do anfitrião:
//  - escolher quais seções aparecem
//  - criar campos próprios (ex.: "Score Serasa", "Ficha criminal" como anexo)
import { useEffect, useState } from 'react';
import { api } from '../api';
import { Campo, Carregando, Modal, useUI } from './UI';
import { SECOES_FICHA, TIPOS_CAMPO, dataBR } from '../utils';

// Engrenagem da ficha: seções visíveis + campos personalizados
export function ModalConfigFicha({ regras, aoFechar, aoSalvar }) {
  const { avisar, confirmar } = useUI();
  const [ocultas, setOcultas] = useState(regras?.ficha_ocultas || []);
  const [campos, setCampos] = useState(regras?.campos_personalizados || []);
  const [novo, setNovo] = useState({ nome: '', tipo: 'texto' });
  const [salvando, setSalvando] = useState(false);

  function alternar(secao) {
    setOcultas((lista) => (lista.includes(secao) ? lista.filter((s) => s !== secao) : [...lista, secao]));
  }

  function adicionar(e) {
    e?.preventDefault();
    const nome = novo.nome.trim();
    if (!nome) return avisar('Dê um nome ao campo.', 'erro');
    if (campos.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) return avisar('Já existe um campo com esse nome.', 'erro');
    setCampos((lista) => [...lista, { id: `c${Date.now().toString(36)}`, nome, tipo: novo.tipo }]);
    setNovo({ nome: '', tipo: novo.tipo });
  }

  async function remover(campo) {
    const ok = await confirmar(
      'Remover campo?',
      `"${campo.nome}" some de todas as fichas. ${campo.tipo === 'anexo' ? 'Os arquivos já enviados continuam em Documentos.' : 'Os valores já preenchidos deixam de aparecer.'}`,
      'Remover',
    );
    if (ok) setCampos((lista) => lista.filter((c) => c.id !== campo.id));
  }

  async function salvar() {
    setSalvando(true);
    try {
      await api.salvarFicha({ ficha_ocultas: ocultas, campos_personalizados: campos });
      avisar('Ficha personalizada.');
      aoSalvar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  const nomeTipo = (id) => TIPOS_CAMPO.find((t) => t.id === id)?.rotulo || id;

  return (
    <Modal titulo="Personalizar ficha do inquilino" subtitulo="Vale para a ficha de todos os inquilinos" aoFechar={aoFechar}>
      <h3 className="secao-formulario">O que aparece na ficha</h3>
      <div className="lista-marcar">
        {SECOES_FICHA.map((s) => (
          <label key={s.id} className="caixa-marcar">
            <input type="checkbox" checked={!ocultas.includes(s.id)} onChange={() => alternar(s.id)} />
            <span>{s.rotulo}</span>
          </label>
        ))}
      </div>

      <h3 className="secao-formulario">Seus campos</h3>
      <p className="texto-suave pequeno">
        Ex.: "Score Serasa" (número), "Ficha criminal" (anexo), "Tem animal?" (sim ou não). Só você vê esses campos.
      </p>
      {campos.length > 0 && (
        <ul className="lista-campos">
          {campos.map((c) => (
            <li key={c.id}>
              <span>
                <strong>{c.nome}</strong>
                <small className="sub">{nomeTipo(c.tipo)}</small>
              </span>
              <button type="button" className="botao botao-pequeno botao-perigo-leve" onClick={() => remover(c)}>
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="novo-campo" onSubmit={adicionar}>
        <input
          value={novo.nome}
          onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
          placeholder="Nome do campo"
          maxLength={40}
          aria-label="Nome do novo campo"
        />
        <select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })} aria-label="Tipo do novo campo">
          {TIPOS_CAMPO.map((t) => (
            <option key={t.id} value={t.id}>
              {t.rotulo}
            </option>
          ))}
        </select>
        <button className="botao botao-secundario">+ Adicionar</button>
      </form>

      <div className="modal-acoes">
        <button type="button" className="botao botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button type="button" className="botao botao-primario" onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </Modal>
  );
}

// Quadro "Informações adicionais" com os campos que o anfitrião criou (exceto anexos, que ficam em Documentos)
export function InformacoesAdicionais({ inquilino, campos, aoConfigurar }) {
  const { avisar } = useUI();
  const [valores, setValores] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    if (!campos.length) return setCarregando(false);
    api
      .verExtras(inquilino.id)
      .then((r) => setValores(r.valores || {}))
      .catch((erro) => avisar(erro.message, 'erro'))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquilino.id, campos.length]);

  const mostrar = (campo) => {
    const v = valores[campo.id];
    if (v === undefined || v === null || v === '') return null;
    if (campo.tipo === 'sim_nao') return v === true || v === 'true' ? 'Sim' : 'Não';
    if (campo.tipo === 'data') return dataBR(v);
    return String(v);
  };

  return (
    <section className="cartao">
      <div className="cartao-topo">
        <h2>Informações adicionais</h2>
        {campos.length > 0 && (
          <button className="botao botao-pequeno botao-secundario" onClick={() => setEditando(true)}>
            Editar
          </button>
        )}
      </div>
      {!campos.length ? (
        <p className="texto-suave">
          Crie seus próprios campos, como "Score Serasa" ou "Tem animal?".{' '}
          <button className="link" onClick={aoConfigurar}>
            Criar campos ›
          </button>
        </p>
      ) : carregando ? (
        <Carregando />
      ) : (
        <dl className="dados">
          {campos.map((c) => (
            <div key={c.id}>
              <dt>{c.nome}</dt>
              <dd>{mostrar(c) ?? <span className="texto-suave">Não informado</span>}</dd>
            </div>
          ))}
        </dl>
      )}
      {editando && (
        <ModalEditarExtras
          inquilino={inquilino}
          campos={campos}
          valores={valores}
          aoFechar={() => setEditando(false)}
          aoSalvar={(novos) => {
            setValores(novos);
            setEditando(false);
          }}
        />
      )}
    </section>
  );
}

function ModalEditarExtras({ inquilino, campos, valores, aoFechar, aoSalvar }) {
  const { avisar } = useUI();
  const [v, setV] = useState(() => ({ ...valores }));
  const [salvando, setSalvando] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      const r = await api.salvarExtras(inquilino.id, v);
      avisar('Informações salvas.');
      aoSalvar(r.valores);
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Informações adicionais" subtitulo={inquilino.nome} aoFechar={aoFechar} pequeno>
      <form onSubmit={salvar}>
        {campos.map((c) => (
          <Campo key={c.id} rotulo={c.nome}>
            {c.tipo === 'sim_nao' ? (
              <select
                value={v[c.id] === true || v[c.id] === 'true' ? 'sim' : v[c.id] === false || v[c.id] === 'false' ? 'nao' : ''}
                onChange={(e) => setV({ ...v, [c.id]: e.target.value === '' ? null : e.target.value === 'sim' })}
              >
                <option value="">Não informado</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            ) : (
              <input
                type={c.tipo === 'numero' ? 'number' : c.tipo === 'data' ? 'date' : 'text'}
                step={c.tipo === 'numero' ? 'any' : undefined}
                value={v[c.id] ?? ''}
                maxLength={500}
                onChange={(e) => setV({ ...v, [c.id]: e.target.value })}
              />
            )}
          </Campo>
        ))}
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
