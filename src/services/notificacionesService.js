import axios from "axios";

const API_NOTIFICACIONES_URL = import.meta.env.VITE_API_NOTIFICACIONES_URL;

export const enviarCorreoNotificacion = async ({
  destinatarios,
  asunto,
  titulo,
  descripcion,
  tipo = "success",
  sistema = "OyL - Envíos",
}) => {
  const colores = {
    success: "green",
    warning: "orange",
    error: "red",
  };

  const color = colores[tipo] || "red";

  const cuerpo = `
    <html>
      <body style="font-family: Arial, sans-serif;">
        <h3 style="color: ${color};">¡¡¡ ${titulo} !!!</h3>
        <p><b>Fecha:</b> ${new Date().toLocaleString("es-MX")}</p>
        <p><b>Descripción:</b><br>${descripcion}</p>
        <hr>
      </body>
    </html>
  `;

  const formData = new FormData();

  formData.append("correo", destinatarios.join(","));
  formData.append("asunto", asunto);
  formData.append("cuerpo", cuerpo);
  formData.append("sistema", sistema);

  const { data } = await axios.post(API_NOTIFICACIONES_URL, formData);

  return data;
};
