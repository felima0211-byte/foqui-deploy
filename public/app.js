// Painel Foqui Tech: JavaScript puro, sem build. Fala com a API em /api.

const $ = (s) => document.querySelector(s);
const view = $('#view');
const S = { area: 'op', aba: 'producao', opAba: 'finalizacao', itens: [], recSel: null, estTipo: 'insumo', abertos: new Set(), medSo: false };
const CATS = ['Sanduíche', 'Wrap', 'Salada', 'Sobremesa', 'Adicional', 'Outros'];
const PLURAL = { Sanduíche: 'Sanduíches', Wrap: 'Wraps', Salada: 'Saladas', Sobremesa: 'Sobremesas', Adicional: 'Adicionais', Outros: 'Outros' };
const porCategoria = (lista, chave = (x) => x.categoria) =>
  CATS.map((c) => [c, lista.filter((x) => (chave(x) || 'Outros') === c)]).filter(([, l]) => l.length);

// ── Utilitários ───────────────────────────────────────────────────────────
function h(tag, props = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat(Infinity)) {
    if (f === null || f === undefined || f === false) continue;
    add(el, f.nodeType ? f : document.createTextNode(String(f)));
  }
  return el;
}

// append/replaceChildren convertem null em o texto "null"; estes ignoram vazios.
const limpos = (f) => f.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false);
const add = (el, ...f) => el.append(...limpos(f));
const reset = (el, ...f) => el.replaceChildren(...limpos(f));

const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const num = (v) => {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};
const rotuloUn = (it) => it.unidade_label ?? it.unidadeLabel ?? 'un';
function qtd(n, it) {
  if (it.unidade === 'g') return n >= 1000 ? `${nf2.format(n / 1000)} kg` : `${nf1.format(n)} g`;
  if (it.unidade === 'ml') return n >= 1000 ? `${nf2.format(n / 1000)} L` : `${nf1.format(n)} ml`;
  return `${nf1.format(n)} ${rotuloUn(it)}`;
}
const sufixo = (it) => (it.unidade === 'un' ? rotuloUn(it) : it.unidade);

// Compra: sempre em kg/L (ou pacotes, se o item tem embalagem). `c.compra` vem do motor de cálculo.
function compraTxt(c) {
  const k = c.compra;
  if (!k) return qtd(c.comprar, c);
  if (k.embalagens) {
    const e = k.embalagens;
    const nome = e.n > 1 ? (e.nome.endsWith('m') ? `${e.nome.slice(0, -1)}ns` : `${e.nome}s`) : e.nome;
    return `${e.n} ${nome} de ${nf2.format(e.tamanho)} ${k.un}`;
  }
  return `${nf2.format(k.sugerido)} ${k.un}`;
}
const exatoTxt = (c) => (c.compra ? `${nf2.format(c.compra.exato)} ${c.compra.un}` : qtd(c.comprar, c));
const pillConf = (conf) => (conf === 'pendente' ? h('span', { class: 'pill bad' }, 'pendente') : conf === 'estimado' ? h('span', { class: 'pill warn' }, 'estimado') : null);

let timerToast;
function aviso(msg, erro = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = erro ? 'erro' : '';
  t.hidden = false;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => (t.hidden = true), erro ? 6000 : 2500);
}

async function api(metodo, caminho, corpo) {
  const r = await fetch(caminho.startsWith('/api') ? caminho : '/api' + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const json = (r.headers.get('content-type') || '').includes('json') ? await r.json() : null;
  if (!r.ok) throw new Error(json?.erro || `Erro ${r.status}`);
  return json;
}
async function seguro(fn) {
  try {
    return await fn();
  } catch (e) {
    aviso(e.message, true);
  }
}
function debounce(fn, ms = 350) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

async function carregarItens() {
  S.itens = await api('GET', '/itens');
}
function opcoesDeItens(selecionado, excluirId) {
  const grupo = (tipo, rot) =>
    h('optgroup', { label: rot }, S.itens.filter((i) => i.tipo === tipo && i.id !== excluirId).map((i) => h('option', { value: i.id, selected: i.id === selecionado }, `${i.nome} (${sufixo(i)})`)));
  return [grupo('preparo', 'Preparos'), grupo('insumo', 'Insumos')];
}

async function atualizarBadge() {
  try {
    const c = await api('GET', '/compras');
    $('#badge').textContent = c.comprar.filter((x) => !x.marcado).length;
  } catch {
    /* sem rede: ignora */
  }
}

// ── Produção ──────────────────────────────────────────────────────────────
async function viewProducao(el) {
  const [lanchesTodos, vendas] = await Promise.all([api('GET', '/lanches'), api('GET', '/vendas')]);
  const lanches = lanchesTodos.filter((l) => l.ativo);
  const porDia = new Map(vendas.linhas.map((l) => [l.lanche_id, l.porDia]));
  const resultados = h('div');

  async function atualizar() {
    const [plano, cap] = await Promise.all([api('GET', '/plano'), api('GET', '/capacidade')]);
    reset(resultados, ...desenharResultados(plano, cap));
    atualizarBadge();
  }
  const salvadores = new Map();
  const salvarMeta = (l, v) => {
    if (!salvadores.has(l.id)) salvadores.set(l.id, debounce((valor) => seguro(async () => { await api('PUT', `/lanches/${l.id}`, { meta_qtd: valor }); await atualizar(); })));
    salvadores.get(l.id)(v);
  };

  // Sugestão pelas vendas (período do relatório do caixa)
  const dias = h('input', { class: 'w-sm', type: 'number', min: 1, step: 1, value: 1, 'aria-label': 'Quantos dias', inputMode: 'numeric' });
  const folga = h('input', { class: 'w-sm', type: 'number', min: 0, step: 5, value: 0, 'aria-label': 'Folga em %', inputMode: 'numeric' });
  const total = h('input', { class: 'w-num', type: 'number', min: 1, step: 1, value: 100, 'aria-label': 'Total de lanches', inputMode: 'numeric' });
  const sugerir = (corpo) => seguro(async () => { await api('POST', '/metas/sugerir', { ...corpo, aplicar: true }); ir('painel', 'producao'); });
  const caixaVendas = vendas.periodo
    ? h('div', { class: 'panel' },
        h('h2', {}, 'Preencher metas pelas vendas'),
        h('p', { class: 'hint' }, `Usa o mix de vendas de ${vendas.periodo.rotulo} (${nf1.format(vendas.totalPrincipal)} lanches em ${vendas.periodo.dias} dias, ${nf1.format(vendas.totalPrincipal / vendas.periodo.dias)} por dia, fora os adicionais). Depois você pode ajustar cada meta abaixo.`),
        h('div', { class: 'row quebra' },
          h('span', {}, 'Planejar'), dias, h('span', {}, 'dia(s), com folga de'), folga, h('span', {}, '%'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => {
            const d = num(dias.value);
            const f = num(folga.value);
            if (!(d > 0) || !(f >= 0)) return aviso('Informe os dias (maior que 0) e a folga (0 ou mais).', true);
            sugerir({ modo: 'dias', dias: d, fator: 1 + f / 100 });
          } }, 'Preencher')),
        h('div', { class: 'row quebra' },
          h('span', {}, 'ou fechar em'), total, h('span', {}, 'lanches no total, no mix de vendas'),
          h('button', { class: 'btn', type: 'button', onclick: () => {
            const t = num(total.value);
            if (!(t > 0)) return aviso('Informe o total de lanches.', true);
            sugerir({ modo: 'total', total: t });
          } }, 'Distribuir'),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => seguro(async () => { await api('POST', '/metas/zerar'); ir('painel', 'producao'); }) }, 'Zerar metas')))
    : null;

  const linhaMeta = (l) => h('div', { class: 'row' },
    h('label', { class: 'grow', for: `m-${l.id}` }, h('b', {}, l.nome), porDia.has(l.id) ? h('span', { class: 'small' }, ` média ${nf1.format(porDia.get(l.id))}/dia`) : null),
    h('input', { class: 'w-num', id: `m-${l.id}`, type: 'number', min: 0, step: 1, inputMode: 'numeric', value: l.meta_qtd,
      oninput: (e) => { const v = Math.round(num(e.target.value)); if (v >= 0) salvarMeta(l, v); } }));

  add(el,
    caixaVendas,
    h('div', { class: 'panel' },
      h('h2', {}, 'Meta de produção'),
      h('p', { class: 'hint' }, 'Quantos lanches de cada tipo você quer ter prontos? A produção e a Lista de Compras se atualizam sozinhas.'),
      lanches.length
        ? porCategoria(lanches).map(([cat, lista]) => h('details', { class: 'grupo-meta', open: cat !== 'Adicional' || lista.some((x) => x.meta_qtd > 0) },
            h('summary', {}, PLURAL[cat], h('span', { class: 'small' }, ` (${lista.length})`)),
            lista.map(linhaMeta)))
        : h('div', { class: 'empty' }, 'Nenhum lanche cadastrado. ', h('button', { class: 'btn small', onclick: () => ir('painel', 'lanches') }, 'Cadastrar lanches'))),
    resultados
  );
  await atualizar();
}

function desenharPendencias(lista, titulo, aberto = false) {
  if (!lista.length) return null;
  const pend = lista.filter((p) => p.confianca === 'pendente').length;
  const est = lista.length - pend;
  return h('details', { class: 'panel pend', open: aberto },
    h('summary', {}, h('b', {}, titulo), ` ${pend ? `${pend} pendente(s)` : ''}${pend && est ? ' e ' : ''}${est ? `${est} estimado(s)` : ''}`),
    h('p', { class: 'hint' }, 'Pendente = a cozinha ainda não informou (entra como zero na conta). Estimado = deduzido; pesar para confirmar. Corrija na aba Medidas ou em Lanches.'),
    lista.map((p) => h('div', { class: 'pend-item' },
      pillConf(p.confianca), ' ', h('b', {}, p.nome), p.medida ? h('span', { class: 'small' }, ` (${p.medida})`) : null,
      p.nota ? h('div', { class: 'small' }, p.nota) : null,
      h('div', { class: 'small' }, `Usado em: ${[...new Set(p.lanches)].join(', ')}`))));
}

function desenharResultados(plano, cap) {
  const nos = [];
  const aProduzir = plano.producao.filter((p) => p.lotes > 1e-9);
  const aComprar = plano.compras.filter((c) => c.comprar > 1e-9);
  nos.push(
    h('div', { class: 'big' },
      h('div', { class: 'stat' }, h('b', {}, nf1.format(plano.totalLanches)), h('span', {}, 'lanches a produzir')),
      h('div', { class: 'stat' }, h('b', {}, aProduzir.length), h('span', {}, 'preparos para fazer')),
      h('div', { class: 'stat' }, h('b', {}, aComprar.length), h('span', {}, 'itens para comprar (veja a Lista de Compras)')))
  );

  if (plano.semReceita.some((s) => s.falta > 1e-9)) {
    nos.push(
      h('div', { class: 'alert' }, h('b', {}, 'Faltam receitas: '),
        plano.semReceita.filter((s) => s.falta > 1e-9).map((s) => `${s.nome} (precisa de ${qtd(s.falta, s)})`).join('; '),
        '. Cadastre na aba Receitas ou dê entrada no estoque.')
    );
  }
  nos.push(desenharPendencias(plano.pendencias, 'Atenção: esta conta usa dados ainda não confirmados.'));

  const temEstoque = cap.some((c) => (c.prontos ?? 0) > 0 || (c.possivel ?? 0) > 0);
  nos.push(
    h('div', { class: 'panel' },
      h('h2', {}, 'O que produzir'),
      h('p', { class: 'hint' }, 'Na ordem de preparo: o que é ingrediente de outro preparo vem primeiro. Lote inteiro, exceto receitas marcadas como fracionáveis.'),
      plano.producao.length
        ? h('div', { class: 'scroll' }, h('table', {},
            h('thead', {}, h('tr', {}, ['Preparo', 'Preciso', 'Do estoque', 'Lotes', 'Vai sobrar'].map((t, i) => h('th', { class: i && i < 5 ? 'n' : '' }, t)))),
            h('tbody', {}, plano.producao.map((p) => h('tr', {},
              h('td', {}, h('b', {}, p.nome), h('div', { class: 'small' }, `1 lote rende ${qtd(p.rendimentoLote, p)}`)),
              h('td', { class: 'n' }, qtd(p.necessario, p)),
              h('td', { class: 'n' }, p.usaEstoque > 0 ? qtd(p.usaEstoque, p) : '—'),
              h('td', { class: 'n' }, p.lotes > 1e-9 ? h('b', {}, nf2.format(p.lotes)) : h('span', { class: 'pill ok' }, 'estoque cobre')),
              h('td', { class: 'n' }, p.sobra > 1e-9 ? qtd(p.sobra, p) : '—'))))))
        : h('div', { class: 'empty' }, plano.totalLanches ? 'Nada a produzir: o estoque cobre tudo.' : 'Defina a meta de algum lanche acima para ver a conta.')),
    h('details', { class: 'panel', open: temEstoque },
      h('summary', {}, h('h2', { class: 'inline' }, 'Quantos lanches dá para fazer')),
      h('p', { class: 'hint' }, '"Prontos agora" usa só o que já está pronto no estoque. "Produzindo" também usa os insumos em estoque para fazer os preparos. Cada lanche é calculado sozinho. Informe o estoque na aba Estoque.'),
      cap.length
        ? h('div', { class: 'scroll' }, h('table', {},
            h('thead', {}, h('tr', {}, h('th', {}, 'Lanche'), h('th', { class: 'n' }, 'Prontos agora'), h('th', { class: 'n' }, 'Produzindo'), h('th', {}, 'Acaba primeiro (prontos)'))),
            h('tbody', {}, cap.map((c) => h('tr', {},
              h('td', {}, c.nome),
              h('td', { class: 'n' }, c.prontos === null ? '—' : h('b', {}, c.prontos)),
              h('td', { class: 'n' }, c.possivel === null ? (c.prontos === null ? '—' : 'sem limite') : h('b', {}, c.possivel)),
              h('td', {}, c.limitante ?? '—'))))))
        : h('div', { class: 'empty' }, 'Nenhum lanche cadastrado.'))
  );
  return nos;
}

// ── Lanches ───────────────────────────────────────────────────────────────
async function viewLanches(el) {
  await carregarItens();
  const lanches = await api('GET', '/lanches');
  const refazer = () => ir('painel', 'lanches');
  add(el, h('p', { class: 'hint' }, 'O que vai em UM lanche, como nas linhas de montagem. Escolha a medida (concha, tira, fatia) ou use gramas: o painel converte para gramas e a compra sai em kg. Linhas marcadas como "estimado" ou "pendente" precisam de confirmação da cozinha.'));

  for (const [cat, lista] of porCategoria(lanches)) {
    add(el, h('h2', { class: 'cat' }, PLURAL[cat]));
    for (const l of lista) add(el, cartaoLanche(l, refazer));
  }

  const campo = h('input', { placeholder: 'Nome do novo lanche', 'aria-label': 'Nome do novo lanche' });
  const cat = h('select', { class: 'w-med', 'aria-label': 'Categoria' }, CATS.map((c) => h('option', { value: c }, c)));
  add(el, h('div', { class: 'row quebra' }, campo, cat,
    h('button', { class: 'btn primary', type: 'button', onclick: () => seguro(async () => { await api('POST', '/lanches', { nome: campo.value, categoria: cat.value }); refazer(); }) }, 'Novo lanche')));
}

function cartaoLanche(l, refazer) {
  const comps = l.componentes.map((c) => ({ item_id: c.item_id, qtd: c.qtd, medida_id: c.medida_id, medida_qtd: c.medida_qtd, confianca: c.conf_linha, nota: c.nota_linha }));
  const salvar = () => api('PUT', `/lanches/${l.id}`, {
    componentes: comps.map((c) => ({
      item_id: c.item_id, medida_id: c.medida_id || undefined, medida_qtd: c.medida_id ? c.medida_qtd : undefined,
      qtd: c.medida_id ? undefined : c.qtd, confianca: c.confianca, nota: c.nota,
    })),
  });
  const aviso1 = l.componentes.filter((c) => c.confianca !== 'confirmado');
  const pend = aviso1.filter((c) => c.confianca === 'pendente').length;

  const linha = (c, i) => {
    const it = S.itens.find((x) => x.id === c.item_id);
    const medidas = it?.medidas ?? [];
    const med = medidas.find((m) => m.id === c.medida_id);
    const efetiva = l.componentes[i]?.confianca;
    return h('div', { class: 'comp' },
      h('div', { class: 'row' },
        h('select', { class: 'grow', 'aria-label': 'Item', onchange: (e) => seguro(async () => {
          const novo = S.itens.find((x) => x.id === Number(e.target.value));
          Object.assign(c, { item_id: novo.id, medida_id: null, medida_qtd: null, qtd: novo.porcao_qtd ?? 1, confianca: 'confirmado', nota: null });
          await salvar(); refazer();
        }) }, opcoesDeItens(c.item_id)),
        h('input', { class: 'w-num', type: 'number', min: 0, step: 'any', value: c.medida_id ? c.medida_qtd : c.qtd, 'aria-label': 'Quantidade', inputMode: 'decimal',
          onchange: async (e) => {
            const ok = await seguro(async () => {
              const v = num(e.target.value);
              if (!(v > 0)) throw new Error('A quantidade precisa ser maior que zero.');
              if (c.medida_id) c.medida_qtd = v; else c.qtd = v;
              c.confianca = 'confirmado'; // quem digita está informando o valor
              await salvar(); aviso('Salvo'); return true;
            });
            refazer();
            return ok;
          } }),
        h('select', { class: 'w-med', 'aria-label': 'Medida', onchange: (e) => seguro(async () => {
          const id = e.target.value ? Number(e.target.value) : null;
          if (id) { c.medida_id = id; c.medida_qtd = c.medida_qtd || 1; } else { c.qtd = c.medida_id && med ? c.medida_qtd * med.qtd : c.qtd; c.medida_id = null; c.medida_qtd = null; }
          await salvar(); refazer();
        }) }, h('option', { value: '' }, it ? sufixo(it) : ''), medidas.map((m) => h('option', { value: m.id, selected: m.id === c.medida_id }, m.nome))),
        h('button', { class: 'btn x', type: 'button', 'aria-label': 'Remover item', onclick: () => seguro(async () => { comps.splice(i, 1); await salvar(); refazer(); }) }, '×')),
      h('div', { class: 'small linha-info' },
        c.medida_id && med ? `= ${qtd(c.medida_qtd * med.qtd, it)}` : null, ' ',
        pillConf(efetiva), ' ', l.componentes[i]?.nota ?? null));
  };

  return h('details', { class: 'lanche', open: S.abertos.has(l.id), ontoggle: (e) => (e.target.open ? S.abertos.add(l.id) : S.abertos.delete(l.id)) },
    h('summary', {}, h('b', {}, l.nome), h('span', { class: 'small' }, ` ${comps.length} ${comps.length === 1 ? "item" : "itens"}`), pend ? h('span', { class: 'pill bad' }, `${pend} pendente(s)`) : aviso1.length ? h('span', { class: 'pill warn' }, `${aviso1.length} estimado(s)`) : null),
    h('div', { class: 'row top' },
      h('input', { class: 'grow', value: l.nome, 'aria-label': 'Nome do lanche', onchange: (e) => seguro(async () => { await api('PUT', `/lanches/${l.id}`, { nome: e.target.value }); aviso('Nome salvo'); }).then(refazer) }),
      h('select', { class: 'w-med', 'aria-label': 'Categoria', onchange: (e) => seguro(async () => { await api('PUT', `/lanches/${l.id}`, { categoria: e.target.value }); refazer(); }) },
        CATS.map((c) => h('option', { value: c, selected: c === l.categoria }, c))),
      h('button', { class: 'btn x', type: 'button', 'aria-label': 'Excluir lanche', onclick: () => confirm(`Excluir "${l.nome}"?`) && seguro(async () => { await api('DELETE', `/lanches/${l.id}`); refazer(); }) }, '×')),
    comps.length ? null : h('div', { class: 'empty' }, 'Sem itens ainda.'),
    comps.map(linha),
    h('div', { class: 'actions' },
      h('button', { class: 'btn small', type: 'button', onclick: () => seguro(async () => {
        const usados = new Set(comps.map((c) => c.item_id));
        const livre = S.itens.find((i) => i.tipo === 'preparo' && !usados.has(i.id)) ?? S.itens.find((i) => !usados.has(i.id));
        if (!livre) throw new Error('Não há mais itens para adicionar.');
        comps.push({ item_id: livre.id, qtd: livre.porcao_qtd ?? 1, medida_id: null, medida_qtd: null, confianca: 'confirmado', nota: null });
        S.abertos.add(l.id);
        await salvar();
        refazer();
      }) }, 'Adicionar item')));
}

// ── Medidas (concha -> gramas) ────────────────────────────────────────────
async function viewMedidas(el) {
  await carregarItens();
  const todas = await api('GET', '/medidas');
  const refazer = () => ir('painel', 'medidas');
  const lista = S.medSo ? todas.filter((m) => m.confianca !== 'confirmado') : todas;
  const faltam = todas.filter((m) => m.confianca !== 'confirmado').length;

  const linha = (m) => h('tr', {},
    h('td', {}, h('b', {}, m.item_nome), h('div', { class: 'small' }, m.nome)),
    h('td', { class: 'n' }, h('div', { class: 'row', style: 'margin:0;justify-content:flex-end' },
      h('input', { class: 'w-num', type: 'number', min: 0, step: 'any', value: m.qtd, 'aria-label': `Quanto vale ${m.nome} de ${m.item_nome}`, inputMode: 'decimal',
        onchange: (e) => seguro(async () => { const v = num(e.target.value); if (!(v > 0)) throw new Error('O valor precisa ser maior que zero.'); await api('PUT', `/medidas/${m.id}`, { qtd: v }); aviso('Medida salva: lanches e compras já foram recalculados'); }).then(refazer) }),
      h('span', { class: 'unit' }, m.unidade === 'un' ? (m.unidade_label ?? 'un') : m.unidade))),
    h('td', {}, pillConf(m.confianca) ?? h('span', { class: 'pill ok' }, 'confirmado'),
      m.confianca !== 'confirmado' ? h('button', { class: 'btn small', type: 'button', style: 'margin-left:8px', onclick: () => seguro(async () => { await api('PUT', `/medidas/${m.id}`, { confianca: 'confirmado' }); refazer(); }) }, 'Confirmar') : null),
    h('td', {}, h('div', { class: 'small' }, m.nota ?? ''), h('div', { class: 'small' }, `${m.usos} uso(s) em lanches`)),
    h('td', {}, m.usos ? null : h('button', { class: 'btn x', type: 'button', 'aria-label': 'Excluir medida', onclick: () => seguro(async () => { await api('DELETE', `/medidas/${m.id}`); refazer(); }) }, '×')));

  const item = h('select', { class: 'grow', 'aria-label': 'Item' }, S.itens.map((i) => h('option', { value: i.id }, `${i.nome} (${sufixo(i)})`)));
  const nome = h('input', { placeholder: 'Nome (ex.: Concha 100 ml)', 'aria-label': 'Nome da medida' });
  const val = h('input', { class: 'w-num', type: 'number', min: 0, step: 'any', placeholder: 'vale', 'aria-label': 'Quanto vale', inputMode: 'decimal' });

  add(el,
    h('div', { class: 'panel' },
      h('h2', {}, 'Medidas: da concha para a balança'),
      h('p', { class: 'hint' }, 'A cozinha mede em concha (ml), tira ou fatia, mas a compra é em kg. Aqui fica quanto cada medida pesa de verdade (ex.: concha de 85 ml de muçarela = 50 g). Pese a concha 3 vezes, tire a média e digite: todos os lanches, a produção e a Lista de Compras se atualizam.'),
      h('div', { class: 'row quebra' },
        h('button', { class: 'btn small' + (S.medSo ? ' primary' : ''), type: 'button', onclick: () => { S.medSo = !S.medSo; refazer(); } }, `Só o que falta pesar (${faltam})`)),
      lista.length
        ? h('div', { class: 'scroll' }, h('table', {},
            h('thead', {}, h('tr', {}, h('th', {}, 'Item / medida'), h('th', { class: 'n' }, 'Vale'), h('th', {}, 'Situação'), h('th', {}, 'Observação'), h('th', {}, ''))),
            h('tbody', {}, lista.map(linha))))
        : h('div', { class: 'empty' }, 'Tudo confirmado.')),
    h('div', { class: 'panel' }, h('h3', {}, 'Nova medida'),
      h('div', { class: 'row quebra' }, item, nome, val,
        h('button', { class: 'btn primary', type: 'button', onclick: () => seguro(async () => { await api('POST', '/medidas', { item_id: item.value, nome: nome.value, qtd: val.value }); refazer(); }) }, 'Criar')))
  );
}

// ── Receitas ──────────────────────────────────────────────────────────────
async function viewReceitas(el) {
  await carregarItens();
  const preparos = S.itens.filter((i) => i.tipo === 'preparo');
  if (!S.recSel || !preparos.some((p) => p.id === S.recSel)) S.recSel = preparos[0]?.id ?? null;
  const detalhe = h('div', { class: 'panel' });
  const categorias = [...new Set(preparos.map((p) => p.categoria || 'Sem categoria'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const lista = h('div', { class: 'panel list' },
    categorias.map((cat) => [
      h('div', { class: 'grupo' }, cat),
      preparos.filter((p) => (p.categoria || 'Sem categoria') === cat).map((p) =>
        h('button', { type: 'button', 'aria-current': p.id === S.recSel ? 'true' : null, onclick: () => { S.recSel = p.id; ir('painel', 'receitas'); } },
          h('span', {}, p.nome), p.tem_receita ? null : h('span', { class: 'pill warn' }, 'sem receita'))),
    ]));

  const nome = h('input', { placeholder: 'Nome do novo preparo', 'aria-label': 'Nome do novo preparo' });
  const un = h('select', { 'aria-label': 'Unidade' }, ['g', 'ml', 'un'].map((u) => h('option', { value: u }, u)));
  const novo = h('div', { class: 'panel' }, h('h3', {}, 'Novo preparo'),
    h('div', { class: 'row' }, nome, h('div', { class: 'w-sm' }, un)),
    h('button', { class: 'btn small', type: 'button', onclick: () => seguro(async () => { const n = await api('POST', '/itens', { nome: nome.value, tipo: 'preparo', unidade: un.value }); S.recSel = n.id; ir('painel', 'receitas'); }) }, 'Criar'));

  add(el, h('div', { class: 'split' }, h('div', {}, novo, lista), detalhe));
  if (S.recSel) await desenharReceita(detalhe, S.recSel);
  else detalhe.append(h('div', { class: 'empty' }, 'Nenhum preparo cadastrado.'));
}

async function desenharReceita(box, itemId) {
  const d = await api('GET', `/receitas/${itemId}`);
  const it = d.item;
  const ings = d.ingredientes.map((l) => ({ item_id: l.item_id, qtd: l.qtd, obs: l.obs ?? '' }));
  const rend = h('input', { class: 'w-num', type: 'number', min: 0, step: 'any', value: d.receita?.rendimento_qtd ?? '', 'aria-label': 'Rendimento do lote', inputMode: 'decimal' });
  const frac = h('input', { type: 'checkbox', checked: !!d.receita?.fracionavel, id: 'frac' });
  const porcao = h('input', { class: 'w-num', type: 'number', min: 0, step: 'any', value: it.porcao_qtd ?? '', 'aria-label': 'Porção padrão', inputMode: 'decimal' });
  const linhas = h('div');

  function desenharLinhas() {
    linhas.replaceChildren(...ings.map((l, i) => {
      const ing = S.itens.find((x) => x.id === l.item_id);
      return h('div', { class: 'row' },
        h('select', { class: 'grow', 'aria-label': 'Ingrediente', onchange: (e) => { l.item_id = Number(e.target.value); desenharLinhas(); } }, opcoesDeItens(l.item_id, itemId)),
        h('input', { class: 'w-num', type: 'number', min: 0, step: 'any', value: l.qtd, 'aria-label': 'Quantidade por lote', inputMode: 'decimal', oninput: (e) => (l.qtd = num(e.target.value)) }),
        h('span', { class: 'unit' }, ing ? sufixo(ing) : ''),
        h('input', { class: 'w-num', placeholder: 'obs.', value: l.obs, 'aria-label': 'Observação', oninput: (e) => (l.obs = e.target.value) }),
        h('button', { class: 'btn x', type: 'button', 'aria-label': 'Remover ingrediente', onclick: () => { ings.splice(i, 1); desenharLinhas(); } }, '×'));
    }));
  }
  desenharLinhas();

  const salvar = () => seguro(async () => {
    const r = num(rend.value);
    if (!(r > 0)) throw new Error('Informe o rendimento de um lote (maior que zero).');
    const p = porcao.value === '' ? null : num(porcao.value);
    await api('PUT', `/receitas/${itemId}`, {
      rendimento_qtd: r, fracionavel: frac.checked,
      ingredientes: ings.map((l) => ({ item_id: l.item_id, qtd: l.qtd, obs: l.obs })),
    });
    await api('PUT', `/itens/${itemId}`, { porcao_qtd: p });
    aviso('Receita salva');
    ir('painel', 'receitas');
  });

  reset(box, 
    h('h2', {}, it.nome),
    h('p', { class: 'small' }, [it.categoria, it.armazenamento, it.validade_dias ? `validade ${it.validade_dias} dias` : null, d.receita?.fonte].filter(Boolean).join(' · ')),
    it.avisos ? h('div', { class: 'note' }, it.avisos) : null,
    h('div', { class: 'row' }, h('label', { class: 'grow', for: '' }, `Rendimento de 1 lote (${sufixo(it)})`), rend),
    h('div', { class: 'row' }, h('label', { class: 'grow' }, `Porção padrão em um lanche (${sufixo(it)})`), porcao),
    h('div', { class: 'row' }, frac, h('label', { for: 'frac' }, 'Pode fazer meio lote (receita fracionável)')),
    d.receita && it.porcao_qtd ? h('p', { class: 'small' }, `Cada lote rende ${nf1.format(d.receita.rendimento_qtd / it.porcao_qtd)} porções.`) : null,
    h('h3', {}, 'Ingredientes de 1 lote'),
    linhas,
    h('div', { class: 'actions' },
      h('button', { class: 'btn small', type: 'button', onclick: () => {
        const usados = new Set(ings.map((l) => l.item_id));
        const livre = S.itens.find((i) => i.id !== itemId && !usados.has(i.id) && i.tipo === 'insumo');
        if (!livre) return aviso('Todos os insumos já estão na receita.', true);
        ings.push({ item_id: livre.id, qtd: 1, obs: '' });
        desenharLinhas();
      } }, 'Adicionar ingrediente'),
      h('button', { class: 'btn primary', type: 'button', onclick: salvar }, 'Salvar receita'),
      d.receita ? h('button', { class: 'btn ghost', type: 'button', onclick: () => confirm('Apagar a receita (o preparo continua cadastrado)?') && seguro(async () => { await api('DELETE', `/receitas/${itemId}`); ir('painel', 'receitas'); }) }, 'Apagar receita') : null)
  );
}

// ── Estoque ───────────────────────────────────────────────────────────────
async function viewEstoque(el) {
  await carregarItens();
  const lista = S.itens.filter((i) => i.tipo === S.estTipo);
  const chips = h('div', { class: 'row' },
    [['insumo', 'Insumos'], ['preparo', 'Preparos prontos']].map(([t, r]) =>
      h('button', { class: 'btn small' + (S.estTipo === t ? ' primary' : ''), type: 'button', onclick: () => { S.estTipo = t; ir('painel', 'estoque'); } }, r)));

  const linha = (i) => {
    const campo = h('input', { class: 'w-num', type: 'number', min: 0, step: 'any', inputMode: 'decimal', 'aria-label': `Quantidade de ${i.nome}`, placeholder: sufixo(i) });
    const mover = (tipo) => seguro(async () => {
      const v = num(campo.value);
      if (!(v >= 0) || campo.value === '') throw new Error('Digite uma quantidade.');
      await api('POST', '/estoque/movimentos', { item_id: i.id, tipo, qtd: v });
      ir('painel', 'estoque');
    });
    campo.addEventListener('keydown', (e) => e.key === 'Enter' && mover('contagem'));
    const div = i.unidade === 'un' ? 1 : 1000;
    return h('tr', {},
      h('td', {}, h('b', {}, i.nome), i.categoria ? h('div', { class: 'small' }, i.categoria) : null),
      h('td', { class: 'n' }, qtd(i.estoque, i)),
      h('td', {}, h('div', { class: 'row quebra', style: 'margin:0' }, campo,
        h('button', { class: 'btn small', type: 'button', onclick: () => mover('contagem') }, 'Definir'),
        h('button', { class: 'btn small', type: 'button', onclick: () => mover('entrada') }, 'Somar'))),
      h('td', { class: 'n' }, i.tipo === 'insumo'
        ? h('input', { class: 'w-sm', type: 'number', min: 1, max: 100, step: 1, value: Math.round(i.aproveitamento * 100), 'aria-label': `Aproveitamento de ${i.nome} em %`,
            onchange: (e) => seguro(async () => { await api('PUT', `/itens/${i.id}`, { aproveitamento: num(e.target.value) / 100 }); aviso('Aproveitamento salvo'); }).then(carregarItens) })
        : '—'),
      S.estTipo === 'insumo'
        ? h('td', { class: 'n' }, h('input', { class: 'w-sm', type: 'number', min: 0, step: 'any', value: i.embalagem_qtd ? i.embalagem_qtd / div : '', placeholder: i.unidade === 'g' ? 'kg' : i.unidade === 'ml' ? 'L' : 'un', 'aria-label': `Embalagem de ${i.nome}`,
            onchange: (e) => seguro(async () => {
              const v = e.target.value === '' ? null : num(e.target.value);
              if (v !== null && !(v > 0)) throw new Error('O tamanho da embalagem precisa ser maior que zero.');
              await api('PUT', `/itens/${i.id}`, { embalagem_qtd: v === null ? null : v * div, embalagem_nome: v === null ? null : (i.embalagem_nome || 'pacote') });
              aviso('Embalagem salva');
            }).then(carregarItens) }))
        : null);
  };

  const nome = h('input', { placeholder: 'Nome do novo insumo', 'aria-label': 'Nome do novo insumo' });
  const un = h('select', { 'aria-label': 'Unidade' }, ['g', 'ml', 'un'].map((u) => h('option', { value: u }, u)));
  const cat = h('input', { placeholder: 'Categoria (opcional)', 'aria-label': 'Categoria' });

  add(el,
    h('div', { class: 'panel' }, h('h2', {}, 'Estoque'),
      h('p', { class: 'hint' }, '"Definir" ajusta ao valor contado; "Somar" dá entrada. A Lista de Compras desconta o estoque. Em insumos, "Aproveit. %" é quanto do que você compra vira ingrediente (ex.: 80 = 20% de perda) e "Embalagem" é o tamanho do pacote de compra em kg/L (ex.: catupiry 1,5): a lista de compras arredonda para pacotes inteiros.'),
      chips,
      h('div', { class: 'scroll' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Item'), h('th', { class: 'n' }, 'Em estoque'), h('th', {}, 'Ajustar'), h('th', { class: 'n' }, S.estTipo === 'insumo' ? 'Aproveit. %' : ''), S.estTipo === 'insumo' ? h('th', { class: 'n' }, 'Embalagem') : null)),
        h('tbody', {}, lista.map(linha))))),
    h('div', { class: 'panel' }, h('h3', {}, 'Novo insumo'),
      h('div', { class: 'row' }, nome, h('div', { class: 'w-sm' }, un), cat,
        h('button', { class: 'btn primary', type: 'button', onclick: () => seguro(async () => { await api('POST', '/itens', { nome: nome.value, tipo: 'insumo', unidade: un.value, categoria: cat.value }); ir('painel', 'estoque'); }) }, 'Criar')))
  );
}

// ── Dados / auditoria ─────────────────────────────────────────────────────
async function viewDados(el) {
  const [a, pend, vendas] = await Promise.all([api('GET', '/auditoria'), api('GET', '/pendencias'), api('GET', '/vendas')]);
  add(el,
    desenharPendencias(pend, 'Para confirmar com a cozinha:', true),
    vendas.periodo
      ? h('details', { class: 'panel' },
          h('summary', {}, h('h2', { class: 'inline' }, `Vendas usadas (${vendas.periodo.rotulo})`)),
          h('p', { class: 'hint' }, vendas.periodo.fonte),
          h('div', { class: 'scroll' }, h('table', {},
            h('thead', {}, h('tr', {}, h('th', {}, 'Lanche'), h('th', { class: 'n' }, 'Vendas'), h('th', { class: 'n' }, 'Por dia'), h('th', { class: 'n' }, 'Mix'), h('th', {}, 'De onde vem'))),
            h('tbody', {}, vendas.linhas.map((l) => h('tr', {},
              h('td', {}, h('b', {}, l.nome), h('div', { class: 'small' }, l.categoria)),
              h('td', { class: 'n' }, nf1.format(l.qtd)),
              h('td', { class: 'n' }, nf1.format(l.porDia)),
              h('td', { class: 'n' }, l.pct === null ? '—' : `${nf1.format(l.pct * 100)}%`),
              h('td', { class: 'small' }, l.detalhe)))))),
          vendas.ignoradas.length
            ? [h('h3', {}, 'Vendidos, mas fora da conta'), vendas.ignoradas.map((i) => h('div', { class: 'note' }, h('b', {}, `${nf1.format(i.qtd)} un · ${i.motivo}`), h('div', {}, i.produto)))]
            : null)
      : null,
    h('div', { class: 'panel' }, h('h2', {}, 'Conferência das receitas'),
      h('p', { class: 'hint' }, 'Os números iniciais vieram do livro de receitas e da planilha, e os dois nem sempre batem. Onde houve divergência ou suposição, o aviso aparece abaixo. Corrija na aba Receitas conforme você conferir pesando os lotes.'),
      h('div', { class: 'scroll' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Preparo'), h('th', { class: 'n' }, 'Rendimento'), h('th', { class: 'n' }, 'Soma ingred.'), h('th', { class: 'n' }, 'Lote / ingred.'), h('th', { class: 'n' }, 'Porções'), h('th', {}, 'Avisos'))),
        h('tbody', {}, a.receitas.map((r) => {
          const un = { unidade: r.unidade };
          return h('tr', {},
            h('td', {}, h('b', {}, r.nome)),
            h('td', { class: 'n' }, qtd(r.rendimento, un)),
            h('td', { class: 'n' }, r.somaIngredientes ? qtd(r.somaIngredientes, un) : '—'),
            h('td', { class: 'n' }, r.aproveitamentoDoLote ? `${Math.round(r.aproveitamentoDoLote * 100)}%` : '—'),
            h('td', { class: 'n' }, r.porcoesPorLote ? nf1.format(r.porcoesPorLote) : '—'),
            h('td', {}, r.notas.map((n) => h('div', { class: 'small' }, `! ${n}`)), r.avisosDaFonte ? h('div', { class: 'small' }, r.avisosDaFonte) : null));
        }))))),
    h('div', { class: 'panel' }, h('h2', {}, 'Preparos sem receita'),
      a.semReceita.map((s) => h('div', { class: 'note' }, h('b', {}, s.nome), s.avisos ? ` — ${s.avisos}` : ''))),
    h('div', { class: 'panel' }, h('h2', {}, 'Backup'),
      h('p', { class: 'hint' }, 'O banco fica no arquivo data/foqui.db. Para backup, copie esse arquivo ou baixe o JSON.'),
      h('a', { class: 'btn', href: '/api/export', download: 'foqui-backup.json' }, 'Baixar JSON'))
  );
}

// ── Lista de compras ──────────────────────────────────────────────────────
async function viewCompras(el) {
  const c = await api('GET', '/compras');
  const refazer = () => ir('compras');
  const linha = (x) => h('label', { class: 'buy' + (x.marcado ? ' done' : '') },
    h('input', { type: 'checkbox', checked: x.marcado, onchange: (e) => seguro(async () => { await api('PUT', '/compras/checks', { item_id: x.itemId, marcado: e.target.checked }); refazer(); }) }),
    h('span', { class: 'nm' }, h('b', {}, x.nome),
      h('span', { class: 'small' }, `preciso ${exatoTxt(x)}${x.estoque > 0 ? ` · tenho ${qtd(x.estoque, x)}` : ''}${x.aproveitamento < 1 ? ` · aproveitamento ${Math.round(x.aproveitamento * 100)}%` : ''}`)),
    h('span', { class: 'qt' }, compraTxt(x)));

  const copiar = () => {
    const t = ['Lista de compras - Foqui', ...c.comprar.filter((x) => !x.marcado).map((x) => `- ${x.nome}: ${compraTxt(x)}`)].join('\n');
    navigator.clipboard?.writeText(t).then(() => aviso('Lista copiada (sem os itens já marcados)'), () => aviso('Não foi possível copiar', true));
  };
  const grupos = [...new Set(c.comprar.map((x) => x.categoria || 'Outros'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  add(el,
    h('div', { class: 'panel' }, h('h2', {}, 'Lista de compras'),
      h('p', { class: 'hint' }, `Calculada pela meta de produção (${nf1.format(c.totalLanches)} lanches) menos o estoque, sempre em kg ou L. Para cima em passos de 0,1; itens com embalagem (ex.: catupiry) saem em pacotes inteiros. Muda sozinha quando você altera a meta, as receitas ou o estoque.`),
      c.comprar.length
        ? grupos.map((g) => [h('div', { class: 'grupo-compra' }, g), c.comprar.filter((x) => (x.categoria || 'Outros') === g).map(linha)])
        : h('div', { class: 'empty' }, c.totalLanches ? 'O estoque cobre toda a produção. Nada para comprar.' : 'Defina a meta de produção no Painel para gerar a lista.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', type: 'button', onclick: copiar }, 'Copiar lista'),
        h('a', { class: 'btn', href: '/api/compras.csv' }, 'Baixar CSV'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => seguro(async () => { await api('DELETE', '/compras/checks'); refazer(); }) }, 'Desmarcar tudo'))),
    c.semReceita.some((s) => s.falta > 1e-9)
      ? h('div', { class: 'alert' }, h('b', {}, 'Atenção: '), 'estes preparos não têm receita e podem exigir compra fora da lista: ', c.semReceita.filter((s) => s.falta > 1e-9).map((s) => s.nome).join(', '), '.')
      : null,
    desenharPendencias(c.pendencias, 'Atenção: a lista usa dados ainda não confirmados.'),
    c.jaTem.length
      ? h('div', { class: 'panel' }, h('h2', {}, 'Já tem o suficiente'),
          c.jaTem.map((x) => h('div', { class: 'buy static' }, h('span', { class: 'nm' }, h('b', {}, x.nome), h('span', { class: 'small' }, `preciso ${qtd(x.bruto, x)} · tenho ${qtd(x.estoque, x)}`)), h('span', { class: 'pill ok' }, 'ok'))))
      : null
  );
}

// ── Telas Operacionais ────────────────────────────────────────────────────

// Chaves de localStorage para checkboxes operacionais (resetam com nova data)
function chaveOp(tipo) {
  return `foqui-op-${tipo}-${new Date().toISOString().slice(0, 10)}`;
}
function lerChecks(tipo) {
  try { return new Set(JSON.parse(localStorage.getItem(chaveOp(tipo)) || '[]')); } catch { return new Set(); }
}
function salvarCheck(tipo, id, marcado) {
  const s = lerChecks(tipo);
  marcado ? s.add(id) : s.delete(id);
  try { localStorage.setItem(chaveOp(tipo), JSON.stringify([...s])); } catch { /* ignora */ }
}

async function viewOperacional(alvo) {
  // Abas internas: Finalização | Produção
  const subNav = h('nav', { class: 'sub-nav', role: 'tablist' },
    h('button', { role: 'tab', type: 'button', 'aria-selected': S.opAba === 'finalizacao', onclick: () => { S.opAba = 'finalizacao'; viewOperacional(alvo); } }, '🥪 Finalização'),
    h('button', { role: 'tab', type: 'button', 'aria-selected': S.opAba === 'producao', onclick: () => { S.opAba = 'producao'; viewOperacional(alvo); } }, '🔪 Produção')
  );

  const corpo = h('div');
  reset(alvo, subNav, corpo);

  try {
    if (S.opAba === 'finalizacao') await viewOpFinalizacao(corpo);
    else await viewOpProducao(corpo);
  } catch (e) {
    reset(corpo, h('div', { class: 'alert' }, `Não foi possível carregar: ${e.message}`));
  }
}

async function viewOpFinalizacao(alvo) {
  const [lanches, vendas] = await Promise.all([api('GET', '/api/lanches'), api('GET', '/api/vendas')]);

  // Calcula metas a partir das vendas do mês anterior (modo dias = 1 dia de referência)
  let metaMap = new Map();
  if (vendas.periodo && vendas.linhas.length) {
    try {
      const res = await api('POST', '/api/metas/sugerir', { modo: 'dias', dias: 1, fator: 1, aplicar: false });
      res.metas.forEach(m => metaMap.set(m.lancheId, m.meta));
    } catch { /* fallback: usa meta salva */ }
  }

  const checks = lerChecks('fin');
  const ativos = lanches.filter(l => l.ativo && (metaMap.get(l.id) > 0 || l.meta_qtd > 0));
  if (!ativos.length) {
    reset(alvo, h('div', { class: 'op-vazio' }, 'Nenhuma meta definida. Configure as metas no Painel de Produção.'));
    return;
  }

  const total = ativos.reduce((s, l) => s + (metaMap.get(l.id) ?? l.meta_qtd), 0);
  const feitos = ativos.filter(l => checks.has(String(l.id))).reduce((s, l) => s + (metaMap.get(l.id) ?? l.meta_qtd), 0);
  const pct = total > 0 ? Math.round(feitos / total * 100) : 0;

  const barra = h('div', { class: 'op-progresso-wrap' },
    h('div', { class: 'op-progresso-topo' },
      h('span', {}, vendas.periodo ? `Referência: ${vendas.periodo.descricao ?? 'mês anterior'} · média diária` : 'Meta do dia'),
      h('span', { class: 'op-pct' }, `${pct}%`)
    ),
    h('div', { class: 'op-barra' }, h('div', { class: 'op-barra-fill', style: `width:${pct}%` }))
  );

  const grupos = porCategoria(ativos);
  const cards = grupos.flatMap(([cat, lista]) => [
    h('div', { class: 'op-cat' }, cat === 'Sanduíche' ? 'Sanduíches' : cat),
    ...lista.map(l => {
      const meta = metaMap.get(l.id) ?? l.meta_qtd;
      const done = checks.has(String(l.id));
      const card = h('div', { class: `op-card${done ? ' op-done' : ''}` },
        h('label', { class: 'op-card-inner' },
          h('div', { class: 'op-card-info' },
            h('div', { class: 'op-card-nome' }, l.nome),
            h('div', { class: 'op-card-qtd' }, h('span', { class: 'op-num' }, meta), h('span', { class: 'op-un' }, 'un'))
          ),
          h('input', {
            type: 'checkbox', class: 'op-check', checked: done,
            onchange(e) {
              salvarCheck('fin', String(l.id), e.target.checked);
              card.classList.toggle('op-done', e.target.checked);
              // Recalcula barra
              const c2 = lerChecks('fin');
              const f2 = ativos.filter(x => c2.has(String(x.id))).reduce((s, x) => s + (metaMap.get(x.id) ?? x.meta_qtd), 0);
              const p2 = total > 0 ? Math.round(f2 / total * 100) : 0;
              alvo.querySelector('.op-pct').textContent = `${p2}%`;
              alvo.querySelector('.op-barra-fill').style.width = `${p2}%`;
            }
          })
        )
      );
      return card;
    })
  ]);

  const btnReset = h('button', { class: 'btn ghost', style: 'margin-top:20px', onclick() {
    try { localStorage.removeItem(chaveOp('fin')); } catch { /* ignora */ }
    viewOpFinalizacao(alvo);
  }}, 'Reiniciar checklist do dia');

  reset(alvo, barra, ...cards, h('div', { class: 'actions' }, btnReset));
}

async function viewOpProducao(alvo) {
  const plano = await api('GET', '/api/plano');
  const checks = lerChecks('prod');

  if (!plano.producao.length && !plano.compras.length) {
    reset(alvo, h('div', { class: 'op-vazio' }, 'Nenhuma produção necessária. Defina as metas no Painel de Produção.'));
    return;
  }

  const totalP = plano.producao.length;
  const feitosP = plano.producao.filter(p => checks.has(`p-${p.itemId}`)).length;
  const pct = totalP > 0 ? Math.round(feitosP / totalP * 100) : 0;

  const barra = h('div', { class: 'op-progresso-wrap' },
    h('div', { class: 'op-progresso-topo' },
      h('span', {}, 'Preparos do dia'),
      h('span', { class: 'op-pct' }, `${pct}%`)
    ),
    h('div', { class: 'op-barra' }, h('div', { class: 'op-barra-fill', style: `width:${pct}%` }))
  );

  const titulo = h('div', { class: 'op-cat' }, 'O que produzir');

  const itensProducao = plano.producao.map(p => {
    const key = `p-${p.itemId}`;
    const done = checks.has(key);
    const loteTxt = p.lotes === 1 ? '1 lote' : `${nf1.format(p.lotes)} lotes`;
    const rendTxt = `rende ${qtd(p.rendimentoLote, p)} por lote`;
    const card = h('div', { class: `op-card${done ? ' op-done' : ''}` },
      h('label', { class: 'op-card-inner' },
        h('div', { class: 'op-card-info' },
          h('div', { class: 'op-card-nome' }, p.nome),
          h('div', { class: 'op-card-sub' }, `${loteTxt} · ${rendTxt}`),
          h('div', { class: 'op-card-qtd' }, h('span', { class: 'op-num' }, nf1.format(p.aProduzir)), h('span', { class: 'op-un' }, p.unidade === 'g' ? 'g' : p.unidade === 'ml' ? 'ml' : 'un'))
        ),
        h('input', {
          type: 'checkbox', class: 'op-check', checked: done,
          onchange(e) {
            salvarCheck('prod', key, e.target.checked);
            card.classList.toggle('op-done', e.target.checked);
            const c2 = lerChecks('prod');
            const f2 = plano.producao.filter(x => c2.has(`p-${x.itemId}`)).length;
            const p2 = totalP > 0 ? Math.round(f2 / totalP * 100) : 0;
            alvo.querySelector('.op-pct').textContent = `${p2}%`;
            alvo.querySelector('.op-barra-fill').style.width = `${p2}%`;
          }
        })
      )
    );
    return card;
  });

  const btnReset = h('button', { class: 'btn ghost', style: 'margin-top:20px', onclick() {
    try { localStorage.removeItem(chaveOp('prod')); } catch { /* ignora */ }
    viewOpProducao(alvo);
  }}, 'Reiniciar checklist do dia');

  reset(alvo, barra, titulo, ...itensProducao, h('div', { class: 'actions' }, btnReset));
}

// ── Navegação ─────────────────────────────────────────────────────────────
const ABAS = [['producao', 'Produção', viewProducao], ['lanches', 'Lanches', viewLanches], ['medidas', 'Medidas', viewMedidas], ['receitas', 'Receitas', viewReceitas], ['estoque', 'Estoque', viewEstoque], ['dados', 'Dados', viewDados]];

async function ir(area, aba) {
  S.area = area;
  if (aba) S.aba = aba;
  $('#sec-op').setAttribute('aria-selected', area === 'op');
  $('#sec-painel').setAttribute('aria-selected', area === 'painel');
  $('#sec-compras').setAttribute('aria-selected', area === 'compras');
  const nav = $('#subnav');
  nav.hidden = area !== 'painel';
  nav.replaceChildren(...ABAS.map(([id, rotulo]) => h('button', { role: 'tab', type: 'button', 'aria-selected': S.aba === id, onclick: () => ir('painel', id) }, rotulo)));
  const alvo = h('div');
  view.replaceChildren(alvo);
  try {
    if (area === 'op') await viewOperacional(alvo);
    else if (area === 'compras') await viewCompras(alvo);
    else await ABAS.find(([id]) => id === S.aba)[2](alvo);
  } catch (e) {
    alvo.replaceChildren(h('div', { class: 'alert' }, `Não foi possível carregar: ${e.message}`));
  }
  atualizarBadge();
}

$('#sec-op').onclick = () => ir('op');
$('#sec-painel').onclick = () => ir('painel');
$('#sec-compras').onclick = () => ir('compras');

// Logo (estrela com F) e tema
(function logo() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'logo');
  svg.setAttribute('aria-hidden', 'true');
  const pts = [];
  for (let i = 0; i < 40; i++) {
    const r = i % 2 ? 41 : 48;
    const a = (Math.PI * i) / 20 - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  const poly = document.createElementNS(NS, 'polygon');
  poly.setAttribute('points', pts.join(' '));
  poly.setAttribute('fill', '#f4a7be');
  const t = document.createElementNS(NS, 'text');
  t.setAttribute('x', '50'); t.setAttribute('y', '68'); t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '58');
  t.setAttribute('fill', '#1f4d3f'); t.setAttribute('style', "font-family:'Alfa Slab One',Georgia,serif");
  t.textContent = 'F';
  svg.append(poly, t);
  $('#logo').replaceWith(svg);
})();

try {
  const salvo = localStorage.getItem('foqui-tema');
  if (salvo) document.documentElement.setAttribute('data-theme', salvo);
} catch { /* sem armazenamento: segue o tema do sistema */ }
$('#tema').onclick = () => {
  const r = document.documentElement;
  const escuro = r.getAttribute('data-theme') === 'dark' || (!r.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
  const novo = escuro ? 'light' : 'dark';
  r.setAttribute('data-theme', novo);
  try { localStorage.setItem('foqui-tema', novo); } catch { /* ignora */ }
};

ir('painel', 'producao');
