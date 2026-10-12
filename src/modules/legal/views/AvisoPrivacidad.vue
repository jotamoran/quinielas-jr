<script setup>
import DocumentoLegal from '../components/DocumentoLegal.vue';
import { LEGAL } from '@/config/legal';
</script>

<template>
  <DocumentoLegal titulo="Aviso de privacidad" resumen="Quién trata tus datos, cuáles pedimos, para qué los usamos y cómo ejercer tus derechos.">
    <p>Este aviso se emite conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares. Léelo antes de crear tu cuenta o participar en una jornada.</p>

    <h2>1. Quién es el responsable</h2>
    <p>{{ LEGAL.sitio }} es un nombre de uso: no es una razón social ni una empresa. Lo organiza una persona física (en adelante, «el Organizador») para un grupo cerrado de conocidos, amigos y compañeros de trabajo. El Organizador es el responsable del tratamiento de tus datos personales.</p>
    <p>No cuenta con un domicilio comercial. Para cualquier asunto relacionado con tus datos personales escribe a <a :href="`mailto:${LEGAL.correoContacto}`">{{ LEGAL.correoContacto }}</a>.</p>

    <h2>2. Qué datos personales recabamos</h2>
    <ul>
      <li><strong>Identificación y cuenta:</strong> nombre completo, nombre de usuario, correo electrónico y contraseña. La contraseña la guarda cifrada el proveedor de autenticación; el Organizador no puede verla.</li>
      <li><strong>Participantes registrados de forma presencial:</strong> el nombre con el que se registra la entrada y, de forma opcional, un correo de contacto.</li>
      <li><strong>Participación:</strong> el nombre de tus entradas, tus pronósticos, aciertos, posiciones, las jornadas en que participas y los cupones que recibes.</li>
      <li><strong>Pago:</strong> método (transferencia, efectivo o cupón), monto, estatus de validación y, en las transferencias, el comprobante que subes (imagen o PDF). Un comprobante puede mostrar tu nombre, banco, fecha, monto y números de cuenta.</li>
      <li><strong>Datos técnicos:</strong> dirección IP, tipo de navegador y fechas de acceso, que generan automáticamente los proveedores de infraestructura por seguridad y funcionamiento.</li>
      <li><strong>Sesión:</strong> información guardada en el almacenamiento local de tu navegador para mantenerte con la sesión iniciada.</li>
    </ul>
    <p>No recabamos datos personales sensibles (como salud, origen étnico, creencias o vida sexual), datos de tarjetas bancarias ni datos de menores de edad. Te pedimos no incluir en los comprobantes información que no sea necesaria; por ejemplo, puedes ocultar tu número de cuenta completo y dejar visibles la fecha, el monto y el nombre de quien paga.</p>

    <h2>3. Para qué usamos tus datos</h2>
    <p>Usamos tus datos para las siguientes finalidades, necesarias para el servicio:</p>
    <ul>
      <li>Crear y administrar tu cuenta y verificar tu identidad al iniciar sesión.</li>
      <li>Registrar tus entradas y pronósticos y validar tus pagos.</li>
      <li>Calcular aciertos, posiciones, ganadores, premios y cupones.</li>
      <li>Mostrar la tabla de posiciones de cada jornada.</li>
      <li>Enviarte correos del servicio: código de verificación, confirmación de registro, avisos sobre tu pago, resultados, premios, cupones y cancelaciones.</li>
      <li>Contactarte para entregarte un premio o aclarar un pago o una entrada.</li>
      <li>Mantener la seguridad del sitio y prevenir fraudes, suplantaciones y usos indebidos.</li>
      <li>Cumplir obligaciones legales y atender requerimientos de autoridades.</li>
    </ul>
    <p><strong>No tenemos finalidades secundarias:</strong> no usamos tus datos para publicidad, mercadotecnia ni perfiles comerciales, y no los vendemos.</p>

    <h2>4. Qué datos ven otros participantes y el público</h2>
    <ul>
      <li>La tabla de posiciones es pública y muestra el nombre de cada entrada (su alias; si no tiene, el nombre completo de la persona), sus aciertos y su posición.</li>
      <li>Cuando cierra el registro de una jornada, cualquier visitante puede ver los pronósticos de cada entrada.</li>
      <li>El nombre por defecto de una entrada es tu nombre de usuario seguido de un número. Puedes cambiarlo al registrarla si prefieres otro nombre.</li>
      <li>Tu correo, tus comprobantes y tus datos de pago <strong>no son públicos</strong>: solo los ven el Organizador y los administradores.</li>
    </ul>

    <h2>5. Con quién compartimos o a quién encargamos el tratamiento</h2>
    <p>No vendemos tus datos ni los transferimos a terceros para sus propios fines. Para operar el sitio usamos proveedores que tratan datos por cuenta del Organizador (encargados) y que se rigen por sus propias políticas:</p>
    <ul>
      <li><strong>Supabase:</strong> base de datos, autenticación y almacenamiento de comprobantes. Los datos se guardan en servidores ubicados en Estados Unidos.</li>
      <li><strong>Cloudflare:</strong> alojamiento del sitio, ejecución de procesos automáticos y seguridad de la red.</li>
      <li><strong>Brevo:</strong> envío de los correos electrónicos del servicio.</li>
      <li><strong>TheSportsDB:</strong> calendarios y resultados deportivos. No recibe datos personales de los participantes.</li>
    </ul>
    <p>Como algunos proveedores operan fuera de México, tus datos pueden almacenarse o procesarse en otros países. Los pagos se hacen por transferencia bancaria o en efectivo: tu banco procesa la transferencia por su cuenta y este sitio no recibe datos de tu cuenta, solo el comprobante que subes. También podremos comunicar datos cuando lo exija una autoridad competente.</p>

    <h2>6. Tus derechos y cómo ejercerlos</h2>
    <p>Tienes derecho a <strong>acceder</strong> a tus datos y saber cómo los tratamos, a <strong>rectificarlos</strong> si son inexactos, a pedir su <strong>cancelación</strong> cuando ya no sean necesarios y a <strong>oponerte</strong> a su tratamiento por causas legítimas. También puedes revocar tu consentimiento y limitar el uso de tus datos.</p>
    <p>Para ejercer estos derechos envía un correo a <a :href="`mailto:${LEGAL.correoContacto}`">{{ LEGAL.correoContacto }}</a> con tu nombre completo, el usuario o correo con el que te registraste, la descripción clara de lo que solicitas y un medio para responderte. Para proteger tu información podremos pedirte que confirmes tu identidad. Te responderemos sin demora y dentro de los plazos que establece la ley.</p>
    <p>Si pides cancelar tus datos, eliminaremos tu cuenta y la información que te identifica, salvo la que debamos conservar por una obligación legal, por una reclamación pendiente o para mantener la integridad de los resultados y premios de jornadas ya finalizadas. En ese último caso se conservarán sin vincularlos a tu identidad cuando sea posible.</p>

    <h2>7. Cuánto tiempo conservamos tus datos</h2>
    <p>Conservamos tus datos mientras tu cuenta esté activa y durante el tiempo necesario para las finalidades de este aviso, para aclarar pagos y premios y para cumplir obligaciones legales. Los comprobantes de pago se conservan solo mientras sean necesarios para validar y aclarar el pago correspondiente; después se eliminan o se desvinculan de tu identidad.</p>

    <h2>8. Seguridad</h2>
    <p>Aplicamos medidas razonables de seguridad: conexión cifrada (HTTPS), contraseñas cifradas por el proveedor de autenticación, acceso por roles (solo los administradores ven pagos y comprobantes) y reglas en la base de datos para que cada persona solo acceda a la información que le corresponde. Ningún sistema es infalible. Si ocurre una vulneración que afecte de forma significativa tus derechos, te lo informaremos por correo electrónico.</p>

    <h2>9. Cookies y tecnologías similares</h2>
    <p>El sitio no usa cookies de publicidad ni herramientas de analítica o rastreo de terceros. Guarda en el almacenamiento local de tu navegador la información necesaria para mantener tu sesión. Puedes borrarla desde la configuración del navegador; hacerlo cerrará tu sesión.</p>

    <h2>10. Menores de edad</h2>
    <p>El sitio es solo para personas de {{ LEGAL.edadMinima }} años o más. Si detectamos que una cuenta pertenece a un menor, la cancelaremos y eliminaremos sus datos.</p>

    <h2>11. Cambios a este aviso</h2>
    <p>Publicaremos cualquier cambio en esta página, con su fecha de actualización. Si cambian las finalidades de forma relevante, te lo avisaremos por correo o dentro del sitio.</p>

    <h2>12. Autoridad</h2>
    <p>Si consideras que tu derecho a la protección de datos personales ha sido vulnerado, puedes acudir a la autoridad competente en la materia (actualmente, la Secretaría Anticorrupción y Buen Gobierno).</p>

    <h2>13. Consentimiento</h2>
    <p>Al crear tu cuenta o participar en una jornada confirmas que leíste este aviso y consientes el tratamiento de tus datos personales conforme a lo que aquí se describe.</p>
  </DocumentoLegal>
</template>
