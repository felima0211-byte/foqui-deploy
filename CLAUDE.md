# Foqui Tech: guia para o Claude Code

Painel local de produção e compras da Foqui Sanduíches. Felipe (não desenvolvedor) dirige o trabalho; explique em português simples e mostre o resultado, não o código.

## Rodar

```bash
npm run setup && npm start   # http://localhost:3000
npm test                     # 33 testes, deve ficar tudo verde antes de entregar
npm run auditar              # confere rendimentos das receitas
```

## Regras do projeto

- **Zero dependências npm.** Node >= 22.13 (`node:sqlite`, `node:test`, `node:http`). Não adicione pacotes sem necessidade clara.
- Front sem build: `public/app.js` (módulo ES, helper `h()` para montar DOM; nunca use innerHTML com dados do usuário).
- O cálculo vive só em `src/engine.js` (funções puras sobre o modelo em memória). A API não recalcula nada por conta própria.
- Cada item tem uma unidade (g, ml, un). Conversão só por `medidas` (concha -> g) de cada item; compra em kg/L via `sugerirCompra`.
- Confiança (confirmado/estimado/pendente) em medidas e linhas de lanche: nunca invente número; marque estimado/pendente e documente.
- Estoque = soma de `estoque_movimentos`. Nunca grave estoque direto; insira um movimento.
- Mudou regra de cálculo? Escreva/ajuste teste em `test/engine.test.js` primeiro.
- Dados de origem: `data/seed.js` (itens, receitas, medidas), `data/lanches.js` (montagem), `data/vendas.js` (relatório). Banco de versão antiga: `npm run reset`. Alterar o seed só vale em banco novo (`npm run reset`). Para dados do cliente, use o painel.
- Textos da interface em português do Brasil, frases curtas, sem jargão técnico.

## Domínio (resumo; detalhes em docs/LOGICA.md)

insumo (comprado) e preparo (receita: ingredientes por lote + rendimento). Preparos usam outros preparos. Lanche = itens com quantidade por lanche. Meta de lanches => demanda => lotes (pais antes dos filhos, soma antes de arredondar) => compras (÷ aproveitamento − estoque).

## Pendências conhecidas

Ver docs/PERGUNTAS_EM_ABERTO.md. Em especial: composição real dos lanches, fatias por pão, estoque inicial. Ideias futuras: preço por item (custo e margem), histórico de planos, login/uso por mais de uma pessoa.
