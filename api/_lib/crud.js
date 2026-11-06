// Monta as 4 ações do CRUD para uma tabela:
//   GET    /api/tabela          -> Listar (Read)
//   GET    /api/tabela?id=1     -> Buscar um registro
//   POST   /api/tabela          -> Criar (Create)
//   PUT    /api/tabela?id=1     -> Atualizar (Update)
//   DELETE /api/tabela?id=1     -> Remover (Delete)
//
// O anfitrião pode tudo. O inquilino só pode o que estiver em "inquilinoPode",
// e o banco (regras RLS) ainda garante que ele só enxerga os próprios dados.
import {
  ErroApi,
  criarCliente,
  exigirUsuario,
  obterPerfil,
  traduzirErroBanco,
  limparCampos,
  rota,
} from './supabase.js';

export function criarCrud({
  tabela,
  campos,
  selecionar = '*',
  ordenar,
  filtros = [],
  validar,
  antesDeExcluir,
  inquilinoPode = [],
  prepararParaInquilino,
}) {
  return rota(async (req, res) => {
    const supabase = criarCliente(req);
    const usuario = await exigirUsuario(supabase, req);
    const perfil = await obterPerfil(supabase, usuario);
    const ehInquilino = perfil.papel !== 'anfitriao';

    if (ehInquilino && !inquilinoPode.includes(req.method)) {
      throw new ErroApi(403, 'Apenas o anfitrião pode fazer isso.');
    }

    const id = req.query.id;

    switch (req.method) {
      // READ: lista todos (ou um, se vier o id)
      case 'GET': {
        let consulta = supabase.from(tabela).select(selecionar);
        for (const filtro of filtros) {
          if (req.query[filtro]) consulta = consulta.eq(filtro, req.query[filtro]);
        }
        if (id) consulta = consulta.eq('id', id);
        if (ordenar) consulta = consulta.order(ordenar.coluna, { ascending: ordenar.crescente ?? true });
        const { data, error } = await consulta;
        if (error) throw traduzirErroBanco(error);
        if (id && !data.length) throw new ErroApi(404, 'Registro não encontrado.');
        return res.status(200).json(id ? data[0] : data);
      }

      // CREATE: cria um novo registro
      case 'POST': {
        let dados = limparCampos(req.body, campos);
        if (ehInquilino && prepararParaInquilino) dados = prepararParaInquilino(dados);
        if (validar) validar(dados, 'criar');
        const { data, error } = await supabase.from(tabela).insert(dados).select(selecionar).single();
        if (error) throw traduzirErroBanco(error);
        return res.status(201).json(data);
      }

      // UPDATE: altera um registro existente
      case 'PUT': {
        if (!id) throw new ErroApi(400, 'Informe o id do registro.');
        const dados = limparCampos(req.body, campos);
        if (!Object.keys(dados).length) throw new ErroApi(400, 'Nada para atualizar.');
        if (validar) validar(dados, 'atualizar');
        const { data, error } = await supabase
          .from(tabela)
          .update(dados)
          .eq('id', id)
          .select(selecionar)
          .single();
        if (error) throw traduzirErroBanco(error);
        return res.status(200).json(data);
      }

      // DELETE: remove um registro
      case 'DELETE': {
        if (!id) throw new ErroApi(400, 'Informe o id do registro.');
        if (antesDeExcluir) await antesDeExcluir(supabase, id);
        const { error, count } = await supabase.from(tabela).delete({ count: 'exact' }).eq('id', id);
        if (error) throw traduzirErroBanco(error);
        if (count === 0) throw new ErroApi(404, 'Registro não encontrado.');
        return res.status(200).json({ ok: true });
      }

      default:
        res.setHeader('Allow', 'GET, POST, PUT, DELETE');
        throw new ErroApi(405, 'Método não permitido.');
    }
  });
}
