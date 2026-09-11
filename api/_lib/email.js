import nodemailer from 'nodemailer';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const plantillaBase = readFileSync(path.join(__dirname, 'templates', 'base.html'), 'utf-8');

export function escaparHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let transportador;

function getTransportador() {
  if (!transportador) {
    transportador = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
  }
  return transportador;
}

export function renderizarCorreo({ heading, bodyHtml }) {
  return plantillaBase.replace('{{HEADING}}', heading).replace('{{BODY}}', bodyHtml);
}

export async function enviarCorreo({ to, subject, heading, bodyHtml }) {
  const html = renderizarCorreo({ heading, bodyHtml });
  await getTransportador().sendMail({
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
    to,
    subject,
    html,
  });
}
