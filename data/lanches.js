// Composição de UM lanche, conforme as linhas de montagem da Foqui:
//   - PDF "LINHA DE MONTAGEM FOQUI" (Canva): wraps, saladas, sanduíches (recheio + finalização), sobremesas;
//   - documento "Montagem de sanduíches e sobremesa" (docx).
// Medidas em concha/tira/fatia usam a tabela MEDIDAS de data/seed.js (concha -> gramas).
//
// Confiança de cada linha:
//   confirmado = está nos documentos ou a cozinha informou
//   estimado   = a quantidade foi deduzida (porção da planilha, mesma regra de outro item...)
//   pendente   = a cozinha ainda não informou (quantidade 0 até alguém preencher)
//
// Ficaram de fora (decisão da cozinha): embalagens. Sem composição conhecida: Foqui Box, Big Box, bebidas,
// batata doce e mandioca (ver data/vendas.js).

const g = (slug, qtd, conf = 'confirmado', nota = null) => ({ slug, qtd, conf, nota });
const m = (slug, medida, n = 1, conf = 'confirmado', nota = null) => ({ slug, medida, n, conf, nota });
const pendente = (slug, nota) => g(slug, 0, 'pendente', nota);

const MANTEIGA_PAO = pendente('manteiga-sem-sal', 'Manteiga para pincelar o pão: a quantidade por sanduíche não foi informada. Pesar quanto vai em 1 sanduíche.');
const BASE_SALGADO = [m('foqui-g', 'Fatia', 2), MANTEIGA_PAO];
const TEMPERO_TOMATE = g('tempero-tomate', 1, 'confirmado', '1 g por sanduíche que leva tomate (cozinha).');
const PORCAO_ASSUMIDA = 'Quantidade assumida igual à do sanduíche; confirmar com a cozinha.';

const COLESLAW = [m('repolho-roxo', 'Concha 125 ml'), m('cenoura', 'Concha 45 ml'), m('abacaxi', 'Concha 30 ml')];
const COLESLAW_X2 = [m('repolho-roxo', 'Concha 125 ml', 2), m('cenoura', 'Concha 45 ml', 2), m('abacaxi', 'Concha 30 ml', 2)];
const BACON = m('bacon-frito', 'Concha 30 ml');
const MANTEIGA_CANELA = g('manteiga-de-canela', 13, 'estimado', 'Pincelar manteiga de canela: quantidade não informada; usada a porção da planilha (13 g).');
const CALDA_30 = g('calda-de-doce-de-leite', 30);

export const CATEGORIAS = ['Sanduíche', 'Wrap', 'Salada', 'Sobremesa', 'Adicional'];

// chave | nome | categoria | componentes
export const LANCHES = [
  // ── Sanduíches (base: 2 fatias de Foqui G ou pão de queijo; a casa usa Foqui G) ──────────────
  ['frango', 'Frango', 'Sanduíche', [
    ...BASE_SALGADO, g('tiras-de-frango', 70), m('mussarela-ralada', 'Concha 85 ml'), m('fatias-de-tomate', 'Fatia', 4), TEMPERO_TOMATE,
    m('maionese-de-tomate-seco', 'Tira'), g('rucula', 15),
  ]],
  ['frango-bacon', 'Frango e Bacon', 'Sanduíche', [
    ...BASE_SALGADO, m('catupiry', 'Tira', 2), m('provolone', 'Concha 60 ml'), g('tiras-de-frango', 70),
    m('maionese-de-limao-siciliano', 'Tira'), BACON, m('picles', 'Concha 45 ml'), g('alface-americana', 30),
  ]],
  ['caipira', 'Caipira', 'Sanduíche', [
    ...BASE_SALGADO, m('catupiry', 'Tira', 2), m('mussarela-ralada', 'Concha 60 ml'), m('milho-verde', 'Concha 30 ml'), m('alho-poro', 'Concha 30 ml'),
    g('tiras-de-frango', 70), m('maionese-de-bacon', 'Tira'), BACON,
  ]],
  ['pernil', 'Pernil', 'Sanduíche', [
    ...BASE_SALGADO, g('pernil-desfiado', 80), ...COLESLAW, g('maionese-de-alho', 50, 'confirmado', 'No Pernil vão 50 g de maionese de alho (cozinha).'), BACON,
  ]],
  ['pernil-especial', 'Pernil Especial', 'Sanduíche', [
    ...BASE_SALGADO, m('catupiry', 'Tira', 2), m('mussarela-ralada', 'Concha 60 ml'), g('pernil-desfiado', 80),
    m('maionese-de-bacon', 'Tira'), m('picles', 'Concha 45 ml'), g('alface-americana', 30),
  ]],
  ['linguica', 'Linguiça Blumenau', 'Sanduíche', [
    ...BASE_SALGADO, g('linguica-blumenau', 80), m('catupiry', 'Tira', 2), m('provolone', 'Concha 60 ml'), m('alho-poro', 'Concha 30 ml'),
  ]],
  ['caprese', 'Caprese', 'Sanduíche', [
    ...BASE_SALGADO, m('mussarela-ralada', 'Concha 60 ml'), m('mussarela-de-bufala', 'Concha 85 ml'), m('fatias-de-tomate', 'Fatia', 7), TEMPERO_TOMATE,
    m('maionese-de-pesto', 'Tira'), g('rucula', 15),
  ]],
  ['falafel', 'Falafel', 'Sanduíche', [
    ...BASE_SALGADO, m('pasta-de-berinjela', 'Concha 60 ml'), g('falafel', 2), m('maionese-de-alho', 'Tira'), m('picles', 'Concha 45 ml'), g('alface-americana', 30),
  ]],
  ['cogumelo', 'Cogumelo', 'Sanduíche', [
    ...BASE_SALGADO, m('mussarela-ralada', 'Concha 85 ml'), g('cogumelo-assado', 100), m('maionese-de-pesto', 'Tira'), g('alface-americana', 30),
  ]],
  ['mignon', 'Mignon', 'Sanduíche', [
    ...BASE_SALGADO, g('file-mignon-assado', 70), m('mussarela-ralada', 'Concha 60 ml'), g('brie', 35), m('cebola-caramelizada', 'Concha 30 ml'),
    m('maionese-mostarda-e-mel', 'Tira'), g('rucula', 15),
  ]],
  ['carne-panela', 'Carne de Panela', 'Sanduíche', [
    ...BASE_SALGADO, g('carne-de-panela', 80), m('mussarela-ralada', 'Concha 85 ml'), m('fatias-de-tomate', 'Fatia', 4), TEMPERO_TOMATE,
  ]],

  // ── Wraps (base: 1 pão folha de 30 cm) ────────────────────────────────────────────────────
  ['wrap-pernil', 'Wrap Pernil', 'Wrap', [
    g('pao-folha-30cm', 1), g('pernil-desfiado', 80), ...COLESLAW, BACON, m('maionese-de-limao-siciliano', 'Tira'),
  ]],
  ['wrap-caprese', 'Wrap Caprese', 'Wrap', [
    g('pao-folha-30cm', 1), m('mussarela-de-bufala', 'Concha 85 ml'), m('mussarela-ralada', 'Concha 60 ml'), g('rucula', 50), m('fatias-de-tomate', 'Fatia', 7), m('maionese-de-pesto', 'Tira'),
  ]],
  ['wrap-caesar', 'Wrap Caesar', 'Wrap', [
    g('pao-folha-30cm', 1), g('tiras-de-frango', 70), m('mussarela-de-bufala', 'Concha 85 ml'), g('alface-americana', 50), g('molho-caesar', 30),
  ]],

  // ── Saladas ───────────────────────────────────────────────────────────────────────────────
  ['salada-caesar', 'Salada Caesar', 'Salada', [
    g('alface-americana', 125), m('mussarela-de-bufala', 'Concha 85 ml'), g('tiras-de-frango', 70), g('molho-caesar', 70), m('croutons', 'Concha 125 ml'),
  ]],
  ['salada-pernil', 'Salada Pernil', 'Salada', [
    g('alface-americana', 50), ...COLESLAW_X2, g('pernil-desfiado', 80), g('molho-caesar', 70), BACON,
  ]],
  ['salada-caprese', 'Salada Caprese', 'Salada', [
    g('alface-americana', 50), g('rucula', 40), m('mussarela-de-bufala', 'Concha 85 ml'), m('fatias-de-tomate', 'Fatia', 10),
    g('molho-caesar', 35), g('maionese-de-pesto', 35), m('croutons', 'Concha 125 ml'),
  ]],

  // ── Sobremesas ────────────────────────────────────────────────────────────────────────────
  ['doce-leite', 'Sanduíche de doce de leite', 'Sobremesa', [
    m('foqui-p', 'Fatia', 2), MANTEIGA_CANELA, m('mussarela-ralada', 'Concha 60 ml'), g('doce-de-leite', 60),
  ]],
  ['doce-leite-bacon', 'Sanduíche de doce de leite com bacon', 'Sobremesa', [
    m('foqui-p', 'Fatia', 2), MANTEIGA_CANELA, m('mussarela-ralada', 'Concha 60 ml'), g('doce-de-leite', 60), BACON,
  ]],
  ['rabanada', 'Rabanada', 'Sobremesa', [
    m('brioche', 'Fatia', 2), MANTEIGA_CANELA, g('sorvete', 80), m('farofa-de-amendoim', 'Colher 15 ml'), CALDA_30,
  ]],
  ['rabanada-brulee', 'Rabanada Brûlée', 'Sobremesa', [
    m('brioche', 'Fatia', 2), MANTEIGA_CANELA,
    g('doce-de-leite', 100, 'estimado', 'O documento diz "100 g de creme de doce de leite"; usado o doce de leite puro. Se o creme for a calda (com leite), trocar. O miolo retirado do pão é descartado.'),
    pendente('acucar', 'Açúcar polvilhado e maçaricado por cima: quantidade não informada.'),
  ]],
  ['brigadeiro', 'Brigadeiro', 'Sobremesa', [
    g('brigadeiro-de-colher', 50), m('farofa-de-amendoim', 'Colher 15 ml', 1, 'estimado', 'Cobertura: 15 ml de farofa de amendoim OU 7,5 ml de pistache (o cliente escolhe). Usada a farofa; pistache sem dado.'),
  ]],

  // ── Adicionais (itens vendidos à parte) ───────────────────────────────────────────────────
  ['add-maio-alho', 'Adicional: maionese de alho', 'Adicional', [m('maionese-de-alho', 'Tira', 1, 'estimado', PORCAO_ASSUMIDA)]],
  ['add-maio-tomate', 'Adicional: maionese de tomate seco', 'Adicional', [m('maionese-de-tomate-seco', 'Tira', 1, 'estimado', PORCAO_ASSUMIDA)]],
  ['add-maio-pesto', 'Adicional: maionese de pesto', 'Adicional', [m('maionese-de-pesto', 'Tira', 1, 'estimado', PORCAO_ASSUMIDA)]],
  ['add-maio-limao', 'Adicional: maionese de limão siciliano', 'Adicional', [m('maionese-de-limao-siciliano', 'Tira', 1, 'estimado', PORCAO_ASSUMIDA)]],
  ['add-maio-bacon', 'Adicional: maionese de bacon', 'Adicional', [m('maionese-de-bacon', 'Tira', 1, 'estimado', PORCAO_ASSUMIDA)]],
  ['add-caesar', 'Adicional: molho Caesar', 'Adicional', [g('molho-caesar', 30, 'estimado', PORCAO_ASSUMIDA)]],
  ['add-bacon', 'Adicional: bacon', 'Adicional', [m('bacon-frito', 'Concha 30 ml', 1, 'estimado', PORCAO_ASSUMIDA)]],
  ['add-frango', 'Adicional: frango', 'Adicional', [g('tiras-de-frango', 70, 'estimado', PORCAO_ASSUMIDA)]],
  ['add-pernil', 'Adicional: pernil', 'Adicional', [g('pernil-desfiado', 80, 'estimado', PORCAO_ASSUMIDA)]],
  ['add-mussarela', 'Adicional: queijo muçarela', 'Adicional', [m('mussarela-ralada', 'Concha 60 ml', 1, 'estimado', PORCAO_ASSUMIDA + ' Concha de 60 ml assumida.')]],
  ['add-bufala', 'Adicional: muçarela de búfala', 'Adicional', [m('mussarela-de-bufala', 'Concha 85 ml', 1, 'estimado', PORCAO_ASSUMIDA)]],
  ['add-calda', 'Adicional: calda de doce de leite', 'Adicional', [g('calda-de-doce-de-leite', 30, 'estimado', 'Copinho de 30 g, como na Rabanada.')]],
  ['add-pao-queijo', 'Adicional: pão de queijo', 'Adicional', [
    g('pao-de-queijo', 1, 'estimado', 'Troca de pão: o sanduíche sai com pão de queijo no lugar do Foqui G (1 unidade). Hipótese a confirmar; a conta continua descontando as 2 fatias de Foqui G, o que sobra a favor da segurança.'),
  ]],
];
