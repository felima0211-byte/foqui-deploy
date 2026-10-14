# Foqui Tech

Painel de produção e lista de compras da Foqui Sanduíches. Roda no seu computador, sem instalar dependências: só Node.js 22.13 ou mais novo.

Já vem com 22 lanches (11 sanduíches, 3 wraps, 3 saladas, 5 sobremesas) e 13 adicionais, as medidas de concha em gramas e as vendas de agosto/2026. Você diz quantos lanches quer fazer (ou clica em Preencher pelas vendas). O painel calcula quais preparos fazer (pernil, maioneses, pães...), quantos lotes de cada, e o que comprar, descontando o estoque.

## Primeira vez

No Terminal, dentro da pasta do projeto:

```bash
node -v          # precisa mostrar v22.13 ou maior (v24 também serve)
npm run setup    # cria o banco e carrega as receitas dos documentos
npm start        # sobe o painel
```

Abra http://localhost:3000. Para parar, `Ctrl+C` no Terminal.

Se já tinha uma versão anterior: `npm run reset` (apaga o banco antigo).

## Comandos

| Comando | O que faz |
|---|---|
| `npm start` | Sobe o painel em http://localhost:3000 (`PORT=3001 npm start` troca a porta) |
| `npm run dev` | Igual, mas reinicia sozinho quando você edita o código |
| `npm test` | Roda os testes do cálculo e da API |
| `npm run auditar` | Lista no terminal onde os números das receitas merecem conferência |
| `npm run reset` | **Apaga o banco** e recarrega do zero |

## Como usar

1. **Estoque:** informe o que você tem (Definir = valor contado, Somar = entrada).
2. **Lanches / Medidas:** já cadastrados. Pese as conchas e corrija na aba Medidas; o que está "estimado" ou "pendente" aparece destacado.
3. **Produção:** digite a meta de cada lanche. Aparecem os lotes a produzir, na ordem de preparo, e quantos lanches o estoque cobre.
4. **Lista de Compras:** é calculada sozinha a partir da meta. Marque o que já comprou.
5. **Receitas:** ajuste rendimento, porção e ingredientes quando pesar um lote de verdade.
6. **Dados:** mostra onde o livro de receitas e a planilha não batem.

## Onde ficam os dados

Em `data/foqui.db` (SQLite). Para backup, copie esse arquivo. O botão "Baixar JSON" na aba Dados exporta tudo também.

## Estrutura

```
src/engine.js   cálculo (lotes, sub-receitas, estoque, compras, capacidade)
src/api.js      rotas /api (validações e regras)
src/server.js   servidor HTTP + arquivos do painel
src/schema.sql  tabelas do banco
data/seed.js    dados extraídos do livro de receitas e da planilha
public/         painel (HTML, CSS e JavaScript puros)
scripts/        setup, reset, auditoria, exemplo
test/           testes automáticos
docs/           LOGICA.md, PERGUNTAS_EM_ABERTO.md e os documentos originais
```

Leia `docs/LOGICA.md` para entender as regras de cálculo e `docs/PERGUNTAS_EM_ABERTO.md` para saber o que ainda precisa ser confirmado com a cozinha.

## Problemas comuns

- **`node: command not found` ou versão antiga:** instale o Node 22+ em nodejs.org (ou `nvm install 22`).
- **Porta em uso:** `PORT=3001 npm start`.
- **Quero recomeçar:** `npm run reset`.
- **O painel sem fontes bonitas:** as fontes vêm do Google Fonts; sem internet o painel usa fontes do sistema e funciona igual.
