<script setup>
import DocumentoLegal from '../components/DocumentoLegal.vue';
import { LEGAL } from '@/config/legal';
</script>

<template>
  <DocumentoLegal titulo="Términos y condiciones" resumen="Las condiciones para usar el sitio y participar en las jornadas.">
    <p>Al crear una cuenta, registrar una entrada o usar este sitio aceptas estos Términos, el <router-link :to="{ name: 'reglamento' }">Reglamento</router-link> y el <router-link :to="{ name: 'aviso-privacidad' }">Aviso de privacidad</router-link>. Si no estás de acuerdo con alguno, no uses el sitio.</p>

    <h2>1. Qué es {{ LEGAL.sitio }}</h2>
    <p>{{ LEGAL.sitio }} es un juego de pronósticos deportivos de carácter privado y recreativo, organizado por una persona física (en adelante, «el Organizador») para un grupo cerrado de conocidos, amigos y compañeros de trabajo. El nombre {{ LEGAL.sitio }} es solo un nombre de uso: no corresponde a una empresa ni a una razón social.</p>
    <p>El sitio no está afiliado, patrocinado ni respaldado por ninguna liga, club, federación ni proveedor de datos deportivos. Los nombres y escudos de equipos pertenecen a sus titulares y se muestran únicamente con fines informativos.</p>

    <h2>2. Quién puede participar</h2>
    <ul>
      <li>Solo personas de {{ LEGAL.edadMinima }} años o más.</li>
      <li>La participación está dirigida exclusivamente a personas conocidas del Organizador. El Organizador puede aprobar, rechazar, suspender o eliminar cualquier cuenta o entrada cuando lo considere necesario, sin que esto constituya una oferta pública.</li>
      <li>Es tu responsabilidad verificar que participar en un juego de pronósticos con costo de entrada esté permitido para ti según las leyes que te apliquen.</li>
    </ul>

    <h2>3. Tu cuenta</h2>
    <ul>
      <li>Debes dar datos verdaderos y mantenerlos actualizados.</li>
      <li>Eres responsable de la confidencialidad de tu contraseña y de todo lo que se haga con tu cuenta. Avisa de inmediato al Organizador si sospechas de un uso no autorizado.</li>
      <li>Cada persona puede tener una sola cuenta. Sí puedes registrar varias entradas en una jornada, cada una con su propio pago, según el Reglamento.</li>
    </ul>

    <h2>4. Uso permitido y conductas prohibidas</h2>
    <p>Está prohibido, entre otras conductas:</p>
    <ul>
      <li>Crear varias cuentas o usar la cuenta de otra persona para obtener ventajas.</li>
      <li>Subir comprobantes de pago falsos, alterados o que no correspondan al pago de la entrada.</li>
      <li>Usar programas automáticos, intentar acceder a información de otros participantes o vulnerar la seguridad del sitio.</li>
      <li>Ponerle a una entrada nombres ofensivos, difamatorios o engañosos, que vulneren derechos de propiedad intelectual de terceros (como marcas ajenas) o que incluyan datos personales de otras personas.</li>
      <li>Ponerse de acuerdo con otras personas para alterar resultados o premios.</li>
    </ul>
    <p>Si incumples estas reglas, el Organizador puede anular tus entradas, retener premios no entregados, suspender o eliminar tu cuenta, sin perjuicio de otras acciones que procedan.</p>

    <h2>5. Entradas, pagos y premios</h2>
    <ul>
      <li>El costo por entrada y el premio de cada jornada los define y publica el Organizador. Se aplican las reglas del <router-link :to="{ name: 'reglamento' }">Reglamento</router-link>.</li>
      <li>Una entrada solo participa cuando su pago es aprobado por el Organizador. Las entradas con pago pendiente o rechazado no participan ni tienen derecho a premio.</li>
      <li>Los premios se entregan por transferencia bancaria o en efectivo, previa coordinación con el Organizador y dentro del plazo del Reglamento.</li>
      <li>Cada ganador es responsable de las obligaciones fiscales que, en su caso, le correspondan por un premio recibido.</li>
    </ul>

    <h2>6. Resultados</h2>
    <p>Los calendarios y resultados provienen de un proveedor externo de datos deportivos. Los marcadores en vivo y las posiciones que se muestran durante los partidos son <strong>provisionales</strong>. Los resultados oficiales de cada jornada son los que quedan confirmados al finalizar los partidos, y el Organizador puede corregir un error evidente de los datos antes de finalizar la jornada. Una jornada finalizada es definitiva.</p>

    <h2>7. Disponibilidad del servicio</h2>
    <p>El sitio se ofrece «tal como está». No garantizamos que funcione sin interrupciones ni sin errores, ni que los datos deportivos lleguen sin retrasos o errores de su proveedor. Si una falla técnica o un error de datos afecta el registro, los resultados o el cálculo de una jornada, el Organizador podrá corregirlo, aceptar, rehacer o anular entradas y recalcular resultados, con base en la evidencia disponible, y su decisión razonable será definitiva.</p>

    <h2>8. Limitación de responsabilidad</h2>
    <p>En la medida permitida por la ley, el Organizador no responde por pérdidas indirectas, por la imposibilidad de acceder al sitio, por errores o retrasos de proveedores externos, ni por decisiones tomadas por los participantes con base en información provisional. La participación es voluntaria y recreativa: participa solo con montos que puedas permitirte.</p>

    <h2>9. Juego responsable</h2>
    <p>Este es un pasatiempo entre conocidos. Si sientes que participar deja de ser un juego o te causa problemas económicos o personales, deja de participar y, si lo necesitas, avisa al Organizador para suspender tu cuenta.</p>

    <h2>10. Propiedad intelectual</h2>
    <p>El diseño y el contenido propio del sitio pertenecen al Organizador. Está prohibido copiarlos o usarlos con fines comerciales sin autorización. Las marcas, nombres y escudos de equipos y ligas son de sus respectivos dueños.</p>

    <h2>11. Datos personales</h2>
    <p>El tratamiento de tus datos se rige por el <router-link :to="{ name: 'aviso-privacidad' }">Aviso de privacidad</router-link>.</p>

    <h2>12. Cancelar tu cuenta y terminación</h2>
    <p>Puedes pedir la cancelación de tu cuenta en cualquier momento escribiendo a <a :href="`mailto:${LEGAL.correoContacto}`">{{ LEGAL.correoContacto }}</a>. El Organizador también puede suspender o cancelar cuentas por incumplimiento de estos Términos. Cancelar tu cuenta no te libera de obligaciones ya generadas ni te da derecho a premios de jornadas en las que tus entradas no participaron.</p>

    <h2>13. Cambios</h2>
    <p>Podemos actualizar estos Términos. Publicaremos la versión vigente en esta página, con su fecha. Los cambios no afectan a las jornadas que ya hayan cerrado su registro; si sigues usando el sitio después de un cambio, lo aceptas.</p>

    <h2>14. Ley aplicable y controversias</h2>
    <p>Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Antes de acudir a una autoridad, intentaremos resolver cualquier desacuerdo de forma amistosa escribiendo a <a :href="`mailto:${LEGAL.correoContacto}`">{{ LEGAL.correoContacto }}</a>. Para lo que no se pueda resolver así, serán competentes los tribunales que correspondan conforme a la ley.</p>

    <h2>15. Contacto</h2>
    <p>Dudas, aclaraciones o solicitudes: <a :href="`mailto:${LEGAL.correoContacto}`">{{ LEGAL.correoContacto }}</a>.</p>
  </DocumentoLegal>
</template>
