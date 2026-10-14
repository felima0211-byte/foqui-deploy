// Motor de cálculo: transforma metas de lanches em lotes a produzir e itens a comprar.
// Funções puras sobre um "modelo" em memória (sem acesso a banco) para facilitar testes.

const EPS = 1e-9;

// Confiança de um número: confirmado (documento/cozinha) < estimado (deduzido) < pendente (falta informar).
const NIVEL = { confirmado: 0, estimado: 1, pendente: 2 };
export const piorConfianca = (a, b) => ((NIVEL[b ?? 'confirmado'] ?? 0) > (NIVEL[a ?? 'confirmado'] ?? 0) ? b : a);

export class ErroDeModelo extends Error {}

/** Lê o banco e monta o modelo em memória. */
export function carregarModelo(db) {
  const itens = new Map();
  for (const r of db.prepare('SELECT * FROM itens').all()) itens.set(r.id, { ...r });

  const receitas = new Map();
  for (const r of db.prepare('SELECT * FROM receitas').all()) {
    receitas.set(r.item_id, {
      itemId: r.item_id,
      rendimento: r.rendimento_qtd,
      fracionavel: !!r.fracionavel,
      linhas: [],
    });
  }
  for (const l of db.prepare('SELECT * FROM receita_ingredientes').all()) {
    receitas.get(l.receita_item_id)?.linhas.push({ itemId: l.item_id, qtd: l.qtd });
  }

  const estoque = new Map();
  for (const r of db.prepare('SELECT item_id, qtd FROM estoque_atual').all()) estoque.set(r.item_id, r.qtd);

  const medidas = new Map();
  for (const r of db.prepare('SELECT * FROM medidas').all()) medidas.set(r.id, { ...r });

  const lanches = [];
  for (const l of db.prepare('SELECT * FROM lanches WHERE ativo = 1 ORDER BY ordem, nome').all()) {
    const componentes = db
      .prepare('SELECT item_id, qtd, medida_id, medida_qtd, confianca, nota FROM lanche_componentes WHERE lanche_id = ?')
      .all(l.id)
      .map((c) => {
        const med = c.medida_id ? medidas.get(c.medida_id) : null;
        return {
          itemId: c.item_id,
          // com medida (ex.: 2 conchas de 85 ml), a quantidade em g vem da medida: se a medida for corrigida, tudo acompanha
          qtd: med ? c.medida_qtd * med.qtd : c.qtd,
          medidaId: med?.id ?? null,
          medidaNome: med?.nome ?? null,
          medidaQtd: med ? c.medida_qtd : null,
          confianca: piorConfianca(c.confianca, med?.confianca),
          nota: c.nota ?? med?.nota ?? null,
        };
      });
    lanches.push({ id: l.id, nome: l.nome, categoria: l.categoria, meta: l.meta_qtd, componentes });
  }
  return { itens, receitas, estoque, lanches, medidas };
}

/**
 * Ordem "pais antes dos filhos": um preparo vem antes dos ingredientes que ele consome.
 * Assim, quando chegamos a um item, toda a demanda dele (de todos os pais) já foi somada.
 * Lança ErroDeModelo se houver ciclo (A usa B e B usa A).
 */
export function ordenarTopologico(modelo) {
  const grau = new Map();
  for (const id of modelo.itens.keys()) grau.set(id, 0);
  for (const r of modelo.receitas.values()) {
    for (const l of r.linhas) grau.set(l.itemId, (grau.get(l.itemId) ?? 0) + 1);
  }
  const fila = [...grau].filter(([, g]) => g === 0).map(([id]) => id);
  const ordem = [];
  while (fila.length) {
    const id = fila.shift();
    ordem.push(id);
    for (const l of modelo.receitas.get(id)?.linhas ?? []) {
      grau.set(l.itemId, grau.get(l.itemId) - 1);
      if (grau.get(l.itemId) === 0) fila.push(l.itemId);
    }
  }
  if (ordem.length !== modelo.itens.size) {
    const presos = [...grau].filter(([, g]) => g > 0).map(([id]) => modelo.itens.get(id)?.nome ?? id);
    throw new ErroDeModelo(`Receitas em ciclo (um preparo depende dele mesmo): ${presos.join(', ')}`);
  }
  return ordem;
}

/** Soma o que as metas pedem: Map(itemId -> qtd). `metas` = [{ lancheId, qtd }]. */
export function demandaDasMetas(modelo, metas) {
  const demanda = new Map();
  for (const m of metas) {
    const lanche = modelo.lanches.find((l) => l.id === m.lancheId);
    if (!lanche || !(m.qtd > 0)) continue;
    for (const c of lanche.componentes) {
      demanda.set(c.itemId, (demanda.get(c.itemId) ?? 0) + m.qtd * c.qtd);
    }
  }
  return demanda;
}

export function metasAtuais(modelo) {
  return modelo.lanches.filter((l) => l.meta > 0).map((l) => ({ lancheId: l.id, qtd: l.meta }));
}

/**
 * Como comprar um insumo: a cozinha mede em g/ml, a compra é em kg/L (ou unidades).
 * Se o item tem embalagem (ex.: catupiry em pacote de 1,5 kg), arredonda para pacotes inteiros;
 * senão, para cima em passos de 0,1 kg (ou 0,1 L); unidades, para cima em unidades inteiras.
 * Retorna valores na unidade de compra: { un, exato, sugerido, embalagens }.
 */
export function sugerirCompra(item, base) {
  const un = item.unidade === 'g' ? 'kg' : item.unidade === 'ml' ? 'L' : item.unidade_label ?? 'un';
  const div = item.unidade === 'un' ? 1 : 1000;
  if (!(base > EPS)) return { un, exato: 0, sugerido: 0, embalagens: null };
  const exato = base / div;
  if (item.embalagem_qtd) {
    const n = Math.ceil(base / item.embalagem_qtd - EPS);
    return {
      un, exato, sugerido: (n * item.embalagem_qtd) / div,
      embalagens: { n, nome: item.embalagem_nome || 'embalagem', tamanho: item.embalagem_qtd / div },
    };
  }
  const passo = item.unidade === 'un' ? 1 : 0.1;
  const sugerido = Math.round(Math.ceil(exato / passo - EPS) * passo * 1000) / 1000;
  return { un, exato, sugerido, embalagens: null };
}

/**
 * Calcula o plano a partir de uma demanda (Map itemId -> qtd).
 *
 * Para cada item, em ordem pais→filhos:
 *   1. desconta o estoque;
 *   2. preparo com receita: calcula lotes (inteiros, ou fracionados se a receita permitir),
 *      registra a sobra do lote e empurra a demanda para os ingredientes;
 *   3. preparo sem receita: vira "produção manual" (o painel avisa que falta cadastrar a receita);
 *   4. insumo: divide pelo aproveitamento e desconta o estoque => quanto comprar.
 */
export function calcularPlano(modelo, demanda) {
  const precisa = new Map(demanda);
  const producao = [];
  const compras = [];
  const semReceita = [];

  for (const id of ordenarTopologico(modelo)) {
    const necessario = precisa.get(id) ?? 0;
    if (necessario <= EPS) continue;
    const item = modelo.itens.get(id);
    const emEstoque = Math.max(0, modelo.estoque.get(id) ?? 0);
    const base = { itemId: id, nome: item.nome, unidade: item.unidade, unidadeLabel: item.unidade_label, categoria: item.categoria };

    if (item.tipo === 'preparo' && modelo.receitas.has(id)) {
      const rec = modelo.receitas.get(id);
      const usaEstoque = Math.min(emEstoque, necessario);
      const liquido = necessario - usaEstoque;
      let lotes = 0;
      if (liquido > EPS) lotes = rec.fracionavel ? liquido / rec.rendimento : Math.ceil(liquido / rec.rendimento - EPS);
      const produzido = lotes * rec.rendimento;
      for (const l of rec.linhas) precisa.set(l.itemId, (precisa.get(l.itemId) ?? 0) + lotes * l.qtd);
      producao.push({
        ...base,
        necessario,
        estoque: emEstoque,
        usaEstoque,
        aProduzir: liquido,
        lotes,
        rendimentoLote: rec.rendimento,
        fracionavel: rec.fracionavel,
        produzido,
        sobra: Math.max(0, produzido - liquido),
      });
    } else if (item.tipo === 'preparo') {
      const falta = Math.max(0, necessario - emEstoque);
      semReceita.push({ ...base, necessario, estoque: emEstoque, falta });
    } else {
      const aprov = item.aproveitamento || 1;
      const bruto = necessario / aprov;
      const comprar = Math.max(0, bruto - emEstoque);
      compras.push({
        ...base,
        necessario,
        aproveitamento: aprov,
        bruto,
        estoque: emEstoque,
        comprar,
        compra: sugerirCompra(item, comprar),
      });
    }
  }

  // Ordem de produção: o que é ingrediente de outro preparo precisa ficar pronto antes.
  producao.reverse();
  const nome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');
  compras.sort(nome);
  semReceita.sort(nome);

  return {
    producao,
    compras,
    semReceita,
    viavel: compras.every((c) => c.comprar <= EPS) && semReceita.every((s) => s.falta <= EPS),
  };
}

/**
 * Dados que ainda não são firmes e entram na conta dos lanches com meta:
 * 'estimado' (deduzido, pesar para confirmar) e 'pendente' (a cozinha não informou; entra como 0).
 */
export function pendenciasDasMetas(modelo, metas = metasAtuais(modelo)) {
  const ativos = new Set(metas.filter((m) => m.qtd > 0).map((m) => m.lancheId));
  const mapa = new Map();
  for (const l of modelo.lanches) {
    if (!ativos.has(l.id)) continue;
    for (const c of l.componentes) {
      if (c.confianca === 'confirmado') continue;
      const chave = `${c.itemId}|${c.medidaId ?? ''}|${c.confianca}`;
      if (!mapa.has(chave)) {
        mapa.set(chave, { itemId: c.itemId, nome: modelo.itens.get(c.itemId)?.nome ?? '?', medida: c.medidaNome, confianca: c.confianca, nota: c.nota, lanches: [] });
      }
      mapa.get(chave).lanches.push(l.nome);
    }
  }
  return [...mapa.values()].sort((a, b) => (NIVEL[b.confianca] - NIVEL[a.confianca]) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function planoDasMetas(modelo, metas = metasAtuais(modelo)) {
  const plano = calcularPlano(modelo, demandaDasMetas(modelo, metas));
  const totalLanches = metas.reduce((s, m) => s + (m.qtd > 0 ? m.qtd : 0), 0);
  return { totalLanches, metas, ...plano, pendencias: pendenciasDasMetas(modelo, metas) };
}

/**
 * Sugere metas a partir das vendas de um período. `linhas` = [{ lancheId, categoria, qtd }] (vendas do período).
 *  modo 'dias':  média diária x dias x fator (ex.: 3 dias, fator 1,2 = 20% de folga).
 *  modo 'total': distribui `total` lanches (sanduíches, wraps, saladas e sobremesas) na proporção das vendas,
 *                fechando exatamente no total (maior resto); adicionais acompanham a mesma proporção.
 * Retorna Map(lancheId -> meta).
 */
export function sugerirMetas(linhas, { modo, dias, total, fator = 1, diasPeriodo }) {
  const metas = new Map();
  if (modo === 'dias') {
    if (!(dias > 0) || !(diasPeriodo > 0) || !(fator > 0)) throw new ErroDeModelo('Informe dias e fator maiores que zero.');
    for (const l of linhas) metas.set(l.lancheId, Math.round(((l.qtd / diasPeriodo) * dias * fator) + EPS));
    return metas;
  }
  if (modo === 'total') {
    const alvo = Math.round(total);
    if (!(alvo >= 0)) throw new ErroDeModelo('Informe um total de lanches (zero ou mais).');
    const principais = linhas.filter((l) => l.categoria !== 'Adicional');
    const soma = principais.reduce((s, l) => s + l.qtd, 0);
    if (!(soma > 0)) throw new ErroDeModelo('Não há vendas para distribuir.');
    const f = alvo / soma;
    const parcelas = principais.map((l) => {
      const v = l.qtd * f;
      const n = Math.floor(v + EPS);
      return { id: l.lancheId, n, resto: v - n };
    });
    let faltam = alvo - parcelas.reduce((s, p) => s + p.n, 0);
    for (const p of [...parcelas].sort((a, b) => b.resto - a.resto)) {
      if (faltam <= 0) break;
      p.n += 1;
      faltam -= 1;
    }
    for (const p of parcelas) metas.set(p.id, p.n);
    for (const l of linhas.filter((x) => x.categoria === 'Adicional')) metas.set(l.lancheId, Math.round(l.qtd * f + EPS));
    return metas;
  }
  throw new ErroDeModelo('Modo inválido: use "dias" ou "total".');
}

/**
 * Quantos lanches de cada tipo dá para fazer:
 *  - prontos:  só com o que já está em estoque nos componentes (sem produzir nada);
 *  - possivel: produzindo os preparos a partir dos insumos em estoque (null = sem limite / sem componentes).
 */
export function capacidade(modelo) {
  return modelo.lanches.map((l) => {
    if (!l.componentes.length) return { lancheId: l.id, nome: l.nome, categoria: l.categoria, prontos: null, possivel: null, limitante: null };

    let prontos = Infinity;
    let limitante = null;
    for (const c of l.componentes) {
      if (!(c.qtd > 0)) continue; // quantidade pendente (0): não limita
      const item = modelo.itens.get(c.itemId);
      const usavel = Math.max(0, modelo.estoque.get(c.itemId) ?? 0) * (item.tipo === 'insumo' ? item.aproveitamento || 1 : 1);
      const n = Math.floor(usavel / c.qtd + EPS);
      if (n < prontos) {
        prontos = n;
        limitante = item.nome;
      }
    }

    if (prontos === Infinity) return { lancheId: l.id, nome: l.nome, categoria: l.categoria, prontos: null, possivel: null, limitante: null };

    const cabe = (n) => calcularPlano(modelo, demandaDasMetas(modelo, [{ lancheId: l.id, qtd: n }])).viavel;
    let possivel = 0;
    if (cabe(1)) {
      let baixo = 1;
      let alto = 2;
      while (alto <= 1_000_000 && cabe(alto)) {
        baixo = alto;
        alto *= 2;
      }
      if (alto > 1_000_000) possivel = null;
      else {
        while (alto - baixo > 1) {
          const meio = Math.floor((baixo + alto) / 2);
          if (cabe(meio)) baixo = meio;
          else alto = meio;
        }
        possivel = baixo;
      }
    }
    return { lancheId: l.id, nome: l.nome, categoria: l.categoria, prontos, possivel, limitante };
  });
}

/** Confere receitas: rendimento x soma dos ingredientes, porções, itens sem dado. */
export function auditar(modelo) {
  const achados = [];
  for (const [id, rec] of modelo.receitas) {
    const item = modelo.itens.get(id);
    let massa = 0;
    for (const l of rec.linhas) {
      const ing = modelo.itens.get(l.itemId);
      if (ing && ing.unidade !== 'un' && item.unidade !== 'un') massa += l.qtd;
    }
    const razao = massa > 0 ? rec.rendimento / massa : null;
    const porcoes = item.porcao_qtd ? rec.rendimento / item.porcao_qtd : null;
    const notas = [];
    if (!rec.linhas.length) notas.push('Receita sem ingredientes.');
    if (razao !== null && razao > 1.05) notas.push('Rendimento maior que a soma dos ingredientes (confira).');
    if (razao !== null && razao < 0.2) notas.push('Rendimento menor que 20% dos ingredientes (confira perda ou casa decimal).');
    if (!item.porcao_qtd) notas.push('Sem peso de porção definido.');
    achados.push({
      itemId: id,
      nome: item.nome,
      unidade: item.unidade,
      rendimento: rec.rendimento,
      somaIngredientes: massa || null,
      aproveitamentoDoLote: razao,
      porcoesPorLote: porcoes,
      notas,
      avisosDaFonte: item.avisos || null,
    });
  }
  const semReceita = [...modelo.itens.values()]
    .filter((i) => i.tipo === 'preparo' && !modelo.receitas.has(i.id))
    .map((i) => ({ itemId: i.id, nome: i.nome, avisos: i.avisos }));
  return { receitas: achados.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), semReceita };
}

/** Valida estrutura sem executar nada (usado antes de gravar uma receita). */
export function validarSemCiclo(modelo) {
  ordenarTopologico(modelo);
}
