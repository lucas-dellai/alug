# Alug · Gestão de aluguéis

<img src="public/alug-logo-principal.svg" alt="Logo Alug" width="160" />

Sistema web para administrar imóveis alugados: imóveis, inquilinos, contratos, pagamentos com multa e juros, reajuste anual pelo IGP-M ou IPCA, solicitações dos inquilinos e um portal próprio para o inquilino.

**Acesse:** [alug-app.vercel.app](https://alug-app.vercel.app)

Desenvolvido por **Lucas Dellai**.

---

## Funcionalidades

**Área do anfitrião**
- **Início:** pontos de atenção do dia (aluguel atrasado, contrato vencendo, reajuste disponível, solicitação parada), números do mês e próximos recebimentos.
- **Imóveis:** cadastro com foto, finalidade (residencial, comercial ou outra), especificações, o que está incluso no aluguel e regras da casa.
- **Inquilinos:** ficha completa, documentos em área privada, campos personalizados, comunicados e advertências.
- **Contratos:** duração de 3, 6, 12, 24 meses ou personalizada, parcelas (ex.: 7/12), renovação e reajuste.
- **Pagamentos:** registro mês a mês, cálculo automático de multa e juros e conferência dos pagamentos informados pelo inquilino.
- **Solicitações:** quadro Kanban com as etapas Aberta, Em análise, Em andamento e Concluída.

**Portal do inquilino**
- Valor do mês, vencimento, chave Pix e botão para informar o pagamento com comprovante.
- Contrato, regras do imóvel e histórico de pagamentos.
- Abertura e acompanhamento de solicitações.
- Avisos do anfitrião, com resposta de aceite ou contestação.

**Várias contas:** cada anfitrião vê apenas os próprios imóveis, inquilinos e contratos.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Front-end | React 18 + Vite |
| Back-end | Funções serverless em Node.js (Vercel) |
| Banco de dados | PostgreSQL (Supabase) com Row Level Security |
| Login e arquivos | Supabase Auth e Supabase Storage |
| Índices de reajuste | API pública do Banco Central (SGS) |
| Hospedagem | Vercel, com deploy contínuo a partir do GitHub |

## Arquitetura

```
Navegador (React)
   │
   └─ fetch /api/... (com o token do login)
          │
          ▼
   Funções Node.js na Vercel (pasta api/)
   confere login, papel e campos
          │                         │
          ▼                         ▼
   Supabase PostgreSQL       API do Banco Central
   (RLS: cada um vê só       (IGP-M e IPCA)
    os próprios dados)
```

### Rotas da API

| Método | Rota | Ação |
|---|---|---|
| GET | `/api/inquilinos` | Lista os inquilinos |
| POST | `/api/inquilinos` | Cria um inquilino |
| PUT | `/api/inquilinos?id=1` | Atualiza o inquilino 1 |
| DELETE | `/api/inquilinos?id=1` | Remove o inquilino 1 |

O mesmo padrão vale para `contratos`, `pagamentos`, `solicitacoes`, `documentos`, `imoveis`, `custos`, `comunicados` e `advertencias`.
`/api/indices?indice=IGP-M` consulta o acumulado de 12 meses no Banco Central.

## Estrutura de pastas

```
api/                    Back-end (funções serverless)
  _lib/crud.js          Gerador das operações de cadastro, leitura, edição e exclusão
  _lib/supabase.js      Conexão, login e tratamento de erros
  _lib/recursos/        Imóveis, custos, comunicados, advertências...
  [recurso].js          Rota dinâmica que direciona para os recursos acima
  inquilinos.js, contratos.js, pagamentos.js, solicitacoes.js, documentos.js
  indices.js            IGP-M e IPCA do Banco Central
src/                    Front-end (React)
  App.jsx               Login e escolha entre área do anfitrião e portal do inquilino
  api.js                Chamadas para a API
  utils.js              Cálculos (multa, juros, parcelas, vencimentos)
  styles.css            Identidade visual em variáveis CSS
  components/           Telas e formulários
supabase/               Scripts SQL do banco, em ordem (01 a 15)
public/                 Logos e ícones
```

## Segurança

- **Row Level Security:** cada registro tem um dono (`anfitriao_id`) e o banco só devolve as linhas de quem está logado. O inquilino enxerga apenas o próprio contrato.
- **Permissão por coluna:** o inquilino pode responder um comunicado, mas não alterar o texto do anfitrião.
- **Chaves:** nenhuma chave fica no código. A chave administrativa do Supabase fica só nas variáveis de ambiente da Vercel e nunca chega ao navegador.
- **Arquivos:** documentos e comprovantes ficam em pastas privadas e abrem por um link temporário de 2 minutos.
