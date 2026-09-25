const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function respuestaJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

export function vercelAdapter(handler, queryFija = {}) {
  return async ({ request }) => {
    const url = new URL(request.url);
    const headers = {};
    request.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });

    let body = {};
    if (!['GET', 'HEAD'].includes(request.method)) {
      const texto = await request.text();
      if (texto) {
        try {
          body = JSON.parse(texto);
        } catch {
          return respuestaJson({ error: 'El cuerpo debe ser JSON válido' }, 400);
        }
      }
    }

    let statusCode = 200;
    let respuesta;
    const res = {
      status(codigo) {
        statusCode = codigo;
        return res;
      },
      json(payload) {
        respuesta = respuestaJson(payload, statusCode);
        return res;
      },
    };
    const req = {
      method: request.method,
      headers,
      query: { ...Object.fromEntries(url.searchParams), ...queryFija },
      body,
    };

    try {
      await handler(req, res);
    } catch (error) {
      return respuestaJson({ error: error?.message ?? 'Error inesperado' }, 500);
    }
    return respuesta ?? respuestaJson({ error: 'La función no produjo respuesta' }, 500);
  };
}
