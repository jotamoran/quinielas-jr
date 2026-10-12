<script setup>
import DocumentoLegal from '../components/DocumentoLegal.vue';
import { LEGAL } from '@/config/legal';
</script>

<template>
  <DocumentoLegal titulo="Reglamento" resumen="Cómo se juega, cómo se calculan los aciertos y cómo se reparten los premios.">
    <p>Este Reglamento forma parte de los <router-link :to="{ name: 'terminos' }">Términos y condiciones</router-link>. Al registrar una entrada aceptas todo lo que aquí se establece.</p>

    <h2>1. Definiciones</h2>
    <ul>
      <li><strong>Jornada:</strong> conjunto de partidos que el Organizador publica para jugar, normalmente nueve.</li>
      <li><strong>Entrada:</strong> un registro de pronósticos para una jornada, con su propio nombre y su propio pago.</li>
      <li><strong>Pronóstico:</strong> tu elección para un partido: <strong>L</strong> (gana el local), <strong>E</strong> (empate) o <strong>V</strong> (gana el visitante).</li>
      <li><strong>Acierto:</strong> un pronóstico que coincide con el resultado oficial del partido.</li>
      <li><strong>Cierre del registro:</strong> la fecha y hora publicadas en cada jornada, en horario del centro de México.</li>
      <li><strong>Organizador:</strong> la persona física que organiza {{ LEGAL.sitio }}.</li>
    </ul>

    <h2>2. Cómo se juega</h2>
    <ol>
      <li>En cada jornada debes elegir <strong>L, E o V para todos los partidos</strong>. No se acepta una entrada con pronósticos incompletos.</li>
      <li>Puedes registrar varias entradas en la misma jornada. Cada una lleva un nombre (hasta 40 caracteres) y se paga por separado. Si no le pones nombre, se usa tu nombre de usuario seguido de un número.</li>
      <li>Los nombres de las entradas se muestran en la tabla pública. No pueden ser ofensivos, engañosos ni incluir datos personales de otras personas; el Organizador puede cambiarlos.</li>
      <li>Si el Organizador registra una entrada por ti de forma presencial, se aplican las mismas reglas.</li>
    </ol>

    <h2>3. Registro y cierre</h2>
    <ul>
      <li>Puedes registrar y editar tus pronósticos <strong>hasta el cierre del registro</strong>. El cierre queda al menos 5 minutos antes del primer partido.</li>
      <li>Después del cierre no se pueden registrar entradas nuevas ni cambiar pronósticos.</li>
      <li>Los pronósticos de cada participante son privados hasta el cierre; desde ese momento cualquier visitante puede verlos. El Organizador y los administradores pueden verlos antes para operar el juego. El premio de la jornada se da a conocer al cierre.</li>
      <li>La hora que cuenta es la del servidor del sitio. Es tu responsabilidad registrar con anticipación y no esperar al último minuto.</li>
    </ul>

    <h2>4. Costo y pago</h2>
    <ul>
      <li>El costo por entrada lo publica el Organizador en cada jornada.</li>
      <li>Puedes pagar por <strong>transferencia</strong> (subiendo tu comprobante en imagen o PDF de hasta 8 MB, legible y a nombre de quien paga), en <strong>efectivo</strong> con el Organizador o con un <strong>cupón</strong>, si tienes uno.</li>
      <li>Si pagas varias entradas con una sola transferencia, el comprobante debe cubrir el monto total.</li>
      <li>Una entrada <strong>solo participa cuando el Organizador aprueba su pago</strong>. Mientras esté pendiente, o si se rechaza, no aparece en la tabla de posiciones ni tiene derecho a premio.</li>
      <li>El pago debe estar aprobado antes de que se finalice la jornada. <strong>Las entradas con pago pendiente en ese momento quedan fuera</strong> del ranking y de los premios, sin que proceda reclamación por ese motivo.</li>
      <li>Un comprobante falso o alterado anula la entrada y puede llevar a las sanciones de los Términos.</li>
    </ul>

    <h2>5. Aciertos y tabla de posiciones</h2>
    <ul>
      <li>Cada acierto suma <strong>un punto</strong>. Gana más quien tenga más aciertos.</li>
      <li>La tabla se ordena por aciertos, de mayor a menor. Las entradas con los mismos aciertos comparten posición.</li>
      <li>Durante los partidos la tabla y tus pronósticos muestran el estado <strong>provisional</strong> según el marcador en vivo, que cambia mientras se juega. Lo definitivo es el resultado oficial al terminar cada partido.</li>
      <li>El <strong>resultado oficial</strong> es el marcador final del partido según el proveedor de datos deportivos. Si un partido tiene alguna situación especial (por ejemplo tiempo extra o penales) o si el dato parece erróneo, el Organizador decide con base en la fuente oficial de la liga y lo comunica; antes de finalizar la jornada puede corregir un resultado evidentemente equivocado.</li>
    </ul>

    <h2>6. Premio de la jornada</h2>
    <ul>
      <li>El monto del premio lo define y publica el Organizador para cada jornada.</li>
      <li>Gana la entrada con <strong>más aciertos</strong>.</li>
      <li>Si varias entradas empatan en el primer lugar, <strong>el premio se reparte en partes iguales</strong> entre ellas. Esto incluye el caso en que todas las entradas tengan los mismos aciertos.</li>
      <li>Un participante con varias entradas ganadoras recibe la parte que corresponda a cada una.</li>
    </ul>

    <h2>7. «Por tarugo»</h2>
    <ul>
      <li>La entrada con <strong>menos aciertos</strong> recibe un cupón para registrar una entrada gratis en una jornada posterior.</li>
      <li>El cupón se otorga solo si hay <strong>un único último lugar</strong>. Si dos o más entradas empatan en el último lugar, o todas tienen los mismos aciertos, no se otorga.</li>
      <li>El cupón es personal, se usa una sola vez y <strong>no se puede canjear por dinero</strong>. Se asocia a la cuenta del participante o, en entradas presenciales, a su correo de contacto.</li>
    </ul>

    <h2>8. Cierre de la jornada y entrega de premios</h2>
    <ul>
      <li>Una jornada se finaliza cuando todos sus partidos tienen resultado oficial. Puede hacerse de forma <strong>automática</strong>, pocos minutos después del último resultado y tras confirmarlo con el proveedor, o de forma manual por el Organizador.</li>
      <li>Al finalizar, el ranking, los premios y los cupones quedan definitivos y se envían los correos con los resultados.</li>
      <li>Los ganadores deben <strong>reclamar su premio en un máximo de {{ LEGAL.diasReclamarPremio }} días naturales</strong> contados desde que finaliza la jornada, escribiendo al Organizador o respondiendo su aviso. El Organizador coordina la entrega por transferencia o en efectivo.</li>
      <li>Si pasa ese plazo sin reclamarlo, se pierde el derecho al premio. El Organizador decide su destino y lo informa a los participantes.</li>
    </ul>

    <h2>9. Partidos cancelados, suspendidos o jornadas canceladas</h2>
    <ul>
      <li>Si un partido se cancela, o no se juega dentro del periodo de la jornada, <strong>se excluye</strong>: no cuenta para nadie y los aciertos se calculan con los partidos restantes.</li>
      <li>Si un partido cancelado se reactiva antes del cierre, podrás completar tu pronóstico para ese partido. Si se reactiva después del cierre, las entradas que no tengan pronóstico para él no suman punto en ese partido.</li>
      <li>Si el Organizador <strong>cancela una jornada completa</strong>, las entradas quedan sin efecto, no hay premio y se te devuelve el monto que pagaste por ellas. Te avisaremos por correo.</li>
    </ul>

    <h2>10. Errores técnicos y aclaraciones</h2>
    <ul>
      <li>Si una falla del sitio o de los datos afecta una jornada, el Organizador puede aceptar, corregir o anular entradas y recalcular resultados con base en la evidencia disponible (capturas, comprobantes, registros del sistema).</li>
      <li>Si crees que hay un error en tus aciertos, tu posición o tu premio, escribe a <a :href="`mailto:${LEGAL.correoContacto}`">{{ LEGAL.correoContacto }}</a> <strong>dentro de los {{ LEGAL.diasAclaraciones }} días naturales</strong> posteriores a la finalización de la jornada, con tu usuario y el nombre de la entrada.</li>
      <li>El Organizador revisará la aclaración y responderá. Su decisión, tomada de buena fe y de manera equitativa, es definitiva.</li>
    </ul>

    <h2>11. Conducta</h2>
    <p>Valen las reglas de los Términos: una cuenta por persona, comprobantes verdaderos y nada de colusión ni manipulación. Si se detecta una irregularidad, el Organizador puede anular las entradas involucradas, retener sus premios y suspender las cuentas.</p>

    <h2>12. Cambios al Reglamento</h2>
    <p>El Organizador puede modificar este Reglamento. Los cambios se publican aquí con su fecha y se aplican a partir de la siguiente jornada, salvo que corrijan un error evidente. Una jornada cuyo registro ya cerró se rige por el Reglamento vigente cuando abrió.</p>

    <h2>13. Casos no previstos</h2>
    <p>Cualquier situación que este Reglamento no prevea la resuelve el Organizador de buena fe, de forma equitativa para todos los participantes.</p>
  </DocumentoLegal>
</template>
