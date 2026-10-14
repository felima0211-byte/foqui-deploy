import { randomBytes, timingSafeEqual } from 'node:crypto';

const SENHA = process.env.FOQUI_SENHA || 'foqui2026';
const TOKEN = process.env.FOQUI_TOKEN || 'foqui-acesso-2026';
const NOME_COOKIE = 'foqui_sess';
const sessoes = new Set();

function senhaOk(s) {
  const a = Buffer.from(s ?? '');
  const b = Buffer.from(SENHA);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function novaSessao() {
  const id = randomBytes(24).toString('hex');
  sessoes.add(id);
  return id;
}

function sessaoValida(req) {
  const header = req.headers.cookie ?? '';
  for (const parte of header.split(';')) {
    const [k, v] = parte.trim().split('=');
    if (k === NOME_COOKIE && sessoes.has(v)) return true;
  }
  return false;
}

function tokenValido(url) {
  return (url.searchParams.get('token') ?? '') === TOKEN;
}

const PAGINA_LOGIN = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Foqui Tech — Acesso</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{min-height:100vh;background:#1f4d3f;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif;padding:24px}
  .stripes{position:fixed;top:0;left:0;right:0;height:14px;background:repeating-linear-gradient(90deg,#1f4d3f 0 14px,#f4a7be 14px 28px)}
  .card{background:#f4e9ce;border-radius:24px;padding:40px 36px;width:100%;max-width:380px;text-align:center;border:3px solid #f4a7be}
  h1{font-family:'Alfa Slab One',serif;font-size:36px;color:#1f4d3f;margin-bottom:6px}
  .sub{color:#587468;font-size:15px;margin-bottom:32px;font-style:italic}
  label{display:block;text-align:left;font-size:14px;font-weight:600;color:#1f4d3f;margin-bottom:6px}
  input{width:100%;padding:12px 14px;border:2px solid #1f4d3f;border-radius:12px;font-size:16px;background:#fff9e8;color:#1f4d3f;outline:none}
  input:focus{border-color:#f4a7be;box-shadow:0 0 0 3px #1f4d3f}
  .erro{background:#f9cfd9;color:#a6234b;border-radius:10px;padding:10px 14px;font-size:14px;margin-bottom:16px;display:none}
  .erro.vis{display:block}
  button{margin-top:20px;width:100%;padding:14px;background:#1f4d3f;color:#f4e9ce;border:none;border-radius:999px;font-size:17px;font-weight:700;cursor:pointer;font-family:inherit}
  button:hover{background:#2a6655}
</style>
</head>
<body>
<div class="stripes"></div>
<div class="card">
  <h1>Foqui Tech</h1>
  <div class="sub">Painel de produção</div>
  <form method="POST" action="/login">
    <div class="erro" id="e">Senha incorreta. Tente novamente.</div>
    <label for="s">Senha de acesso</label>
    <input type="password" id="s" name="senha" autocomplete="current-password" autofocus>
    <button type="submit">Entrar</button>
  </form>
</div>
<script>
  if(location.search.includes('erro')) document.getElementById('e').classList.add('vis');
</script>
</body>
</html>`;

export { senhaOk, novaSessao, sessaoValida, tokenValido, NOME_COOKIE, PAGINA_LOGIN };
