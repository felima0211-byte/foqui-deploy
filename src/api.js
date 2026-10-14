import { transacao } from './db.js';
import { carregarModelo, planoDasMetas, pendenciasDasMetas, capacidade, auditar, validarSemCiclo, sugerirMetas, piorConfianca, ErroDeModelo } from './engine.js';

class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

const UNIDADES = ['g', 'ml', 'un'];
const CONFIANCAS = ['confirmado', 'estimado', 'pendente'];
const CATEGORIAS = ['Sanduíche', 'Wrap', 'Salada', 'Sobremesa', 'Adicional', 'Outros'];

function numero(v, nome, { min = 0, minExclusivo = false, max = Infinity, opcional = false } = {}) {
  if ((v === null || v === undefined || v === '') && opcional) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n)) throw new ErroHttp(400, `${nome} precisa ser um número.`);
  if (minExclusivo ? n <= min : n < min) throw new ErroHttp(400, `${nome} precisa ser ${minExclusivo ? 'maior que' : 'pelo menos'} ${min}.`);
  if (n > max) throw new ErroHttp(400, `${nome} precisa ser no máximo ${max}.`);
  return n;
}

function texto(v, nome, { obrigatorio = false } = {}) {
  const t = v == null ? '' : String(v).trim();
  if (obrigatorio && !t) throw new ErroHttp(400, `${nome} é obrigatório.`);
  return t || null;
}

function slugificar(nome) {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

export function criarApi(db) {
  const um = (sql, ...p) => db.prepare(sql).get(...p);
  const todos = (sql, ...p) => db.prepare(sql).all(...p);
  const rodar = (sql, ...p) => db.prepare(sql).run(...p);

  const itemOu404 = (id) => um('SELECT * FROM itens WHERE id = ?', id) ?? (() => { throw new ErroHttp(404, 'Item não encontrado.'); })();
  const lancheOu404 = (id) => um('SELECT * FROM lanches WHERE id = ?', id) ?? (() => { throw new ErroHttp(404, 'Lanche não encontrado.'); })();

  const conferirCiclos = () => {
    try {
      validarSemCiclo(carregarModelo(db));
    } catch (e) {
      if (e instanceof ErroDeModelo) throw new ErroHttp(400, e.message);
      throw e;
    }
  };

  function listarItens() {
    const medidas = todos('SELECT * FROM medidas ORDER BY nome');
    return todos(
      `SELECT i.*, COALESCE(e.qtd, 0) AS estoque,
              CASE WHEN r.item_id IS NULL THEN 0 ELSE 1 END AS tem_receita
       FROM itens i
       LEFT JOIN estoque_atual e ON e.item_id = i.id
       LEFT JOIN receitas r ON r.item_id = i.id
       ORDER BY i.tipo DESC, i.nome COLLATE NOCASE`
    ).map((i) => ({ ...i, medidas: medidas.filter((m) => m.item_id === i.id) }));
  }

  function detalheReceita(itemId) {
    const item = itemOu404(itemId);
    const r = um('SELECT * FROM receitas WHERE item_id = ?', itemId);
    if (!r) return { item, receita: null, ingredientes: [] };
    const ingredientes = todos(
      `SELECT ri.item_id, i.nome, i.unidade, i.unidade_label, i.tipo, ri.qtd, ri.obs
       FROM receita_ingredientes ri JOIN itens i ON i.id = ri.item_id
       WHERE ri.receita_item_id = ? ORDER BY ri.qtd DESC`,
      itemId
    );
    return { item, receita: r, ingredientes };
  }

  function listarLanches() {
    return todos('SELECT * FROM lanches ORDER BY ordem, nome COLLATE NOCASE').map((l) => ({
      ...l,
      componentes: todos(
        `SELECT c.item_id, i.nome, i.unidade, i.unidade_label, i.porcao_qtd, c.qtd AS qtd_gravada,
                c.medida_id, c.medida_qtd, m.nome AS medida_nome, m.qtd AS medida_base,
                c.confianca AS conf_linha, m.confianca AS conf_medida, c.nota AS nota_linha, m.nota AS nota_medida
         FROM lanche_componentes c JOIN itens i ON i.id = c.item_id LEFT JOIN medidas m ON m.id = c.medida_id
         WHERE c.lanche_id = ? ORDER BY c.rowid`,
        l.id
      ).map(({ qtd_gravada, medida_base, conf_medida, nota_medida, ...c }) => ({
        ...c,
        qtd: c.medida_id ? c.medida_qtd * medida_base : qtd_gravada, // sempre na unidade do item (g, ml ou un)
        confianca: piorConfianca(c.conf_linha, conf_medida), // efetiva: a pior entre a linha e a medida
        nota: c.nota_linha ?? nota_medida ?? null,
      })),
    }));
  }

  function compras() {
    const plano = planoDasMetas(carregarModelo(db));
    const marcados = new Set(todos('SELECT item_id FROM compras_checks WHERE marcado = 1').map((r) => r.item_id));
    const lista = plano.compras.map((c) => ({ ...c, marcado: marcados.has(c.itemId) }));
    return {
      totalLanches: plano.totalLanches,
      comprar: lista.filter((c) => c.comprar > 1e-9),
      jaTem: lista.filter((c) => c.comprar <= 1e-9),
      semReceita: plano.semReceita,
      pendencias: plano.pendencias,
    };
  }

  function vendasDoPeriodo() {
    const periodo = um('SELECT * FROM vendas_periodos WHERE ativo = 1 ORDER BY id DESC LIMIT 1');
    if (!periodo) return { periodo: null, linhas: [], ignoradas: [], totalPrincipal: 0 };
    const linhas = todos(
      `SELECT v.lanche_id, l.nome, l.categoria, v.qtd, v.detalhe
       FROM vendas v JOIN lanches l ON l.id = v.lanche_id WHERE v.periodo_id = ? ORDER BY l.ordem`,
      periodo.id
    );
    const totalPrincipal = linhas.filter((l) => l.categoria !== 'Adicional').reduce((s, l) => s + l.qtd, 0);
    return {
      periodo,
      totalPrincipal,
      linhas: linhas.map((l) => ({ ...l, porDia: l.qtd / periodo.dias, pct: l.categoria !== 'Adicional' && totalPrincipal ? l.qtd / totalPrincipal : null })),
      ignoradas: todos('SELECT produto, qtd, motivo FROM vendas_ignoradas WHERE periodo_id = ? ORDER BY qtd DESC', periodo.id),
    };
  }

  // ── Rotas ─────────────────────────────────────────────────────────────
  // Cada rota: [método, regex, (match, corpo, url) => resposta]
  const rotas = [
    ['GET', /^\/api\/health$/, () => ({ ok: true })],

    // Itens
    ['GET', /^\/api\/itens$/, () => listarItens()],
    ['POST', /^\/api\/itens$/, (_, b) => {
      const nome = texto(b.nome, 'Nome', { obrigatorio: true });
      if (!['insumo', 'preparo'].includes(b.tipo)) throw new ErroHttp(400, 'Tipo precisa ser insumo ou preparo.');
      if (!UNIDADES.includes(b.unidade)) throw new ErroHttp(400, 'Unidade precisa ser g, ml ou un.');
      let slug = slugificar(nome);
      for (let n = 2; um('SELECT 1 FROM itens WHERE slug = ?', slug); n++) slug = `${slugificar(nome)}-${n}`;
      const r = rodar(
        `INSERT INTO itens (slug, nome, tipo, unidade, unidade_label, porcao_qtd, aproveitamento, categoria, armazenamento, validade_dias, avisos, embalagem_qtd, embalagem_nome)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        slug, nome, b.tipo, b.unidade, texto(b.unidade_label), numero(b.porcao_qtd, 'Porção', { minExclusivo: true, opcional: true }),
        numero(b.aproveitamento ?? 1, 'Aproveitamento', { minExclusivo: true, max: 1 }), texto(b.categoria), texto(b.armazenamento),
        numero(b.validade_dias, 'Validade', { opcional: true }), texto(b.avisos),
        numero(b.embalagem_qtd, 'Embalagem', { minExclusivo: true, opcional: true }), texto(b.embalagem_nome)
      );
      return itemOu404(Number(r.lastInsertRowid));
    }],
    ['PUT', /^\/api\/itens\/(\d+)$/, (m, b) => {
      const id = Number(m[1]);
      const atual = itemOu404(id);
      const campos = {
        nome: b.nome !== undefined ? texto(b.nome, 'Nome', { obrigatorio: true }) : atual.nome,
        unidade_label: b.unidade_label !== undefined ? texto(b.unidade_label) : atual.unidade_label,
        porcao_qtd: b.porcao_qtd !== undefined ? numero(b.porcao_qtd, 'Porção', { minExclusivo: true, opcional: true }) : atual.porcao_qtd,
        aproveitamento: b.aproveitamento !== undefined ? numero(b.aproveitamento, 'Aproveitamento', { minExclusivo: true, max: 1 }) : atual.aproveitamento,
        categoria: b.categoria !== undefined ? texto(b.categoria) : atual.categoria,
        armazenamento: b.armazenamento !== undefined ? texto(b.armazenamento) : atual.armazenamento,
        validade_dias: b.validade_dias !== undefined ? numero(b.validade_dias, 'Validade', { opcional: true }) : atual.validade_dias,
        avisos: b.avisos !== undefined ? texto(b.avisos) : atual.avisos,
        embalagem_qtd: b.embalagem_qtd !== undefined ? numero(b.embalagem_qtd, 'Embalagem', { minExclusivo: true, opcional: true }) : atual.embalagem_qtd,
        embalagem_nome: b.embalagem_nome !== undefined ? texto(b.embalagem_nome) : atual.embalagem_nome,
      };
      if (b.unidade !== undefined && b.unidade !== atual.unidade) throw new ErroHttp(400, 'Não dá para trocar a unidade de um item existente: crie outro item.');
      rodar(
        `UPDATE itens SET nome=?, unidade_label=?, porcao_qtd=?, aproveitamento=?, categoria=?, armazenamento=?, validade_dias=?, avisos=?, embalagem_qtd=?, embalagem_nome=? WHERE id=?`,
        campos.nome, campos.unidade_label, campos.porcao_qtd, campos.aproveitamento, campos.categoria, campos.armazenamento, campos.validade_dias, campos.avisos, campos.embalagem_qtd, campos.embalagem_nome, id
      );
      return itemOu404(id);
    }],
    ['DELETE', /^\/api\/itens\/(\d+)$/, (m) => {
      const id = Number(m[1]);
      itemOu404(id);
      const usos = um(
        `SELECT (SELECT COUNT(*) FROM receita_ingredientes WHERE item_id = ?) AS receitas,
                (SELECT COUNT(*) FROM lanche_componentes WHERE item_id = ?) AS lanches`,
        id, id
      );
      if (usos.receitas || usos.lanches) throw new ErroHttp(409, `Este item é usado em ${usos.receitas} receita(s) e ${usos.lanches} lanche(s). Remova de lá primeiro.`);
      rodar('DELETE FROM itens WHERE id = ?', id);
      return { ok: true };
    }],

    // Receitas
    ['GET', /^\/api\/receitas\/(\d+)$/, (m) => detalheReceita(Number(m[1]))],
    ['PUT', /^\/api\/receitas\/(\d+)$/, (m, b) => {
      const id = Number(m[1]);
      const item = itemOu404(id);
      if (item.tipo !== 'preparo') throw new ErroHttp(400, 'Só preparos têm receita.');
      const rend = numero(b.rendimento_qtd, 'Rendimento do lote', { minExclusivo: true });
      const ings = Array.isArray(b.ingredientes) ? b.ingredientes : [];
      const vistos = new Set();
      for (const l of ings) {
        const ingId = Number(l.item_id);
        itemOu404(ingId);
        if (ingId === id) throw new ErroHttp(400, 'Um preparo não pode ser ingrediente dele mesmo.');
        if (vistos.has(ingId)) throw new ErroHttp(400, 'Ingrediente repetido: some as quantidades numa linha só.');
        vistos.add(ingId);
        numero(l.qtd, 'Quantidade do ingrediente', { minExclusivo: true });
      }
      transacao(db, () => {
        rodar('DELETE FROM receitas WHERE item_id = ?', id);
        rodar('INSERT INTO receitas (item_id, rendimento_qtd, fracionavel, fonte, avisos) VALUES (?, ?, ?, ?, ?)', id, rend, b.fracionavel ? 1 : 0, texto(b.fonte), texto(b.avisos));
        for (const l of ings) rodar('INSERT INTO receita_ingredientes (receita_item_id, item_id, qtd, obs) VALUES (?, ?, ?, ?)', id, Number(l.item_id), numero(l.qtd, 'Quantidade'), texto(l.obs));
        conferirCiclos();
      });
      return detalheReceita(id);
    }],
    ['DELETE', /^\/api\/receitas\/(\d+)$/, (m) => {
      rodar('DELETE FROM receitas WHERE item_id = ?', Number(m[1]));
      return { ok: true };
    }],

    // Lanches
    ['GET', /^\/api\/lanches$/, () => listarLanches()],
    ['POST', /^\/api\/lanches$/, (_, b) => {
      const nome = texto(b.nome, 'Nome', { obrigatorio: true });
      if (um('SELECT 1 FROM lanches WHERE nome = ?', nome)) throw new ErroHttp(409, 'Já existe um lanche com esse nome.');
      const categoria = b.categoria === undefined ? 'Outros' : b.categoria;
      if (!CATEGORIAS.includes(categoria)) throw new ErroHttp(400, `Categoria precisa ser: ${CATEGORIAS.join(', ')}.`);
      const ordem = um('SELECT COALESCE(MAX(ordem), 0) + 1 AS n FROM lanches').n;
      const r = rodar('INSERT INTO lanches (nome, meta_qtd, categoria, ordem) VALUES (?, ?, ?, ?)', nome, Math.round(numero(b.meta_qtd ?? 0, 'Meta')), categoria, ordem);
      return listarLanches().find((l) => l.id === Number(r.lastInsertRowid));
    }],
    ['PUT', /^\/api\/lanches\/(\d+)$/, (m, b) => {
      const id = Number(m[1]);
      const atual = lancheOu404(id);
      transacao(db, () => {
        const nome = b.nome !== undefined ? texto(b.nome, 'Nome', { obrigatorio: true }) : atual.nome;
        const dup = um('SELECT 1 FROM lanches WHERE nome = ? AND id <> ?', nome, id);
        if (dup) throw new ErroHttp(409, 'Já existe um lanche com esse nome.');
        const meta = b.meta_qtd !== undefined ? Math.round(numero(b.meta_qtd, 'Meta')) : atual.meta_qtd;
        const ativo = b.ativo !== undefined ? (b.ativo ? 1 : 0) : atual.ativo;
        const categoria = b.categoria !== undefined ? b.categoria : atual.categoria;
        if (!CATEGORIAS.includes(categoria)) throw new ErroHttp(400, `Categoria precisa ser: ${CATEGORIAS.join(', ')}.`);
        rodar('UPDATE lanches SET nome = ?, meta_qtd = ?, ativo = ?, categoria = ? WHERE id = ?', nome, meta, ativo, categoria, id);
        if (Array.isArray(b.componentes)) {
          rodar('DELETE FROM lanche_componentes WHERE lanche_id = ?', id);
          const vistos = new Set();
          for (const c of b.componentes) {
            const itemId = Number(c.item_id);
            itemOu404(itemId);
            if (vistos.has(itemId)) throw new ErroHttp(400, 'Item repetido no lanche: some as quantidades numa linha só.');
            vistos.add(itemId);
            let confianca = c.confianca ?? 'confirmado';
            if (!CONFIANCAS.includes(confianca)) throw new ErroHttp(400, 'Confiança precisa ser confirmado, estimado ou pendente.');
            let medidaId = null;
            let medidaQtd = null;
            let qtd;
            if (c.medida_id) {
              const med = um('SELECT * FROM medidas WHERE id = ?', Number(c.medida_id));
              if (!med || med.item_id !== itemId) throw new ErroHttp(400, 'Essa medida não pertence ao item escolhido.');
              medidaId = med.id;
              medidaQtd = numero(c.medida_qtd, 'Quantidade de medidas', { minExclusivo: true });
              qtd = medidaQtd * med.qtd;
            } else {
              qtd = numero(c.qtd, 'Quantidade', confianca === 'pendente' ? { min: 0 } : { minExclusivo: true });
              if (confianca === 'pendente' && qtd > 0) confianca = 'confirmado'; // preencheu a quantidade que faltava
            }
            rodar(
              'INSERT INTO lanche_componentes (lanche_id, item_id, qtd, medida_id, medida_qtd, confianca, nota) VALUES (?, ?, ?, ?, ?, ?, ?)',
              id, itemId, qtd, medidaId, medidaQtd, confianca, texto(c.nota)
            );
          }
        }
      });
      return listarLanches().find((l) => l.id === id);
    }],
    ['DELETE', /^\/api\/lanches\/(\d+)$/, (m) => {
      lancheOu404(Number(m[1]));
      rodar('DELETE FROM lanches WHERE id = ?', Number(m[1]));
      return { ok: true };
    }],

    // Estoque
    ['GET', /^\/api\/estoque$/, () =>
      todos(
        `SELECT i.id AS item_id, i.nome, i.tipo, i.unidade, i.unidade_label, i.categoria, e.qtd
         FROM itens i JOIN estoque_atual e ON e.item_id = i.id
         ORDER BY i.tipo DESC, i.nome COLLATE NOCASE`
      )],
    ['POST', /^\/api\/estoque\/movimentos$/, (_, b) => {
      const itemId = Number(b.item_id);
      itemOu404(itemId);
      const qtd = numero(b.qtd, 'Quantidade');
      if (!['entrada', 'saida', 'contagem'].includes(b.tipo)) throw new ErroHttp(400, 'Tipo precisa ser entrada, saida ou contagem.');
      const atual = um('SELECT qtd FROM estoque_atual WHERE item_id = ?', itemId).qtd;
      const delta = b.tipo === 'entrada' ? qtd : b.tipo === 'saida' ? -qtd : qtd - atual;
      if (Math.abs(delta) > 1e-9) rodar('INSERT INTO estoque_movimentos (item_id, qtd, tipo, obs) VALUES (?, ?, ?, ?)', itemId, delta, b.tipo, texto(b.obs));
      return { item_id: itemId, qtd: um('SELECT qtd FROM estoque_atual WHERE item_id = ?', itemId).qtd };
    }],

    // Resultados (sempre calculados na hora, a partir dos dados salvos)
    ['GET', /^\/api\/pendencias$/, () => {
      const modelo = carregarModelo(db);
      return pendenciasDasMetas(modelo, modelo.lanches.map((l) => ({ lancheId: l.id, qtd: 1 })));
    }],
    ['GET', /^\/api\/plano$/, () => planoDasMetas(carregarModelo(db))],
    ['GET', /^\/api\/capacidade$/, () => capacidade(carregarModelo(db))],
    ['GET', /^\/api\/auditoria$/, () => auditar(carregarModelo(db))],
    ['GET', /^\/api\/compras$/, () => compras()],
    ['PUT', /^\/api\/compras\/checks$/, (_, b) => {
      itemOu404(Number(b.item_id));
      rodar('INSERT INTO compras_checks (item_id, marcado) VALUES (?, ?) ON CONFLICT(item_id) DO UPDATE SET marcado = excluded.marcado', Number(b.item_id), b.marcado ? 1 : 0);
      return { ok: true };
    }],
    ['DELETE', /^\/api\/compras\/checks$/, () => {
      rodar('DELETE FROM compras_checks');
      return { ok: true };
    }],
    ['GET', /^\/api\/compras\.csv$/, () => {
      const { comprar } = compras();
      const fmt = (n) => String(Math.round(n * 1000) / 1000).replace('.', ',');
      const linhas = ['item;comprar;unidade;embalagens;necessario_exato;em_estoque'];
      for (const c of comprar) {
        const k = c.compra;
        const div = c.unidade === 'un' ? 1 : 1000;
        const emb = k.embalagens ? `${k.embalagens.n} ${k.embalagens.nome}(s) de ${fmt(k.embalagens.tamanho)} ${k.un}` : '';
        linhas.push([c.nome, fmt(k.sugerido), k.un, emb, fmt(k.exato), fmt(c.estoque / div)].join(';'));
      }
      return { __csv: linhas.join('\n'), nome: 'lista-de-compras.csv' };
    }],

    // Medidas (concha -> gramas)
    ['GET', /^\/api\/medidas$/, () =>
      todos(
        `SELECT m.*, i.nome AS item_nome, i.unidade, i.unidade_label,
                (SELECT COUNT(*) FROM lanche_componentes c WHERE c.medida_id = m.id) AS usos
         FROM medidas m JOIN itens i ON i.id = m.item_id ORDER BY i.nome COLLATE NOCASE, m.nome`
      )],
    ['POST', /^\/api\/medidas$/, (_, b) => {
      const itemId = Number(b.item_id);
      itemOu404(itemId);
      const nome = texto(b.nome, 'Nome da medida', { obrigatorio: true });
      const confianca = b.confianca ?? 'confirmado';
      if (!CONFIANCAS.includes(confianca)) throw new ErroHttp(400, 'Confiança precisa ser confirmado, estimado ou pendente.');
      const r = rodar('INSERT INTO medidas (item_id, nome, qtd, confianca, nota) VALUES (?, ?, ?, ?, ?)', itemId, nome, numero(b.qtd, 'Quanto vale a medida', { minExclusivo: true }), confianca, texto(b.nota));
      return um('SELECT * FROM medidas WHERE id = ?', Number(r.lastInsertRowid));
    }],
    ['PUT', /^\/api\/medidas\/(\d+)$/, (m, b) => {
      const id = Number(m[1]);
      const atual = um('SELECT * FROM medidas WHERE id = ?', id);
      if (!atual) throw new ErroHttp(404, 'Medida não encontrada.');
      const qtd = b.qtd !== undefined ? numero(b.qtd, 'Quanto vale a medida', { minExclusivo: true }) : atual.qtd;
      // quem corrige o valor está confirmando (pesou); só mantém a confiança antiga se mandar outra explicitamente
      const confianca = b.confianca ?? (qtd !== atual.qtd ? 'confirmado' : atual.confianca);
      if (!CONFIANCAS.includes(confianca)) throw new ErroHttp(400, 'Confiança precisa ser confirmado, estimado ou pendente.');
      transacao(db, () => {
        rodar('UPDATE medidas SET nome = ?, qtd = ?, confianca = ?, nota = ? WHERE id = ?', b.nome !== undefined ? texto(b.nome, 'Nome da medida', { obrigatorio: true }) : atual.nome, qtd, confianca, b.nota !== undefined ? texto(b.nota) : atual.nota, id);
        rodar('UPDATE lanche_componentes SET qtd = medida_qtd * ? WHERE medida_id = ?', qtd, id); // mantém o valor gravado em dia
      });
      return um('SELECT * FROM medidas WHERE id = ?', id);
    }],
    ['DELETE', /^\/api\/medidas\/(\d+)$/, (m) => {
      const id = Number(m[1]);
      const usos = um('SELECT COUNT(*) AS n FROM lanche_componentes WHERE medida_id = ?', id).n;
      if (usos) throw new ErroHttp(409, `Esta medida é usada em ${usos} lanche(s). Troque a medida nesses lanches primeiro.`);
      rodar('DELETE FROM medidas WHERE id = ?', id);
      return { ok: true };
    }],

    // Vendas e sugestão de metas
    ['GET', /^\/api\/vendas$/, () => vendasDoPeriodo()],
    ['POST', /^\/api\/metas\/sugerir$/, (_, b) => {
      const v = vendasDoPeriodo();
      if (!v.periodo) throw new ErroHttp(400, 'Não há vendas cadastradas para sugerir metas.');
      const modo = b.modo;
      let metas;
      try {
        metas = sugerirMetas(v.linhas.map((l) => ({ lancheId: l.lanche_id, categoria: l.categoria, qtd: l.qtd })), {
          modo,
          dias: modo === 'dias' ? numero(b.dias, 'Dias', { minExclusivo: true }) : undefined,
          total: modo === 'total' ? numero(b.total, 'Total de lanches') : undefined,
          fator: b.fator === undefined || b.fator === '' ? 1 : numero(b.fator, 'Fator', { minExclusivo: true, max: 10 }),
          diasPeriodo: v.periodo.dias,
        });
      } catch (e) {
        if (e instanceof ErroDeModelo) throw new ErroHttp(400, e.message);
        throw e;
      }
      if (b.aplicar) {
        transacao(db, () => {
          rodar('UPDATE lanches SET meta_qtd = 0');
          for (const [lid, meta] of metas) rodar('UPDATE lanches SET meta_qtd = ? WHERE id = ?', meta, lid);
        });
      }
      const sugestao = v.linhas.map((l) => ({ lancheId: l.lanche_id, nome: l.nome, categoria: l.categoria, meta: metas.get(l.lanche_id) ?? 0 }));
      return { aplicado: !!b.aplicar, periodo: v.periodo, metas: sugestao, totalPrincipal: sugestao.filter((s) => s.categoria !== 'Adicional').reduce((s, x) => s + x.meta, 0) };
    }],
    ['POST', /^\/api\/metas\/zerar$/, () => {
      rodar('UPDATE lanches SET meta_qtd = 0');
      return { ok: true };
    }],
    ['GET', /^\/api\/export$/, () => ({
      exportadoEm: new Date().toISOString(),
      itens: todos('SELECT * FROM itens'),
      receitas: todos('SELECT * FROM receitas'),
      receita_ingredientes: todos('SELECT * FROM receita_ingredientes'),
      lanches: todos('SELECT * FROM lanches'),
      lanche_componentes: todos('SELECT * FROM lanche_componentes'),
      medidas: todos('SELECT * FROM medidas'),
      vendas_periodos: todos('SELECT * FROM vendas_periodos'),
      vendas: todos('SELECT * FROM vendas'),
      vendas_ignoradas: todos('SELECT * FROM vendas_ignoradas'),
      estoque_movimentos: todos('SELECT * FROM estoque_movimentos'),
    })],
  ];

  /** Trata uma requisição /api. Retorna { status, corpo } ou { status, csv }. */
  return function tratar(metodo, caminho, corpo) {
    for (const [m, re, fn] of rotas) {
      if (m !== metodo) continue;
      const achou = re.exec(caminho);
      if (!achou) continue;
      try {
        const r = fn(achou, corpo ?? {});
        return r && r.__csv !== undefined ? { status: 200, csv: r.__csv, nome: r.nome } : { status: metodo === 'POST' ? 201 : 200, corpo: r };
      } catch (e) {
        if (e instanceof ErroHttp) return { status: e.status, corpo: { erro: e.message } };
        if (String(e.message).includes('UNIQUE')) return { status: 409, corpo: { erro: 'Já existe um registro igual.' } };
        if (String(e.message).includes('FOREIGN KEY')) return { status: 409, corpo: { erro: 'Esse registro está em uso por outro.' } };
        console.error(e);
        return { status: 500, corpo: { erro: 'Erro interno. Veja o terminal.' } };
      }
    }
    return { status: 404, corpo: { erro: 'Rota não encontrada.' } };
  };
}
