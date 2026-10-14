// Vendas de AGOSTO/2026, do relatório "CHEFWEB - R001 - Vendas Produtos".
// Atenção: o arquivo enviado se chama "setembro", mas o período impresso é 01/08/2026 a 31/08/2026 (31 dias).
// Cada linha do relatório aparece uma vez: [código, produto, quantidade, destino, fator?].
//   destino = chave de um lanche (data/lanches.js) ou "ignorar: motivo".
//   fator   = quantas unidades do lanche cada venda representa (ex.: "5 brigadeiros" = 5).
// Combos entram no lanche do sanduíche que carregam (o que vai junto — chips, bebida — não é calculado).
// A soma de todas as linhas é conferida em teste contra o total do relatório (4.299 itens).

export const PERIODO = {
  rotulo: 'Ago/2026',
  inicio: '2026-08-01',
  fim: '2026-08-31',
  dias: 31,
  fonte: 'CHEFWEB R001 - Vendas Produtos (5 lojas, ECF + PED + CNFM). Arquivo nomeado "setembro"; período impresso: 01/08 a 31/08/2026.',
};
export const TOTAL_RELATORIO = 4299;

const bebida = 'ignorar: bebida';
const acomp = 'ignorar: acompanhamento sem receita cadastrada';
const box = 'ignorar: box/combo sem composição informada';

export const LINHAS = [
  // ADICIONAIS
  [145, 'BATATA DOCE', 109, acomp],
  [148, 'MUCARELA DE BUFALA ADICIONAL', 2, 'add-bufala'],
  [149, 'MOLHO CAESAR', 14, 'add-caesar'],
  [150, 'QUEIJO MUCARELA ADICIONAL', 18, 'add-mussarela'],
  [151, 'MAIO ALHO', 22, 'add-maio-alho'],
  [152, 'MAIO TOMATE', 14, 'add-maio-tomate'],
  [153, 'BACON ADICIONAL', 28, 'add-bacon'],
  [154, 'PAO DE QUEIJO ADICIONAL', 28, 'add-pao-queijo'],
  [155, 'MAIO PESTO', 13, 'add-maio-pesto'],
  [157, 'CALDA DE DOCE DE LEITE', 8, 'add-calda'],
  [158, 'MAIO LIMAO', 63, 'add-maio-limao'],
  [159, 'MAIO BACON', 17, 'add-maio-bacon'],
  [188, 'FRANGO ADICIONAL', 27, 'add-frango'],
  [189, 'PERNIL ADICIONAL', 1, 'add-pernil'],
  [146, 'MANDIOCA', 99, acomp],
  // ÁGUAS
  [190, 'AGUA NA CAIXA', 69, bebida],
  [402, 'AGUA COM GAS', 81, bebida],
  // BOX ENCOMENDAS
  [41, 'BIG BOX', 4, box],
  [611, '5 BRIGADEIROS', 1, 'brigadeiro', 5],
  // CAFÉ
  [201, 'ESPRESSO', 10, bebida],
  [202, 'DUPLO ESPRESSO', 2, bebida],
  [213, 'CAFE CARAMELO GELADO', 11, bebida],
  [217, 'CAPPUCCINO GELADO', 10, bebida],
  [218, 'CHA GELADO', 65, bebida],
  [219, 'CHA GELADO COMBO', 7, bebida],
  [232, 'CAFE COM DOCE DE LEITE GELADO', 4, bebida],
  [237, 'ESPRESSO COM LEITE', 2, bebida],
  [839, 'CAPPUCCINO QUENTE', 3, bebida],
  // CERVEJAS
  [503, 'CORONA', 17, bebida],
  // COMBOS
  [27, 'COMBO MIGNON', 12, 'mignon'],
  [40, 'FOQUI BOX', 22, box],
  // IFOOD
  [11101, 'SALADA CAESAR IFOOD', 57, 'salada-caesar'],
  [11102, 'PERNIL ESPECIAL IFOOD', 48, 'pernil-especial'],
  [11103, 'FALAFEL IFOOD', 26, 'falafel'],
  [11104, 'FRANGO IFOOD', 230, 'frango'],
  [11105, 'PERNIL IFOOD', 137, 'pernil'],
  [11106, 'LINGUICA BLUMENAU IFOOD', 82, 'linguica'],
  [11107, 'CARNE DE PANELA IFOOD', 84, 'carne-panela'],
  [11109, 'DOCE DE LEITE IFOOD', 24, 'doce-leite'],
  [11110, 'REFRI NATURAL LIMAO IFOOD', 13, bebida],
  [11111, 'CAPRESE IFOOD', 85, 'caprese'],
  [11112, 'CAIPIRA IFOOD', 94, 'caipira'],
  [11113, 'COGUMELO IFOOD', 23, 'cogumelo'],
  [11114, 'FRANGO E BACON IFOOD', 71, 'frango-bacon'],
  [11115, 'DOCE DE LEITE COM BACON IFOOD', 9, 'doce-leite-bacon'],
  [11116, 'COMBO PERNIL IFOOD', 20, 'pernil'],
  [11117, 'COMBO FRANGO E BACON IFOOD', 28, 'frango-bacon'],
  [11118, 'COMBO CAPRESE IFOOD', 11, 'caprese'],
  [11119, 'REFRI NATURAL FRUTAS VERMELHAS IFOOD', 3, bebida],
  [11123, 'RABANADA BRULEE IFOOD', 26, 'rabanada-brulee'],
  [11124, 'COMBO MIGNON IFOOD', 19, 'mignon'],
  [11132, 'WRAP CAPRESE IFOOD', 5, 'wrap-caprese'],
  [11133, 'WRAP PERNIL IFOOD', 19, 'wrap-pernil'],
  [11134, 'WRAP CAESAR IFOOD', 94, 'wrap-caesar'],
  [11145, 'BATATA DOCE IFOOD', 42, acomp],
  [11146, 'MANDIOCA IFOOD', 97, acomp],
  [11602, 'BRIGADEIRO IFOOD', 52, 'brigadeiro'],
  // MILKSHAKE
  [240, 'MILKSHAKE PISTACHE', 3, 'ignorar: milkshake (fora do escopo por enquanto)'],
  [241, 'MILKSHAKE CAPPUCCINO', 6, 'ignorar: milkshake (fora do escopo por enquanto)'],
  [242, 'MILKSHAKE FRUTAS VERMELHAS', 3, 'ignorar: milkshake (fora do escopo por enquanto)'],
  // REFRIGERANTES
  [352, 'COCA ZERO', 288, bebida],
  [354, 'GUARANA ZERO', 66, bebida],
  [361, 'REFRI NATURAL LIMAO', 25, bebida],
  [362, 'REFRI NATURAL FRUTAS VERMELHAS', 18, bebida],
  [363, 'KOMBUCHA DE FRUTAS VERMELHAS', 5, bebida],
  [353, 'GUARANA', 31, bebida],
  [351, 'COCA', 84, bebida],
  // SALADAS
  [101, 'SALADA CAESAR', 28, 'salada-caesar'],
  [11603, 'SALADA DE PENIL IFOOD', 29, 'salada-pernil'],
  [118, 'SALADA CAPRESE', 9, 'salada-caprese'],
  [119, 'SALADA PERNIL', 9, 'salada-pernil'],
  // SANDUÍCHES
  [102, 'PERNIL ESPECIAL', 99, 'pernil-especial'],
  [103, 'FALAFEL', 35, 'falafel'],
  [104, 'FRANGO', 136, 'frango'],
  [105, 'PERNIL', 104, 'pernil'],
  [106, 'LINGUICA BLUMENAU', 52, 'linguica'],
  [107, 'CARNE DE PANELA', 69, 'carne-panela'],
  [111, 'CAPRESE', 89, 'caprese'],
  [11108, 'COMBO CAIPIRA IFOOD', 11, 'caipira'],
  [11122, 'MIGNON IFOOD', 80, 'mignon'],
  [112, 'CAIPIRA', 90, 'caipira'],
  [113, 'COGUMELO', 39, 'cogumelo'],
  [114, 'FRANGO E BACON', 138, 'frango-bacon'],
  [11605, 'SALADA CAPRESE IFOOD', 16, 'salada-caprese'],
  [117, 'MIGNON', 85, 'mignon'],
  [21, 'COMBO FRANGO E BACON', 75, 'frango-bacon'],
  [22, 'COMBO PERNIL', 74, 'pernil'],
  [23, 'COMBO CAPRESE', 39, 'caprese'],
  // SOBREMESAS
  [109, 'DOCE DE LEITE', 6, 'doce-leite'],
  [115, 'DOCE DE LEITE COM BACON', 5, 'doce-leite-bacon'],
  [602, 'BRIGADEIRO', 26, 'brigadeiro'],
  [603, 'RABANADA', 19, 'rabanada'],
  [605, 'RABANADA BRULEE', 20, 'rabanada-brulee'],
  [608, 'SORVETE ADICIONAL', 3, 'ignorar: sorvete adicional (porção não informada)'],
  // SODAS ITALIANAS
  [221, 'SODA TANGERINA', 35, bebida],
  [222, 'SODA LIMAO SICILIANO', 27, bebida],
  [223, 'SODA TANGERINA COMBO', 3, bebida],
  [224, 'ORANGE FRESH', 3, bebida],
  [225, 'SODA LIMAO COMBO', 5, bebida],
  [226, 'PINK LEMONADE', 25, bebida],
  // SUCOS
  [301, 'SUCO DE LARANJA', 37, bebida],
  // WRAPS
  [132, 'WRAP PERNIL', 13, 'wrap-pernil'],
  [133, 'WRAP CAPRESE', 13, 'wrap-caprese'],
  [134, 'WRAP CAESAR', 42, 'wrap-caesar'],
];

/** Soma por lanche: Map(chave -> { qtd, detalhe }) e lista dos itens ignorados agrupados por motivo. */
export function consolidar(linhas = LINHAS) {
  const porLanche = new Map();
  const ignorados = new Map();
  for (const [codigo, produto, qtd, destino, fator = 1] of linhas) {
    if (destino.startsWith('ignorar:')) {
      const motivo = destino.slice(8).trim();
      const x = ignorados.get(motivo) ?? { motivo, qtd: 0, produtos: [] };
      x.qtd += qtd;
      x.produtos.push(`${produto} (${qtd})`);
      ignorados.set(motivo, x);
    } else {
      const x = porLanche.get(destino) ?? { qtd: 0, partes: [] };
      x.qtd += qtd * fator;
      x.partes.push(`${produto} ${qtd}${fator !== 1 ? ` x${fator}` : ''}`);
      porLanche.set(destino, x);
    }
  }
  return { porLanche, ignorados: [...ignorados.values()] };
}
