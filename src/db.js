import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
// Em produção (Railway), usa o volume persistente em /data; localmente cai em data/foqui.db
const volumeRailway = process.env.RAILWAY_VOLUME_MOUNT_PATH;
export const CAMINHO_PADRAO = volumeRailway
  ? resolve(volumeRailway, 'foqui.db')
  : resolve(aqui, '../data/foqui.db');

/** Abre (e cria, se preciso) o banco. Use ':memory:' nos testes. */
export function abrirBanco(caminho = process.env.FOQUI_DB || CAMINHO_PADRAO) {
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
  const db = new DatabaseSync(caminho);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const jaExistia = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'itens'").get();
  if (jaExistia && !db.prepare("SELECT 1 FROM pragma_table_info('itens') WHERE name = 'embalagem_qtd'").get()) {
    db.close();
    throw new Error('Este banco foi criado por uma versão anterior. Rode "npm run reset" para recriar (apaga os dados).');
  }
  db.exec(readFileSync(resolve(aqui, 'schema.sql'), 'utf8'));
  return db;
}

/** Executa fn dentro de uma transação; desfaz tudo se lançar erro. */
export function transacao(db, fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
