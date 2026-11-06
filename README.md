# Recceptor · Gestão de aluguéis

<img src="public/icone.png" alt="Logo Recceptor" width="96" />

Aplicação web para administrar imóveis alugados: cadastro de inquilinos com documentos, contratos, cobrança com multa e juros, reajuste anual pelo IGP-M ou IPCA e um quadro Kanban para as solicitações dos inquilinos.

Projeto acadêmico desenvolvido por **Lucas Dellai**.

**Acesse:** `https://SEU-LINK.vercel.app` *(trocar pelo link do Vercel)*

O acesso é restrito a usuários cadastrados. A demonstração usa apenas dados fictícios.

---

## ✅ Requisitos da atividade

| Requisito | Onde está no projeto |
|---|---|
| Aplicação React JS | Pasta `src/` (React 18 + Vite) |
| Hospedada no Vercel via GitHub | Deploy automático a cada alteração no repositório |
| CRUD no back-end | Pasta `api/`: funções serverless do Vercel |
| Tabela com pelo menos 4 campos | 6 tabelas; `contratos` tem 13 campos e `inquilinos` tem 10 |
| Create | Botões **+ Novo inquilino**, **+ Novo contrato**, **Registrar pagamento**, **+ Nova solicitação** e **Anexar** documento |
| Read | Painel, lista de inquilinos, ficha do inquilino e quadro de solicitações |
| Update | Botões **Editar**, **Corrigir** pagamento, **Reajuste** e mover cartões no Kanban |
| Delete | Botões **Excluir** (sempre com confirmação) |
| Interface gráfica | Formulários, filtros, busca, alertas, cores por status, Kanban e layout para celular |

## 📚 Explicando o trabalho

| O que foi estudado na disciplina | Onde foi usado neste trabalho |
|---|---|
| HTML, CSS, JS (condições, repetição, arrays) | `src/styles.css`, `src/utils.js` (cálculos com `map`, `filter`, `reduce`) |
| React.js | Pasta `src/` (componentes, estado com `useState`, efeitos com `useEffect`) |
| Node.js e API REST | Pasta `api/`: funções Node.js com GET, POST, PUT e DELETE |
| Orientação a objetos com JS | Classe `ErroApi extends Error` em `api/_lib/supabase.js` |
| Banco de dados (Insert, Select, Where, Update, Delete) | Scripts em `supabase/` e operações em `api/_lib/crud.js` |
| Programação em camadas | Apresentação (React) → Regras de negócio e validação (API Node) → Dados (PostgreSQL) |
| Sessões | Login com Supabase Auth: o token da sessão vai em cada requisição e é conferido no back-end |
| Formulários, eventos, mensagens de erro e caixas de mensagem | Formulários com validação, avisos de sucesso/erro e janela de confirmação ao excluir |
| Upload de arquivos | Documentos dos inquilinos e foto de perfil (Supabase Storage) |
| Internacionalização | Moeda, datas e números no padrão brasileiro (`Intl`, `pt-BR`) |
| Versionamento com GitHub e hospedagem | Repositório público no GitHub com deploy automático no Vercel |

### Como cada ação do CRUD vira SQL

| Ação no app | Rota | SQL equivalente |
|---|---|---|
| Listar contratos | `GET /api/contratos` | `SELECT * FROM contratos ORDER BY data_fim` |
| Criar contrato | `POST /api/contratos` | `INSERT INTO contratos (...) VALUES (...)` |
| Editar contrato | `PUT /api/contratos?id=1` | `UPDATE contratos SET ... WHERE id = 1` |
| Excluir contrato | `DELETE /api/contratos?id=1` | `DELETE FROM contratos WHERE id = 1` |

## ✨ Funcionalidades

- **Login único para anfitrião e inquilino**: o sistema reconhece o tipo de acesso e abre a tela certa.
- **Início**: saudação, situação geral ("Tudo em dia" ou pontos de atenção), números do mês, gráficos de pagamentos e de aluguel por imóvel, próximos recebimentos e resumo das solicitações.
- **Pontos de atenção**: aluguel atrasado, contrato perto do fim, reajuste disponível, solicitação com prazo perto ou vencido e solicitação parada sem evolução.
- **Meu perfil**: nome, telefone e foto do usuário.
- **Portal do Inquilino**: o inquilino vê só o próprio contrato, o valor a pagar (com multa e juros, se atrasado), os documentos e as solicitações, e pode abrir novos chamados. O anfitrião cria o acesso pela ficha do inquilino.
- **Celular**: layout adaptado com barra de navegação inferior.
- **Pagamentos**: você registra quando o inquilino paga (data, valor e forma). O status **Em dia**, **Pendente** ou **Atrasado** é calculado sozinho, e cada contrato tem o histórico mês a mês.
- **Multa e juros**: quando o pagamento está atrasado, o app calcula
  `total = aluguel + multa (%) + juros ao mês (%) × dias de atraso ÷ 30`.
- **Reajuste**: busca o acumulado de 12 meses do **IGP-M** ou do **IPCA** na API do Banco Central, ou aceita um percentual digitado.
- **Inquilinos**: ficha completa, comprometimento da renda com o aluguel e documentos anexados (RG, CNH, comprovantes) em área privada.
- **Solicitações (Kanban)**: colunas Aberta, Em análise, Em andamento e Concluída. Arraste os cartões ou use as setas.

## 🧱 Tecnologias

- **Front-end:** React 18 + Vite
- **Back-end:** Vercel Serverless Functions (Node.js)
- **Banco de dados, login e arquivos:** Supabase (PostgreSQL, Auth e Storage)
- **Hospedagem:** Vercel, integrado ao GitHub

## 🗂️ Arquitetura

```
Navegador (React)
   │  login e envio de arquivos ──────────────► Supabase Auth / Storage
   │
   └─ fetch /api/... (com o token do login)
          │
          ▼
   Vercel Functions (pasta api/)  ── CRUD ──► Supabase PostgreSQL
                                   (regras de segurança RLS: só usuário logado)
```

### Rotas da API

| Método | Rota | Ação |
|---|---|---|
| GET | `/api/contratos` | Lista todos os contratos |
| POST | `/api/contratos` | Cria um contrato |
| PUT | `/api/contratos?id=1` | Atualiza o contrato 1 |
| DELETE | `/api/contratos?id=1` | Remove o contrato 1 |

O mesmo padrão vale para `/api/inquilinos`, `/api/pagamentos`, `/api/solicitacoes` e `/api/documentos`.
`/api/indices?indice=IGP-M` consulta o índice no Banco Central.
`/api/perfil` lê e atualiza o perfil de quem está logado.
`/api/acessos` cria, altera a senha e remove o acesso do inquilino ao portal (só anfitrião).

### Banco de dados

```
perfis (login) ──? inquilinos (1) ──< contratos (1) ──< solicitacoes
                                              (1) ──< pagamentos
                       │
                       └──< documentos (arquivos no Storage)
```

Scripts, na ordem:
1. `supabase/01-criar-tabelas.sql`: tabelas principais
2. `supabase/02-dados-exemplo.sql`: dados fictícios
3. `supabase/03-perfis-e-portal.sql`: perfis, fotos, prazos das solicitações e regras do Portal do Inquilino
4. `supabase/04-pagamentos.sql`: registro de pagamentos (e pagamentos de exemplo)

## 📁 Estrutura de pastas

```
api/                    Back-end (CRUD)
  _lib/crud.js          Modelo das 4 ações do CRUD
  _lib/supabase.js      Conexão, login e tratamento de erros
  inquilinos.js
  contratos.js
  solicitacoes.js
  documentos.js
  pagamentos.js
  indices.js            IGP-M e IPCA do Banco Central
  perfil.js             Perfil de quem está logado
  acessos.js            Acesso do inquilino ao portal
src/                    Front-end (React)
  App.jsx               Login, menu e escolha entre anfitrião e inquilino
  config.js             Nome e logo do app (troque aqui)
  api.js                Chamadas para a API
  utils.js              Cálculos (multa, juros, reajuste, vencimentos)
  components/           Telas e formulários
supabase/               Scripts SQL do banco
```

## 🚀 Como publicar

1. Criar um projeto no Supabase e rodar `supabase/01-criar-tabelas.sql` no SQL Editor.
2. Em Authentication, criar o usuário e desligar o cadastro público.
3. Importar este repositório no Vercel.
4. Em **Settings → Environment Variables**, cadastrar:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (chave secreta, usada só no back-end para criar acessos de inquilinos)
5. Fazer o deploy.

## 🔒 Segurança

- Nenhuma chave fica no código. Elas são configuradas no Vercel.
- O banco usa **Row Level Security**: sem login, nada é lido ou alterado. O anfitrião vê tudo; o inquilino só os próprios dados.
- A chave secreta do Supabase fica só no back-end (Vercel) e nunca chega ao navegador.
- Os documentos ficam em uma pasta **privada** e abrem por um link temporário de 2 minutos.
- A versão de demonstração usa apenas **dados fictícios**.
