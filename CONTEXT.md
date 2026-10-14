# CONTEXT.md — Foqui Tech

> Arquivo único de estado do projeto. Sobrescrito ao final de cada prompt com o Claude.
> Última atualização: 2026-10-13

---

## Visão geral

Painel local de produção e compras da **Foqui Sanduíches**. Roda 100% em Node.js sem dependências externas (`node:sqlite`, `node:test`, `node:http`). Acesso em `http://localhost:3000`.

---

## Comandos principais

| Comando | O que faz |
|---|---|
| `npm run setup` | Cria/recria o banco com seed completo |
| `npm start` | Sobe o servidor em localhost:3000 |
| `npm run dev` | Servidor com hot-reload (`--watch`) |
| `npm test` | Roda os 33 testes (deve ficar tudo verde) |
| `npm run auditar` | Confere rendimentos das receitas |
| `npm run reset` | Apaga e recria o banco do zero |

---

## Estrutura de arquivos

```
foqui-tech/
├── CLAUDE.md                    # Regras para o Claude Code
├── CONTEXT.md                   # Este arquivo (estado atual)
├── README.md
├── package.json                 # v0.2.0, type: module, Node >=22.13
│
├── data/
│   ├── seed.js                  # Insumos, preparos, medidas (fonte de verdade)
│   ├── lanches.js               # Composição dos lanches
│   ├── vendas.js                # Relatório de vendas ago/2026 (mapeado do CHEFWEB)
│   └── foqui.db                 # Banco SQLite gerado pelo setup
│
├── src/
│   ├── schema.sql               # DDL: itens, receitas, lanches, estoque_movimentos, compras_checks
│   ├── seed.js                  # Loader do seed para o banco
│   ├── db.js                    # Wrapper do node:sqlite
│   ├── engine.js                # Cálculos puros (demanda → lotes → compras)
│   ├── api.js                   # Rotas HTTP (REST sobre o engine)
│   └── server.js                # Ponto de entrada HTTP
│
├── public/
│   ├── index.html               # Shell da SPA
│   ├── app.js                   # Front ES module, helper h() para DOM (sem innerHTML com dados)
│   └── style.css
│
├── scripts/
│   ├── setup.js                 # Cria banco + seed
│   └── auditar.js               # Auditoria de rendimentos
│
├── test/
│   ├── engine.test.js           # Testes das funções puras do engine
│   ├── api.test.js              # Testes das rotas HTTP
│   └── montagem.test.js         # Testes de composição de lanches
│
└── docs/
    ├── LOGICA.md                # Conceitos, regras de cálculo e modelo de dados
    ├── PERGUNTAS_EM_ABERTO.md   # Pendências para confirmar com a cozinha
    └── fontes/                  # PDFs, planilha e docx de origem dos dados
```

---

## Regras invioláveis do projeto

- **Zero dependências npm.** Nunca adicionar pacote sem necessidade clara.
- **Cálculo só em `src/engine.js`** (funções puras). A API não recalcula nada.
- **Estoque = soma de `estoque_movimentos`.** Nunca gravar estoque direto.
- **Nunca inventar número:** marcar `estimado` ou `pendente` e documentar.
- **Mudou regra de cálculo?** Escrever/ajustar teste em `test/engine.test.js` primeiro.
- **Seed só vale em banco novo** (`npm run reset`). Dados do cliente: sempre pelo painel.
- **Front sem build:** `public/app.js` é ES module direto. Nunca usar `innerHTML` com dados do usuário.

---

## Domínio resumido

- **Insumo:** o que se compra (matéria-prima).
- **Preparo:** o que a cozinha fabrica a partir de outros itens (tem receita: ingredientes por lote + rendimento).
- **Sub-receita:** preparo que usa outro preparo como ingrediente.
- **Lanche:** lista de itens com quantidade por unidade vendida.
- **Medida:** (concha, fatia, tira) — cada uma vale X na unidade do item; corrigir a medida atualiza tudo.
- **Compra:** sempre em kg/L, arredondado para cima em 0,1; embalagem inteira quando aplicável.
- **Fluxo:** Meta de lanches → demanda → lotes (pais antes filhos, soma antes de arredondar) → compras (÷ aproveitamento − estoque).

---

## Estado do banco (setup 2026-10-13)

| Tabela | Quantidade |
|---|---|
| Insumos | 77 |
| Preparos | 38 |
| Receitas | 32 |
| Medidas | 26 |
| Lanches | 35 |

Vendas de agosto/2026 incluídas no seed.

---

## Pendências conhecidas (resumo)

Ver `docs/PERGUNTAS_EM_ABERTO.md` para a lista completa. Destaques:

- Manteiga para pincelar (11 salgados) — hoje entra como 0
- Açúcar do maçarico (Rabanada Brûlée) — hoje 0
- Fatias por pão: Foqui G (suposto 20) e Foqui P (suposto 16) — não confirmados
- Conchas estimadas ainda sem pesagem real (repolho, cenoura, abacaxi etc.)
- Sem receita cadastrada (produção manual): Foqui P, Fatias de Foqui, Levain, calda e torta de pistache, brigadeiro com bacon
- Itens fora da conta: Foqui Box, Big Box, batata doce, mandioca, bebidas, milkshakes

---

## Histórico de sessões

| Data | O que foi feito |
|---|---|
| 2026-10-13 | Projeto extraído e inicializado. Banco criado via `npm run setup`. Servidor rodando em localhost:3000. CONTEXT.md criado. |
