const PLANTILLA_BASE = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f2f2f2;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:24px 0;">
      <tr><td align="center"><table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#0a3622;padding:20px;text-align:center;"><span style="color:#ffb80c;font-size:22px;font-weight:bold;">Quinielas JR</span></td></tr>
        <tr><td style="padding:24px;color:#1a1a1a;"><h2 style="color:#0f5132;margin-top:0;">{{HEADING}}</h2>{{BODY}}</td></tr>
        <tr><td style="padding:16px 24px;background:#f2f2f2;color:#666;font-size:12px;">Quinielas JR — este correo se generó automáticamente, no respondas a este mensaje.</td></tr>
      </table></td></tr>
    </table>
  </body>
</html>`;

export function escaparHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (caracter) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[caracter]);
}

export function renderizarCorreo({ heading, bodyHtml }) {
  return PLANTILLA_BASE.replace('{{HEADING}}', heading).replace('{{BODY}}', bodyHtml);
}

export async function enviarCorreo({ to, subject, heading, bodyHtml }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('Falta configurar BREVO_API_KEY');

  const respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      sender: { name: process.env.SMTP_FROM_NAME, email: process.env.SMTP_FROM_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: renderizarCorreo({ heading, bodyHtml }),
    }),
  });
  if (!respuesta.ok) throw new Error(`Brevo respondió ${respuesta.status}: ${await respuesta.text()}`);
}
