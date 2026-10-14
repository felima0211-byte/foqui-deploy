import { transacao } from './db.js';
import { INSUMOS, PREPAROS, MEDIDAS } from '../data/seed.js';
import { LANCHES } from '../data/lanches.js';
import { PERIODO, consolidar, LINHAS } from '../data/vendas.js';

/** Carrega insumos, preparos, receitas, medidas, lanches e vendas. Só roda em banco vazio. */
export function carregarSeed(db) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM itens').get();
  if (n > 0) return { carregado: false, motivo: 'O banco já tem itens. Use "npm run reset" para recomeçar do zero.' };

  const inserirItem = db.prepare(
    `INSERT INTO itens (slug, nome, tipo, unidade, unidade_label, porcao_qtd, categoria, armazenamento, validade_dias, avisos, embalagem_qtd, embalagem_nome)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const idPorSlug = new Map();
  const itemId = (slug, contexto) => {
    const id = idPorSlug.get(slug);
    if (!id) throw new Error(`Seed inválido: ${contexto} usa "${slug}", que não existe.`);
    return id;
  };
  let receitas = 0;

  const resumo = transacao(db, () => {
    for (const [slug, nome, unidade, categoria, porcao, extra = {}] of INSUMOS) {
      const r = inserirItem.run(slug, nome, 'insumo', unidade, null, porcao ?? null, categoria ?? null, extra.armazenamento ?? null, extra.validade_dias ?? null, extra.avisos ?? null, extra.embalagem_qtd ?? null, extra.embalagem_nome ?? null);
      idPorSlug.set(slug, Number(r.lastInsertRowid));
    }
    for (const p of PREPAROS) {
      const r = inserirItem.run(p.slug, p.nome, 'preparo', p.unidade, p.unidade_label ?? null, p.porcao ?? null, p.categoria ?? null, p.armazenamento ?? null, p.validade_dias ?? null, p.avisos ?? null, null, null);
      idPorSlug.set(p.slug, Number(r.lastInsertRowid));
    }

    const inserirReceita = db.prepare('INSERT INTO receitas (item_id, rendimento_qtd, fracionavel, fonte, avisos) VALUES (?, ?, ?, ?, ?)');
    const inserirLinha = db.prepare('INSERT INTO receita_ingredientes (receita_item_id, item_id, qtd, obs) VALUES (?, ?, ?, ?)');
    for (const p of PREPAROS) {
      if (p.rend == null) continue;
      const id = idPorSlug.get(p.slug);
      inserirReceita.run(id, p.rend, p.fracionavel ? 1 : 0, p.fonte ?? null, null);
      receitas++;
      for (const [slug, qtd, obs] of p.ings ?? []) inserirLinha.run(id, itemId(slug, `a receita "${p.slug}"`), qtd, obs ?? null);
    }

    // Medidas (concha -> gramas)
    const inserirMedida = db.prepare('INSERT INTO medidas (item_id, nome, qtd, confianca, nota) VALUES (?, ?, ?, ?, ?)');
    const medidaId = new Map();
    for (const [slug, nome, qtd, confianca, nota] of MEDIDAS) {
      const r = inserirMedida.run(itemId(slug, 'uma medida'), nome, qtd, confianca, nota ?? null);
      medidaId.set(`${slug}|${nome}`, Number(r.lastInsertRowid));
    }

    // Lanches
    const inserirLanche = db.prepare('INSERT INTO lanches (nome, categoria, ordem) VALUES (?, ?, ?)');
    const inserirComp = db.prepare('INSERT INTO lanche_componentes (lanche_id, item_id, qtd, medida_id, medida_qtd, confianca, nota) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const lancheId = new Map();
    const qtdMedida = new Map(MEDIDAS.map(([s, nome, q]) => [`${s}|${nome}`, q]));
    LANCHES.forEach(([chave, nome, categoria, comps], ordem) => {
      const lid = Number(inserirLanche.run(nome, categoria, ordem).lastInsertRowid);
      lancheId.set(chave, lid);
      for (const c of comps) {
        const iid = itemId(c.slug, `o lanche "${nome}"`);
        if (c.medida) {
          const chaveM = `${c.slug}|${c.medida}`;
          if (!medidaId.has(chaveM)) throw new Error(`Seed inválido: "${nome}" usa a medida "${c.medida}" de "${c.slug}", que não existe.`);
          inserirComp.run(lid, iid, c.n * qtdMedida.get(chaveM), medidaId.get(chaveM), c.n, c.conf, c.nota);
        } else {
          inserirComp.run(lid, iid, c.qtd, null, null, c.conf, c.nota);
        }
      }
    });

    // Vendas do período
    const periodo = Number(db.prepare('INSERT INTO vendas_periodos (rotulo, inicio, fim, dias, fonte) VALUES (?, ?, ?, ?, ?)').run(PERIODO.rotulo, PERIODO.inicio, PERIODO.fim, PERIODO.dias, PERIODO.fonte).lastInsertRowid);
    const { porLanche, ignorados } = consolidar(LINHAS);
    for (const [chave, v] of porLanche) {
      if (!lancheId.has(chave)) throw new Error(`Seed inválido: venda mapeada para o lanche "${chave}", que não existe.`);
      db.prepare('INSERT INTO vendas (periodo_id, lanche_id, qtd, detalhe) VALUES (?, ?, ?, ?)').run(periodo, lancheId.get(chave), v.qtd, v.partes.join(' + '));
    }
    for (const ig of ignorados) db.prepare('INSERT INTO vendas_ignoradas (periodo_id, produto, qtd, motivo) VALUES (?, ?, ?, ?)').run(periodo, ig.produtos.join(', '), ig.qtd, ig.motivo);

    return { lanches: LANCHES.length, medidas: MEDIDAS.length };
  });
  return { carregado: true, insumos: INSUMOS.length, preparos: PREPAROS.length, receitas, ...resumo };
}
