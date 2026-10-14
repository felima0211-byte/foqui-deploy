# Lógica do sistema

Extraída de dois documentos (em `docs/fontes/`):

- **Livro de receitas SP** (PDF, 35 páginas): para cada preparo, os ingredientes de **um lote**, o rendimento, o armazenamento e a validade.
- **Fichas técnicas** (planilha): **peso da porção** (quanto vai em um lanche) e rendimento medido, com `porções = rendimento ÷ peso da porção`.

A composição dos lanches vem das linhas de montagem (`docs/fontes/linha-de-montagem-foqui.pdf` e o docx) e as vendas do relatório CHEFWEB. O estoque é cadastrado no painel.

## Conceitos

- **Insumo:** o que se compra (pernil suíno, farinha, queijo).
- **Preparo:** o que a cozinha faz a partir de outros itens (pernil desfiado, maionese de alho, Foqui G). Tem receita: ingredientes por lote e rendimento do lote.
- **Sub-receita:** um preparo que usa outro preparo. Exemplos reais do livro: maionese de tomate seco usa maionese de alho e pesto; Caesar usa duas maioneses; carne de panela usa tempero Foqui, alho batido e mix de pimentas; Foqui G usa fermento natural ativado.
- **Lanche:** uma lista de itens (preparos ou insumos) com a quantidade que vai em UM lanche.
- **Porção:** o peso padrão de um item dentro de um lanche (ex.: pernil 80 g, maionese 30 g).
- **Unidade:** cada item tem uma só (g, ml ou un). Líquidos sem medida são tratados como 1 g = 1 ml.
- **Medida:** concha, tira, fatia. Cada uma vale uma quantidade na unidade do item (muçarela ralada: concha 85 ml = 50 g). O lanche guarda "2 conchas" e o motor converte; corrigir a medida atualiza tudo. Medidas e linhas de lanche têm confiança: confirmado, estimado ou pendente (pendente entra como 0 e aparece nos avisos).
- **Compra:** sempre em kg/L, para cima em passos de 0,1; item com embalagem (catupiry, 1,5 kg) sai em pacotes inteiros.
- **Vendas:** relatório do caixa mapeado linha a linha para os lanches (`data/vendas.js`); servem para sugerir metas (média diária x dias x folga, ou total de lanches no mix).

## O cálculo (src/engine.js)

1. Meta × quantidade por lanche => demanda de cada item.
2. Itens são processados do mais "alto" ao mais "baixo" na cadeia de receitas (pais antes dos filhos). Assim, a demanda de um preparo que é usado por vários outros é somada **antes** de calcular os lotes.
3. Para cada preparo com receita:
   - desconta o estoque pronto;
   - `lotes = ceil(falta ÷ rendimento do lote)`; se a receita for marcada como fracionável, não arredonda;
   - a sobra do último lote é informada;
   - os ingredientes (`lotes × qtd`) viram demanda dos itens de baixo.
4. Para cada insumo: `bruto = necessário ÷ aproveitamento`; `comprar = bruto − estoque`.
5. Preparo sem receita cadastrada vira "produção manual" e o painel avisa.
6. A ordem de produção é a inversa: o que é ingrediente de outro preparo fica pronto antes.

Receitas em ciclo (A usa B, B usa A) são recusadas.

### Quantos lanches dá para fazer

- **Prontos agora:** só com o que já está pronto nos componentes do lanche.
- **Produzindo:** também fabricando os preparos a partir dos insumos em estoque (busca binária usando o mesmo cálculo do plano). Cada lanche é calculado sozinho.

## Como os números iniciais foram escolhidos

Livro e planilha divergem em vários pontos. Regras usadas em `data/seed.js`:

1. Livro com "N porções" × peso da porção da planilha, se fechar com os ingredientes.
2. Livro em unidades (pães, falafel).
3. Quando o livro não informa rendimento: soma dos ingredientes (sem perda), ou o rendimento da planilha se for plausível.
4. O rendimento nunca passa do peso dos ingredientes.

Cada divergência fica no campo `avisos` do item e aparece na aba **Dados** (e em `npm run auditar`). Os números são ponto de partida: pesar um lote real e corrigir na aba Receitas é o caminho.

Também entram nas receitas ingredientes que o livro só cita no modo de preparo e não na lista (amido de milho e água do engrossante do pernil e da carne de panela).

## Modelo de dados (src/schema.sql)

`itens` ← `receitas` ← `receita_ingredientes`; `lanches` ← `lanche_componentes`; `estoque_movimentos` (estoque = soma dos movimentos, com histórico); `compras_checks` (itens já comprados).

Previsto, mas ainda não implementado: preço por item (custo e margem por lanche), histórico de planos de produção, validade dos lotes.
