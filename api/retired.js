export default function handler(_req, res) {
  res.status(410).setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.end(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Sitio retirado</title></head>
<body><h1>Sitio retirado</h1><p>Quinielas JR ahora está disponible en <a href="https://quinielas-jr.pages.dev">quinielas-jr.pages.dev</a>.</p></body>
</html>`);
}
