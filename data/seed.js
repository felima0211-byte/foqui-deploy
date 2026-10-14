// Dados iniciais extraídos de:
//   docs/fontes/livro-de-receitas-sp.pdf  (livro: ingredientes por lote, rendimento, armazenamento)
//   docs/fontes/fichas-tecnicas.xlsx      (planilha: peso da porção e rendimento medido)
//
// Regras usadas ao escolher o rendimento de cada preparo (ver docs/LOGICA.md):
//   1. livro com "N porções" x peso da porção da planilha, se fechar com os ingredientes;
//   2. livro em unidades (pães, falafel);
//   3. soma dos ingredientes (sem perda) quando o livro não informa rendimento e não há dado confiável;
//   4. a planilha entra quando mede o lote e o valor é plausível.
// Toda divergência fica registrada em `avisos` e aparece no painel (aba Dados).
//
// Os lanches (data/lanches.js) vêm das linhas de montagem da Foqui (PDF do Canva + documento de montagem);
// as vendas (data/vendas.js) vêm do relatório CHEFWEB R001. As medidas (concha -> gramas) estão em MEDIDAS, no fim deste arquivo.

// [slug, nome, unidade, categoria, porcao_qtd, { armazenamento, validade_dias, avisos }]
export const INSUMOS = [
  ['farinha-de-trigo', 'Farinha de trigo', 'g', 'Secos'],
  ['agua-filtrada', 'Água filtrada', 'ml', 'Líquidos'],
  ['sal', 'Sal', 'g', 'Secos'],
  ['fermento-biologico', 'Fermento biológico', 'g', 'Secos'],
  ['fermento-natural-mae', 'Fermento natural (mãe)', 'g', 'Secos', null, { avisos: 'Cultura mantida na casa: parte do fermento ativado volta para ela. Sem compra.' }],
  ['acucar', 'Açúcar', 'g', 'Secos'],
  ['acucar-cristal', 'Açúcar cristal', 'g', 'Secos'],
  ['ovos', 'Ovos (batidos e peneirados)', 'g', 'Frios'],
  ['manteiga-sem-sal', 'Manteiga sem sal', 'g', 'Frios', null, { avisos: 'O livro pede para não usar manteiga aviação.' }],
  ['leite-integral', 'Leite integral', 'ml', 'Líquidos'],
  ['oleo-de-soja', 'Óleo de soja', 'ml', 'Líquidos'],
  ['azeite-de-oliva', 'Azeite de oliva', 'ml', 'Líquidos'],
  ['molho-shoyu', 'Molho shoyu', 'ml', 'Líquidos'],
  ['vinagre-de-alcool', 'Vinagre de álcool', 'ml', 'Líquidos'],
  ['polvilho-doce', 'Polvilho doce', 'g', 'Secos'],
  ['polvilho-azedo', 'Polvilho azedo', 'g', 'Secos'],
  ['mussarela-ralada', 'Muçarela ralada', 'g', 'Queijos', null, { avisos: 'A cozinha mede em concha (60 ml = 35 g, 85 ml = 50 g) e compra em kg: ver Medidas. A planilha trazia "muçarela fatiada 60 g", que era o 60 ml lido como gramas.' }],
  ['pernil-suino', 'Pernil suíno', 'g', 'Proteínas'],
  ['coxao-duro', 'Coxão duro', 'g', 'Proteínas'],
  ['peito-de-frango', 'Peito de frango', 'g', 'Proteínas'],
  ['file-mignon', 'Filé mignon (tiras cruas)', 'g', 'Proteínas'],
  ['cogumelo-paris', 'Cogumelo paris fatiado', 'g', 'Proteínas'],
  ['bacon-em-cubos', 'Bacon em cubos', 'g', 'Proteínas'],
  ['linguica-blumenau', 'Linguiça Blumenau', 'g', 'Proteínas', 80, { avisos: 'Só consta na planilha (porção 0,08 kg, rendimento 1 kg); sem receita no livro. Tratada como item comprado.' }],
  ['grao-de-bico', 'Grão de bico', 'g', 'Secos'],
  ['mel', 'Mel', 'g', 'Secos'],
  ['amido-de-milho', 'Amido de milho', 'g', 'Secos'],
  ['lemon-pepper', 'Lemon pepper', 'g', 'Temperos'],
  ['pimenta-calabresa', 'Pimenta calabresa', 'g', 'Temperos'],
  ['ervas-finas', 'Ervas finas', 'g', 'Temperos'],
  ['louro-em-po', 'Louro em pó', 'g', 'Temperos'],
  ['cominho-em-po', 'Cominho em pó', 'g', 'Temperos'],
  ['coentro-desidratado', 'Coentro desidratado', 'g', 'Temperos'],
  ['coentro-em-po', 'Coentro em pó', 'g', 'Temperos'],
  ['salsa-desidratada', 'Salsa desidratada', 'g', 'Temperos'],
  ['hortela-desidratada', 'Hortelã desidratada', 'g', 'Temperos'],
  ['gergelim-branco-torrado', 'Gergelim branco torrado', 'g', 'Temperos'],
  ['pimenta-do-reino-preta', 'Pimenta do reino preta em pó', 'g', 'Temperos'],
  ['pimenta-do-reino-branca', 'Pimenta do reino branca em pó', 'g', 'Temperos'],
  ['pimenta-caiena', 'Pimenta caiena em pó', 'g', 'Temperos'],
  ['pimenta-da-jamaica', 'Pimenta da Jamaica em pó', 'g', 'Temperos'],
  ['paprica-defumada', 'Páprica defumada', 'g', 'Temperos'],
  ['canela-em-po', 'Canela em pó', 'g', 'Temperos'],
  ['pasta-de-alho', 'Pasta de alho', 'g', 'Temperos'],
  ['alho-descascado', 'Alho descascado', 'g', 'Hortifruti'],
  ['cebola', 'Cebola', 'g', 'Hortifruti'],
  ['berinjela', 'Berinjela', 'g', 'Hortifruti'],
  ['pepino-japones', 'Pepino japonês', 'g', 'Hortifruti'],
  ['espinafre', 'Folhas de espinafre', 'g', 'Hortifruti'],
  ['alfavaca', 'Folhas de alfavaca', 'g', 'Hortifruti'],
  ['tomate-seco', 'Tomate seco', 'g', 'Hortifruti'],
  ['amendoim', 'Amendoim', 'g', 'Secos'],
  ['farofa-de-pao', 'Farofa de pão (aparas tostadas)', 'g', 'Secos', null, { avisos: 'Feita das aparas dos pães da casa; sem receita própria no livro.' }],
  ['suco-de-limao-tahiti', 'Suco de limão tahiti', 'g', 'Hortifruti'],
  ['suco-de-limao-siciliano', 'Suco de limão siciliano', 'g', 'Hortifruti'],
  ['limao-siciliano', 'Limão siciliano (para raspas)', 'un', 'Hortifruti'],
  ['gema-em-po', 'Gema em pó', 'g', 'Secos'],
  ['mostarda-amarela', 'Mostarda amarela', 'g', 'Secos'],
  ['iogurte-natural', 'Iogurte natural', 'g', 'Frios'],
  ['leite-condensado', 'Leite condensado', 'g', 'Secos'],
  ['creme-de-leite', 'Creme de leite', 'g', 'Secos'],
  ['chocolate-em-po-50', 'Chocolate em pó 50%', 'g', 'Secos'],
  ['doce-de-leite', 'Doce de leite', 'g', 'Secos'],
  // Itens usados direto no lanche (porção da planilha)
  ['repolho-roxo', 'Repolho roxo fatiado', 'g', 'Saladas', 25, { armazenamento: 'Refrigerado', validade_dias: 5 }],
  ['cenoura', 'Cenoura', 'g', 'Saladas', 20, { armazenamento: 'Refrigerado', validade_dias: 5 }],
  ['abacaxi', 'Abacaxi em cubos', 'g', 'Saladas', 30, { armazenamento: 'Refrigerado', validade_dias: 3 }],
  ['alho-poro', 'Alho poró', 'g', 'Saladas', 15, { armazenamento: 'Refrigerado', validade_dias: 5 }],
  ['rucula', 'Rúcula', 'g', 'Saladas', null, { armazenamento: 'Refrigerado', validade_dias: 3 }],
  ['alface-americana', 'Alface americana', 'g', 'Saladas', null, { armazenamento: 'Refrigerado', validade_dias: 3 }],
  ['fatias-de-tomate', 'Tomate (fatias)', 'g', 'Saladas', null, { avisos: 'Cada fatia pesa 10 g (cozinha). A planilha tinha 70 g = 7 fatias do Caprese.' }],
  ['mussarela-de-bufala', 'Muçarela de búfala', 'g', 'Queijos', 50, { avisos: 'Planilha: 45 g. Concha de 85 ml usada com 50 g (mesma proporção da muçarela); pesar para confirmar.' }],
  ['provolone', 'Provolone', 'g', 'Queijos', 35],
  ['brie', 'Brie', 'g', 'Queijos', 35],
  // Itens que aparecem nas linhas de montagem e não existiam no livro nem na planilha
  ['catupiry', 'Catupiry', 'g', 'Queijos', 40, { avisos: 'Comprado em pacote de 1,5 kg. 2 tiras = 40 g (cozinha).', embalagem_qtd: 1500, embalagem_nome: 'pacote' }],
  ['milho-verde', 'Milho verde', 'g', 'Saladas', 30, { avisos: '30 ml = 30 g (cozinha).' }],
  ['pao-folha-30cm', 'Pão folha 30 cm (wrap)', 'un', 'Pães', 1, { avisos: 'Base do wrap. Sem dado de embalagem de compra (pacote de quantas unidades?).' }],
  ['sorvete', 'Sorvete (bola de 80 g)', 'g', 'Sobremesas', 80, { avisos: 'Usado na Rabanada. Sabor/marca não informados.' }],
];

// Preparos. `rend` = rendimento de UM lote na unidade do preparo (null = receita ainda não cadastrada).
// ings = [[slug, qtd_por_lote, obs?]]
const L = (slug, qtd, obs) => (obs ? [slug, qtd, obs] : [slug, qtd]);
const LIVRO = (p) => `Livro de receitas SP, p.${p}`;

export const PREPAROS = [
  // ── Pães ──────────────────────────────────────────────────────────────
  {
    slug: 'fermento-natural-ativado', nome: 'Fermento natural ativado', unidade: 'g', categoria: 'Pães',
    rend: 250, fracionavel: true, armazenamento: 'Refrigerado', fonte: LIVRO(2),
    avisos: 'Rendimento deduzido do exemplo 1:2:2 do livro (50 g + 100 g + 100 ml = 250 g). Alimentar um dia antes da produção.',
    ings: [L('fermento-natural-mae', 50), L('farinha-de-trigo', 100), L('agua-filtrada', 100)],
  },
  {
    slug: 'foqui-g', nome: 'Foqui G (pão)', unidade: 'un', unidade_label: 'pão', categoria: 'Pães',
    rend: 16, armazenamento: 'Congelado (fatiado)', fonte: LIVRO(3),
    avisos: 'Pão de forma de todos os sanduíches salgados (confirmado pela cozinha). Cada lanche leva 2 fatias. Fatias por pão: a planilha sugere 20 (porção 2, rendimento 20), não confirmado. Ajuste em Medidas.',
    ings: [L('farinha-de-trigo', 13000), L('agua-filtrada', 6800), L('fermento-natural-ativado', 5000), L('sal', 240), L('fermento-biologico', 40)],
  },
  {
    slug: 'foqui-p', nome: 'Foqui P (pão)', unidade: 'un', unidade_label: 'pão', categoria: 'Pães',
    rend: null, avisos: 'Usado no Sanduíche de doce de leite (2 fatias). Variação de forma da mesma massa do Foqui (livro, p.3). Planilha: porção 2, rendimento 16 (usado como 16 fatias por pão, não confirmado). Receita própria pendente.',
  },
  {
    slug: 'levain', nome: 'Levain (pão)', unidade: 'g', categoria: 'Pães', porcao: 85,
    rend: null, avisos: 'Só consta na planilha (porção 0,085 kg; rendimento 0,25 kg). Sem receita no livro.',
  },
  {
    slug: 'brioche', nome: 'Brioche (pão)', unidade: 'un', unidade_label: 'pão', categoria: 'Pães',
    rend: 15, armazenamento: 'Congelado (fatiado)', fonte: LIVRO(4),
    avisos: 'Cada pão rende 9 fatias (livro). Planilha traz porção 0,085 kg e rendimento 0,62 kg, que parece ser o peso de um pão.',
    ings: [L('farinha-de-trigo', 4350), L('acucar', 750), L('fermento-natural-ativado', 750), L('ovos', 2400), L('fermento-biologico', 60), L('manteiga-sem-sal', 750), L('sal', 75)],
  },
  {
    slug: 'pao-de-queijo', nome: 'Pão de queijo', unidade: 'un', unidade_label: 'unidade', categoria: 'Pães', porcao: 1,
    rend: 25, armazenamento: 'Congelado', fonte: LIVRO(5),
    avisos: 'Livro diz rendimento 25, mas o modo de preparo manda dividir a massa em 27 partes.',
    ings: [L('leite-integral', 450, 'livro: 450 g'), L('agua-filtrada', 450, 'livro: 450 g'), L('oleo-de-soja', 450, 'livro: 450 g'), L('sal', 45), L('polvilho-doce', 1000), L('polvilho-azedo', 1000), L('mussarela-ralada', 400), L('ovos', 400)],
  },
  {
    slug: 'fatias-de-foqui', nome: 'Fatias de Foqui', unidade: 'g', categoria: 'Pães',
    rend: null, avisos: 'Derivado do Foqui G (livro, p.6). Falta a relação pão → gramas de fatias; cadastre estoque ou receita.',
  },
  {
    slug: 'croutons', nome: 'Croutons', unidade: 'g', categoria: 'Acompanhamentos', porcao: 30,
    rend: 720, fonte: LIVRO(6),
    avisos: '24 porções x 30 g. O modo de preparo cita tomilho e azeite que não estão na lista de ingredientes.',
    ings: [L('fatias-de-foqui', 1000)],
  },

  // ── Proteínas ─────────────────────────────────────────────────────────
  {
    slug: 'pernil-desfiado', nome: 'Pernil desfiado', unidade: 'g', categoria: 'Proteínas', porcao: 80,
    rend: 7440, armazenamento: 'Congelado', validade_dias: 90, fonte: LIVRO(8),
    avisos: '93 porções x 80 g (livro e planilha batem). Amido e a água do engrossante estão só no modo de preparo.',
    ings: [L('pernil-suino', 20000), L('molho-shoyu', 2000), L('alho-batido', 250), L('mel', 600), L('lemon-pepper', 250), L('pimenta-calabresa', 20), L('agua-filtrada', 1300, '1 L da lista + 300 ml do engrossante'), L('amido-de-milho', 300, 'só no modo de preparo')],
  },
  {
    slug: 'carne-de-panela', nome: 'Carne de panela', unidade: 'g', categoria: 'Proteínas', porcao: 80,
    rend: 6400, armazenamento: 'Congelado', validade_dias: 90, fonte: LIVRO(9),
    avisos: '80 porções x 80 g. O texto cita acém e tomilho em pó, mas a lista traz coxão duro e não traz tomilho.',
    ings: [L('coxao-duro', 16000), L('cenoura', 500), L('cebola', 500), L('alho-batido', 240), L('ervas-finas', 50), L('louro-em-po', 15), L('tempero-foqui', 220), L('molho-shoyu', 400), L('mix-de-pimentas', 30), L('agua-filtrada', 2250, '2 L da lista + 250 ml do engrossante'), L('amido-de-milho', 250, 'só no modo de preparo')],
  },
  {
    slug: 'tiras-de-frango', nome: 'Tiras de frango', unidade: 'g', categoria: 'Proteínas', porcao: 70,
    rend: 4060, armazenamento: 'Congelado', validade_dias: 90, fonte: LIVRO(10),
    avisos: '58 porções x 70 g.',
    ings: [L('peito-de-frango', 5000), L('tempero-foqui', 80), L('oleo-de-soja', 80)],
  },
  {
    slug: 'file-mignon-assado', nome: 'Filé mignon (assado)', unidade: 'g', categoria: 'Proteínas', porcao: 70,
    rend: 770, armazenamento: 'Congelado', validade_dias: 90, fonte: LIVRO(11),
    avisos: 'Livro: 11 porções x 70 g = 770 g. Planilha traz rendimento 0,865 kg (≈12 porções).',
    ings: [L('file-mignon', 1000), L('sal', 15), L('ervas-finas', 15, 'livro: 15 ml'), L('mix-de-pimentas', 2), L('manteiga-sem-sal', 20, 'depois de assado')],
  },
  {
    slug: 'cogumelo-assado', nome: 'Cogumelo assado', unidade: 'g', categoria: 'Proteínas', porcao: 100,
    rend: 4400, armazenamento: 'Congelado', validade_dias: 90, fonte: LIVRO(12),
    avisos: '44 porções x 100 g. O texto também cita cogumelo shimeji, que não está na lista.',
    ings: [L('cogumelo-paris', 5000), L('sal', 80), L('mix-de-pimentas', 10), L('ervas-finas', 80), L('azeite-de-oliva', 100), L('oleo-de-soja', 100)],
  },
  {
    slug: 'falafel', nome: 'Falafel', unidade: 'un', unidade_label: 'unidade', categoria: 'Proteínas', porcao: 2,
    rend: 80, armazenamento: 'Congelado', validade_dias: 90, fonte: LIVRO(13),
    avisos: 'Planilha traz "porção 2" (interpretado como 2 unidades por lanche — confirmar) e rendimento 80.',
    ings: [L('grao-de-bico', 1000), L('azeite-de-oliva', 150), L('oleo-de-soja', 150), L('cominho-em-po', 2), L('mix-de-pimentas', 10), L('coentro-desidratado', 15), L('salsa-desidratada', 15), L('hortela-desidratada', 15), L('gergelim-branco-torrado', 100), L('sal', 30)],
  },

  // ── Acompanhamentos ───────────────────────────────────────────────────
  {
    slug: 'pasta-de-berinjela', nome: 'Pasta de berinjela', unidade: 'g', categoria: 'Acompanhamentos', porcao: 80,
    rend: 4800, armazenamento: 'Congelado', validade_dias: 90, fonte: LIVRO(14),
    avisos: '60 porções x 80 g (livro e planilha batem).',
    ings: [L('berinjela', 10000), L('sal', 75), L('mix-de-pimentas', 10), L('azeite-de-oliva', 100), L('oleo-de-soja', 100)],
  },
  {
    slug: 'cebola-caramelizada', nome: 'Cebola caramelizada', unidade: 'g', categoria: 'Acompanhamentos', porcao: 30,
    rend: 3000, armazenamento: 'Congelado', validade_dias: 90, fonte: LIVRO(15),
    avisos: 'Livro: 100 porções x 30 g = 3 kg. Planilha: rendimento 1,25 kg (≈42 porções). Usado o livro; confira pesando um lote.',
    ings: [L('cebola', 5000), L('sal', 60), L('manteiga-sem-sal', 100), L('acucar', 200)],
  },
  {
    slug: 'picles', nome: 'Picles de pepino', unidade: 'g', categoria: 'Acompanhamentos', porcao: 45,
    rend: 9000, armazenamento: 'Refrigerado', validade_dias: 90, fonte: LIVRO(16),
    avisos: 'Livro: 533 porções (16 kg ÷ 30 g), o que passaria do peso dos pepinos. Usado o rendimento medido da planilha (9 kg, porção 45 g ≈ 200 porções). Planilha anota que o uso real é ~50 g.',
    ings: [L('pepino-japones', 16000), L('vinagre-de-alcool', 5000), L('agua-filtrada', 5000), L('acucar', 2700), L('sal', 400), L('coentro-em-po', 60), L('mix-de-pimentas', 20), L('louro-em-po', 30), L('pasta-de-alho', 70), L('ervas-finas', 60)],
  },
  {
    slug: 'bacon-frito', nome: 'Bacon frito', unidade: 'g', categoria: 'Acompanhamentos', porcao: 15,
    rend: 5750, armazenamento: 'Refrigerado', validade_dias: 10, fonte: LIVRO(17),
    avisos: '5.750 g (383 porções x 15 g) — livro e planilha batem. 15 kg de bacon cru rendem 38%.',
    ings: [L('bacon-em-cubos', 15000)],
  },
  {
    slug: 'farofa-de-amendoim', nome: 'Farofa de amendoim', unidade: 'g', categoria: 'Acompanhamentos', porcao: 10,
    rend: 4000, armazenamento: 'Congelado', validade_dias: 20, fonte: LIVRO(32),
    avisos: 'Planilha: 4 kg (soma dos ingredientes: 4,12 kg).',
    ings: [L('farofa-de-pao', 2000), L('amendoim', 1000), L('manteiga-sem-sal', 600), L('acucar', 500), L('sal', 20)],
  },
  {
    slug: 'caramelo-salgado', nome: 'Caramelo salgado', unidade: 'g', categoria: 'Acompanhamentos', porcao: 70,
    rend: 3000, armazenamento: 'Refrigerado', validade_dias: 60, fonte: LIVRO(34),
    avisos: 'Rendimento da planilha (3 kg). A planilha anota que a porção de 70 g pode estar representando o lote inteiro; confirmar.',
    ings: [L('acucar', 2000), L('leite-integral', 1000), L('sal', 40)],
  },
  {
    slug: 'manteiga-de-canela', nome: 'Manteiga de canela', unidade: 'g', categoria: 'Acompanhamentos', porcao: 13,
    rend: 2600, armazenamento: 'Refrigerado', validade_dias: 15, fonte: LIVRO(35),
    avisos: 'Planilha traz 0,26 kg (provável erro de casa decimal); usada a soma dos ingredientes, 2,6 kg.',
    ings: [L('manteiga-sem-sal', 2000), L('acucar-cristal', 500), L('canela-em-po', 100)],
  },

  // ── Temperos ──────────────────────────────────────────────────────────
  {
    slug: 'mix-de-pimentas', nome: 'Mix de pimentas', unidade: 'g', categoria: 'Temperos',
    rend: 1500, fracionavel: true, armazenamento: 'Ambiente', validade_dias: 90, fonte: LIVRO(18),
    avisos: 'Soma dos ingredientes (mistura seca, sem perda). Planilha traz 1 kg.',
    ings: [L('pimenta-do-reino-preta', 500), L('pimenta-do-reino-branca', 500), L('pimenta-caiena', 250), L('pimenta-da-jamaica', 250)],
  },
  {
    slug: 'alho-batido', nome: 'Alho batido', unidade: 'g', categoria: 'Temperos',
    rend: 1500, fracionavel: true, armazenamento: 'Congelado', validade_dias: 90, fonte: LIVRO(18),
    avisos: '1 kg de alho + 500 ml de óleo = 1,5 kg (livro e planilha batem).',
    ings: [L('alho-descascado', 1000), L('oleo-de-soja', 500)],
  },
  {
    slug: 'tempero-tomate', nome: 'Tempero para tomate', unidade: 'g', categoria: 'Temperos', porcao: 1,
    rend: 1200, fracionavel: true, armazenamento: 'Ambiente', validade_dias: 90, fonte: LIVRO(19),
    avisos: '1 g por sanduíche que leva tomate (cozinha). A planilha tinha porção 2 g.',
    ings: [L('sal', 1000), L('mix-de-pimentas', 200)],
  },
  {
    slug: 'tempero-foqui', nome: 'Tempero Foqui', unidade: 'g', categoria: 'Temperos',
    rend: 1300, fracionavel: true, armazenamento: 'Ambiente', validade_dias: 90, fonte: LIVRO(19),
    avisos: 'Soma dos ingredientes. Planilha traz 1,55 kg, que não fecha com a receita.',
    ings: [L('sal', 1000), L('paprica-defumada', 250), L('mix-de-pimentas', 50)],
  },

  // ── Molhos ────────────────────────────────────────────────────────────
  {
    slug: 'maionese-de-alho', nome: 'Maionese de alho', unidade: 'g', categoria: 'Molhos', porcao: 50,
    rend: 1550, armazenamento: 'Refrigerado', validade_dias: 5, fonte: LIVRO(25),
    avisos: '31 porções x 50 g = 1,55 kg (fecha com os ingredientes). Planilha traz 4,5 kg (≈ 3 receitas: o liquidificador bate 3 por vez).',
    ings: [L('leite-integral', 450), L('oleo-de-soja', 1050), L('alho-descascado', 5), L('sal', 15), L('suco-de-limao-tahiti', 30)],
  },
  {
    slug: 'pesto-batido', nome: 'Pesto batido', unidade: 'g', categoria: 'Molhos',
    rend: 4750, armazenamento: 'Congelado', validade_dias: 90, fonte: LIVRO(31),
    avisos: 'Livro: 6 porções (sacos de 500 g). Usada a soma dos ingredientes, 4,75 kg (igual à planilha).',
    ings: [L('espinafre', 2000), L('alfavaca', 500), L('oleo-de-soja', 2250)],
  },
  {
    slug: 'maionese-de-tomate-seco', nome: 'Maionese de tomate seco com manjericão', unidade: 'g', categoria: 'Molhos', porcao: 30,
    rend: 480, armazenamento: 'Refrigerado', validade_dias: 5, fonte: LIVRO(25),
    avisos: '16 porções x 30 g. Planilha traz 0,55 kg. "Pesto" da lista = pesto batido.',
    ings: [L('maionese-de-alho', 450), L('tomate-seco', 80), L('pesto-batido', 60)],
  },
  {
    slug: 'maionese-de-pesto', nome: 'Maionese de pesto', unidade: 'g', categoria: 'Molhos', porcao: 30,
    rend: 510, armazenamento: 'Refrigerado', validade_dias: 5, fonte: LIVRO(26),
    avisos: '17 porções x 30 g. Planilha traz 0,6 kg (= soma dos ingredientes).',
    ings: [L('maionese-de-alho', 450), L('pesto-batido', 150)],
  },
  {
    slug: 'maionese-de-limao-siciliano', nome: 'Maionese de limão siciliano', unidade: 'g', categoria: 'Molhos', porcao: 30,
    rend: 990, armazenamento: 'Refrigerado', validade_dias: 5, fonte: LIVRO(27),
    avisos: '33 porções x 30 g. Planilha traz 0,425 kg, que não fecha com os ingredientes (≈1,26 kg).',
    ings: [L('gema-em-po', 70), L('agua-filtrada', 200), L('sal', 10), L('oleo-de-soja', 900), L('limao-siciliano', 1, 'raspas de 1 limão'), L('suco-de-limao-siciliano', 75)],
  },
  {
    slug: 'maionese-de-bacon', nome: 'Maionese de bacon', unidade: 'g', categoria: 'Molhos', porcao: 30,
    rend: 1260, armazenamento: 'Refrigerado', validade_dias: 5, fonte: LIVRO(28),
    avisos: '42 porções x 30 g. Planilha traz 0,49 kg, que não fecha com os ingredientes (≈1,4 kg).',
    ings: [L('gema-em-po', 70), L('agua-filtrada', 290), L('sal', 10), L('oleo-de-soja', 900), L('suco-de-limao-tahiti', 45), L('bacon-frito', 100)],
  },
  {
    slug: 'maionese-mostarda-e-mel', nome: 'Maionese mostarda e mel', unidade: 'g', categoria: 'Molhos', porcao: 30,
    rend: 2640, armazenamento: 'Refrigerado', validade_dias: 5, fonte: LIVRO(29),
    avisos: '88 porções x 30 g. O texto cita sal, que não está na lista. Planilha traz 0,51 kg.',
    ings: [L('gema-em-po', 90), L('agua-filtrada', 270), L('mostarda-amarela', 280), L('mel', 160), L('oleo-de-soja', 1800), L('suco-de-limao-tahiti', 60)],
  },
  {
    slug: 'molho-caesar', nome: 'Molho Caesar', unidade: 'g', categoria: 'Molhos', porcao: 70,
    rend: 4230, armazenamento: 'Refrigerado', validade_dias: 5, fonte: LIVRO(30),
    avisos: 'Livro diz "4 porções" (provavelmente 4 bisnagas/potes); usada a soma dos ingredientes. Iogurte: 13 unidades ou 2.200 g. Planilha traz 0,45 kg.',
    ings: [L('maionese-de-alho', 1000), L('maionese-de-limao-siciliano', 1000), L('iogurte-natural', 2200), L('mix-de-pimentas', 15), L('sal', 15)],
  },

  // ── Sobremesas ────────────────────────────────────────────────────────
  {
    slug: 'brigadeiro-de-colher', nome: 'Brigadeiro de colher', unidade: 'g', categoria: 'Sobremesas', porcao: 50,
    rend: 10625, armazenamento: 'Refrigerado', validade_dias: 10, fonte: LIVRO(33),
    avisos: 'Soma dos ingredientes. Planilha traz 3 kg, que não fecha com a receita (10,6 kg).',
    ings: [L('leite-condensado', 5000), L('creme-de-leite', 5000), L('chocolate-em-po-50', 625)],
  },
  {
    slug: 'calda-de-doce-de-leite', nome: 'Calda de doce de leite', unidade: 'g', categoria: 'Sobremesas',
    rend: 500, armazenamento: 'Refrigerado', validade_dias: 15, fonte: LIVRO(35),
    avisos: 'Soma dos ingredientes (100 ml de leite + 400 g de doce de leite).',
    ings: [L('leite-integral', 100), L('doce-de-leite', 400)],
  },
  {
    slug: 'calda-de-pistache', nome: 'Calda de pistache', unidade: 'g', categoria: 'Sobremesas', porcao: 30,
    rend: null, avisos: 'Só consta na planilha (porção 0,03 kg; rendimento 0,2 kg). Sem receita no livro.',
  },
  {
    slug: 'torta-secreta-de-pistache', nome: 'Torta secreta de pistache', unidade: 'un', unidade_label: 'fatia', categoria: 'Sobremesas', porcao: 1,
    rend: null, avisos: 'Só consta na planilha (porção 1, rendimento 8). Sem receita no livro.',
  },
  {
    slug: 'brigadeiro-com-bacon', nome: 'Brigadeiro com bacon', unidade: 'g', categoria: 'Sobremesas',
    rend: null, avisos: 'Planilha traz porção 0,085 kg maior que o rendimento 0,06 kg: dado inconsistente. Sem receita no livro.',
  },
];

// Medidas caseiras: [slug do item, nome da medida, quanto vale na unidade do item, confiança, nota]
//   confirmado = informado pela cozinha / consta nos documentos
//   estimado   = deduzido da porção da planilha ou de outra medida; pesar para confirmar
export const MEDIDAS = [
  // Queijos: a concha é medida em ml, a compra é em kg. Pesagens da cozinha.
  ['mussarela-ralada', 'Concha 60 ml', 35, 'confirmado', 'Pesado pela cozinha: 60 ml = 35 g (não é 60 g).'],
  ['mussarela-ralada', 'Concha 85 ml', 50, 'confirmado', 'Pesado pela cozinha: 85 ml = 50 g (não é 85 g).'],
  ['provolone', 'Concha 60 ml', 35, 'confirmado', 'Bate com a porção da planilha (35 g).'],
  ['mussarela-de-bufala', 'Concha 85 ml', 50, 'estimado', 'Mesma proporção da muçarela ralada (85 ml = 50 g). A planilha diz 45 g. Pesar uma concha.'],
  ['catupiry', 'Tira', 20, 'confirmado', '2 tiras = 40 g (cozinha).'],
  // Saladas e acompanhamentos em concha. Pesos da planilha de porções, ainda não pesados na concha.
  ['milho-verde', 'Concha 30 ml', 30, 'confirmado', '30 ml = 30 g (cozinha).'],
  ['alho-poro', 'Concha 30 ml', 15, 'estimado', 'Porção da planilha (15 g). Pesar a concha.'],
  ['repolho-roxo', 'Concha 125 ml', 25, 'estimado', 'Porção da planilha (25 g). Pesar a concha.'],
  ['cenoura', 'Concha 45 ml', 20, 'estimado', 'Porção da planilha (20 g). Pesar a concha.'],
  ['abacaxi', 'Concha 30 ml', 30, 'estimado', 'Porção da planilha (30 g). Pesar a concha.'],
  ['cebola-caramelizada', 'Concha 30 ml', 30, 'estimado', 'Porção da planilha (30 g). Pesar a concha.'],
  ['pasta-de-berinjela', 'Concha 60 ml', 80, 'confirmado', 'Cozinha confirmou 80 g (planilha também).'],
  ['picles', 'Concha 45 ml', 45, 'estimado', 'Porção da planilha (45 g). Pesar a concha.'],
  ['bacon-frito', 'Concha 30 ml', 15, 'estimado', 'Porção da planilha (15 g). Pesar a concha.'],
  ['croutons', 'Concha 125 ml', 30, 'estimado', 'Porção da planilha (30 g). Pesar a concha.'],
  ['farofa-de-amendoim', 'Colher 15 ml', 10, 'estimado', 'Porção da planilha (10 g). Pesar a colher.'],
  ['fatias-de-tomate', 'Fatia', 10, 'confirmado', 'Cada fatia pesa 10 g (cozinha).'],
  // Molhos: "1 tira" = 30 g (cozinha). Pernil leva 50 g de maionese de alho, em gramas.
  ['maionese-de-alho', 'Tira', 30, 'confirmado', 'Molhos: 30 g por sanduíche (cozinha).'],
  ['maionese-de-tomate-seco', 'Tira', 30, 'confirmado', 'Molhos: 30 g por sanduíche (cozinha).'],
  ['maionese-de-pesto', 'Tira', 30, 'confirmado', 'Molhos: 30 g por sanduíche (cozinha).'],
  ['maionese-de-limao-siciliano', 'Tira', 30, 'confirmado', 'Molhos: 30 g por sanduíche (cozinha).'],
  ['maionese-de-bacon', 'Tira', 30, 'confirmado', 'Molhos: 30 g por sanduíche (cozinha).'],
  ['maionese-mostarda-e-mel', 'Tira', 30, 'confirmado', 'Molhos: 30 g por sanduíche (cozinha).'],
  // Pães fatiados (as fatias saem de um pão inteiro; o pão é medido em pães)
  ['foqui-g', 'Fatia', 0.05, 'estimado', 'Supõe 20 fatias por pão (planilha: rendimento 20). Não confirmado.'],
  ['foqui-p', 'Fatia', 0.0625, 'estimado', 'Supõe 16 fatias por pão (planilha: rendimento 16). Não confirmado.'],
  ['brioche', 'Fatia', 1 / 9, 'confirmado', 'Livro de receitas: cada pão rende 9 fatias.'],
];
