// Documentos do inquilino: enviar, abrir e excluir arquivos (RG, CNH, comprovantes…).
// O arquivo vai para o Supabase Storage (pasta privada) e as informações
// dele são gravadas na tabela "documentos" pela nossa API.
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { supabase } from '../supabaseClient';
import { Carregando, useUI } from './UI';
import { TIPOS_DOCUMENTO, dataBR, semAcento } from '../utils';

const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5 MB
const TIPOS_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png'];
const OUTRO = '__outro__';

// somenteLeitura: usado no Portal do Inquilino (só ver e abrir)
// camposAnexo: anexos que o anfitrião criou (ex.: "Ficha criminal"); por padrão só ele vê
export default function Documentos({ inquilinoId, somenteLeitura, camposAnexo = [] }) {
  const { avisar, confirmar } = useUI();
  const [documentos, setDocumentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [tipo, setTipo] = useState('RG');
  const [tipoLivre, setTipoLivre] = useState('');
  const [visivel, setVisivel] = useState(true);
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const entrada = useRef(null);

  async function carregar() {
    try {
      setDocumentos(await api.listar('documentos', inquilinoId ? { inquilino_id: inquilinoId } : {}));
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquilinoId]);

  function escolher(e) {
    const escolhido = e.target.files?.[0];
    if (!escolhido) return setArquivo(null);
    if (!TIPOS_ACEITOS.includes(escolhido.type)) {
      avisar('Envie apenas PDF, JPG ou PNG.', 'erro');
      e.target.value = '';
      return setArquivo(null);
    }
    if (escolhido.size > TAMANHO_MAXIMO) {
      avisar('O arquivo precisa ter no máximo 5 MB.', 'erro');
      e.target.value = '';
      return setArquivo(null);
    }
    setArquivo(escolhido);
  }

  // CREATE: envia o arquivo e grava o registro
  async function enviar(e) {
    e.preventDefault();
    if (!arquivo) return avisar('Escolha um arquivo.', 'erro');
    const tipoFinal = tipo === OUTRO ? tipoLivre.trim() : tipo;
    if (!tipoFinal) return avisar('Escreva o nome do documento.', 'erro');
    setEnviando(true);
    const nomeSeguro = semAcento(arquivo.name).replace(/[^a-z0-9._-]/g, '_');
    const caminho = `${inquilinoId}/${Date.now()}-${nomeSeguro}`;
    try {
      const { error } = await supabase.storage.from('documentos').upload(caminho, arquivo, { contentType: arquivo.type });
      if (error) throw new Error('Não foi possível enviar o arquivo.');
      try {
        await api.criar('documentos', {
          inquilino_id: inquilinoId,
          tipo: tipoFinal,
          nome_arquivo: arquivo.name,
          caminho,
          visivel_inquilino: visivel,
        });
      } catch (erro) {
        await supabase.storage.from('documentos').remove([caminho]);
        throw erro;
      }
      avisar('Documento anexado.');
      setArquivo(null);
      if (entrada.current) entrada.current.value = '';
      carregar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      setEnviando(false);
    }
  }

  // Escolher o tipo: os padrões ficam visíveis ao inquilino; os personalizados, só para o anfitrião
  function trocarTipo(novo) {
    setTipo(novo);
    setVisivel(TIPOS_DOCUMENTO.includes(novo) && novo !== 'Outro');
  }

  // Atalho dos anexos pendentes: já escolhe o tipo e abre o seletor de arquivo
  function enviarPendente(nome) {
    trocarTipo(nome);
    entrada.current?.click();
  }

  const nomesAnexo = camposAnexo.map((c) => c.nome);
  const pendentes = nomesAnexo.filter((nome) => !documentos.some((d) => d.tipo === nome));

  // Abre o arquivo com um link temporário (válido por 2 minutos)
  async function abrirArquivo(documento) {
    const janela = window.open('', '_blank');
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(documento.caminho, 120);
    if (error || !data?.signedUrl) {
      janela?.close();
      return avisar('Não foi possível abrir o arquivo.', 'erro');
    }
    if (janela) janela.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  }

  // DELETE
  async function excluir(documento) {
    const ok = await confirmar('Excluir documento?', `"${documento.nome_arquivo}" será apagado definitivamente.`);
    if (!ok) return;
    try {
      await api.excluir('documentos', documento.id);
      avisar('Documento excluído.');
      carregar();
    } catch (erro) {
      avisar(erro.message, 'erro');
    }
  }

  return (
    <section className="cartao">
      <h2>{somenteLeitura ? 'Meus documentos' : 'Documentos'}</h2>

      {!somenteLeitura && (
      <>
      <form className="envio-documento" onSubmit={enviar}>
        <select value={tipo} onChange={(e) => trocarTipo(e.target.value)} aria-label="Tipo do documento">
          {TIPOS_DOCUMENTO.filter((t) => t !== 'Outro').map((t) => (
            <option key={t}>{t}</option>
          ))}
          {nomesAnexo.length > 0 && (
            <optgroup label="Seus campos">
              {nomesAnexo.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </optgroup>
          )}
          <option value={OUTRO}>Outro (escrever o nome)…</option>
        </select>
        {tipo === OUTRO && (
          <input
            value={tipoLivre}
            onChange={(e) => setTipoLivre(e.target.value)}
            placeholder="Ex.: Score Serasa"
            maxLength={60}
            aria-label="Nome do documento"
          />
        )}
        <label className="escolher-arquivo">
          <input ref={entrada} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={escolher} />
          <span>{arquivo ? arquivo.name : 'Escolher arquivo…'}</span>
        </label>
        <button className="botao botao-primario" disabled={enviando || !arquivo}>
          {enviando ? 'Enviando…' : 'Anexar'}
        </button>
      </form>
      <label className="caixa-marcar caixa-marcar-pequena">
        <input type="checkbox" checked={visivel} onChange={(e) => setVisivel(e.target.checked)} />
        <span>O inquilino pode ver este documento no portal</span>
      </label>
      <p className="texto-suave pequeno">PDF, JPG ou PNG de até 5 MB. Os arquivos ficam em uma área privada.</p>
      {pendentes.length > 0 && (
        <ul className="anexos-pendentes">
          {pendentes.map((nome) => (
            <li key={nome}>
              <span>
                <strong>{nome}</strong>
                <small className="sub">Ainda não enviado</small>
              </span>
              <button type="button" className="botao botao-pequeno botao-secundario" onClick={() => enviarPendente(nome)}>
                Enviar
              </button>
            </li>
          ))}
        </ul>
      )}
      </>
      )}

      {carregando ? (
        <Carregando />
      ) : !documentos.length ? (
        <p className="texto-suave">Nenhum documento anexado.</p>
      ) : (
        <ul className="lista-documentos">
          {documentos.map((d) => (
            <li key={d.id}>
              <span className="documento-icone">{d.nome_arquivo.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMG'}</span>
              <div>
                <strong>
                  {d.tipo}
                  {!somenteLeitura && d.visivel_inquilino === false && <span className="so-voce">Só você vê</span>}
                </strong>
                <span className="sub">
                  {d.nome_arquivo} · {dataBR(d.enviado_em)}
                </span>
              </div>
              <div className="botoes">
                <button className="botao botao-pequeno botao-secundario" onClick={() => abrirArquivo(d)}>
                  Abrir
                </button>
                {!somenteLeitura && (
                  <button className="botao botao-pequeno botao-perigo-leve" onClick={() => excluir(d)}>
                    Excluir
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
