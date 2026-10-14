PRAGMA foreign_keys = ON;

-- Tudo que tem quantidade: insumo (comprado) ou preparo (feito na casa, com receita).
-- Cada item tem UMA unidade base (g, ml ou un). Líquidos são tratados como 1 g = 1 ml.
CREATE TABLE IF NOT EXISTS itens (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  slug           TEXT NOT NULL UNIQUE,
  nome           TEXT NOT NULL,
  tipo           TEXT NOT NULL CHECK (tipo IN ('insumo', 'preparo')),
  unidade        TEXT NOT NULL CHECK (unidade IN ('g', 'ml', 'un')),
  unidade_label  TEXT,                               -- ex.: "pão", "fatia" (só exibição quando unidade = un)
  porcao_qtd     REAL CHECK (porcao_qtd IS NULL OR porcao_qtd > 0),  -- peso/qtd padrão de 1 porção
  aproveitamento REAL NOT NULL DEFAULT 1 CHECK (aproveitamento > 0 AND aproveitamento <= 1), -- fração aproveitável do que se compra
  categoria      TEXT,
  armazenamento  TEXT,
  validade_dias  INTEGER,
  avisos         TEXT,
  embalagem_qtd  REAL CHECK (embalagem_qtd IS NULL OR embalagem_qtd > 0), -- tamanho da embalagem de compra, na unidade do item (ex.: 1500 g)
  embalagem_nome TEXT,                                                    -- ex.: "pacote"
  criado_em      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Medidas caseiras de um item: concha, tira, fatia... e quanto cada uma vale na unidade do item.
-- Ex.: muçarela ralada, "Concha 85 ml" = 50 g. A cozinha mede em concha; a compra é em kg.
CREATE TABLE IF NOT EXISTS medidas (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id   INTEGER NOT NULL REFERENCES itens(id) ON DELETE CASCADE,
  nome      TEXT NOT NULL,
  qtd       REAL NOT NULL CHECK (qtd > 0),   -- quanto vale 1 medida, na unidade do item
  confianca TEXT NOT NULL DEFAULT 'confirmado' CHECK (confianca IN ('confirmado', 'estimado', 'pendente')),
  nota      TEXT,
  UNIQUE (item_id, nome)
);

-- Receita de um preparo: quanto rende UM lote e o que entra nele.
CREATE TABLE IF NOT EXISTS receitas (
  item_id        INTEGER PRIMARY KEY REFERENCES itens(id) ON DELETE CASCADE,
  rendimento_qtd REAL NOT NULL CHECK (rendimento_qtd > 0),   -- na unidade do preparo
  fracionavel    INTEGER NOT NULL DEFAULT 0,                 -- 1 = pode fazer meio lote; 0 = só lote inteiro
  fonte          TEXT,
  avisos         TEXT
);

CREATE TABLE IF NOT EXISTS receita_ingredientes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  receita_item_id INTEGER NOT NULL REFERENCES receitas(item_id) ON DELETE CASCADE,
  item_id         INTEGER NOT NULL REFERENCES itens(id) ON DELETE RESTRICT,
  qtd             REAL NOT NULL CHECK (qtd > 0),             -- por lote, na unidade do ingrediente
  obs             TEXT,
  UNIQUE (receita_item_id, item_id)
);

CREATE TABLE IF NOT EXISTS lanches (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nome      TEXT NOT NULL UNIQUE,
  meta_qtd  INTEGER NOT NULL DEFAULT 0 CHECK (meta_qtd >= 0),  -- meta de produção atual
  ativo     INTEGER NOT NULL DEFAULT 1,
  categoria TEXT NOT NULL DEFAULT 'Outros',                    -- Sanduíche, Wrap, Salada, Sobremesa, Adicional
  ordem     INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- O que vai em UM lanche.
-- Sem medida: qtd na unidade do item (g, ml ou un).
-- Com medida (ex.: 1 concha de 85 ml): medida_qtd x medida.qtd; `qtd` guarda o valor já convertido.
-- confianca: 'pendente' = a cozinha ainda não informou a quantidade (qtd = 0).
CREATE TABLE IF NOT EXISTS lanche_componentes (
  lanche_id  INTEGER NOT NULL REFERENCES lanches(id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES itens(id) ON DELETE RESTRICT,
  qtd        REAL NOT NULL CHECK (qtd >= 0),
  medida_id  INTEGER REFERENCES medidas(id) ON DELETE RESTRICT,
  medida_qtd REAL CHECK (medida_qtd IS NULL OR medida_qtd > 0),
  confianca  TEXT NOT NULL DEFAULT 'confirmado' CHECK (confianca IN ('confirmado', 'estimado', 'pendente')),
  nota       TEXT,
  PRIMARY KEY (lanche_id, item_id)
);

-- Estoque = soma dos movimentos (entrada +, saída -, contagem = ajuste até o valor contado).
CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id   INTEGER NOT NULL REFERENCES itens(id) ON DELETE CASCADE,
  qtd       REAL NOT NULL,
  tipo      TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'contagem')),
  obs       TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mov_item ON estoque_movimentos(item_id);

CREATE VIEW IF NOT EXISTS estoque_atual AS
  SELECT i.id AS item_id, COALESCE(SUM(m.qtd), 0) AS qtd
  FROM itens i LEFT JOIN estoque_movimentos m ON m.item_id = i.id
  GROUP BY i.id;

-- Marcações da lista de compras ("já comprei").
CREATE TABLE IF NOT EXISTS compras_checks (
  item_id INTEGER PRIMARY KEY REFERENCES itens(id) ON DELETE CASCADE,
  marcado INTEGER NOT NULL DEFAULT 0
);

-- Vendas por período (vindas do relatório do sistema de caixa), já associadas aos lanches.
CREATE TABLE IF NOT EXISTS vendas_periodos (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  rotulo TEXT NOT NULL,
  inicio TEXT NOT NULL,
  fim    TEXT NOT NULL,
  dias   INTEGER NOT NULL CHECK (dias > 0),
  fonte  TEXT,
  ativo  INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS vendas (
  periodo_id INTEGER NOT NULL REFERENCES vendas_periodos(id) ON DELETE CASCADE,
  lanche_id  INTEGER NOT NULL REFERENCES lanches(id) ON DELETE CASCADE,
  qtd        REAL NOT NULL CHECK (qtd >= 0),
  detalhe    TEXT,
  PRIMARY KEY (periodo_id, lanche_id)
);
-- Produtos vendidos que não entram na conta (bebidas, box sem composição...).
CREATE TABLE IF NOT EXISTS vendas_ignoradas (
  periodo_id INTEGER NOT NULL REFERENCES vendas_periodos(id) ON DELETE CASCADE,
  produto    TEXT NOT NULL,
  qtd        REAL NOT NULL,
  motivo     TEXT
);
