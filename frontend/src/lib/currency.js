/**
 * Formatea un número como moneda con formato argentino:
 * - Punto para separar miles
 * - Coma para separar centavos
 * @param {number} amount - El número a formatear
 * @param {boolean} showCents - Si mostrar o no los centavos
 * @returns {string} El número formateado como moneda
 */
export const formatCurrency = (amount, showCents = true) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return showCents ? '$0,00' : '$0';
  }
  
  const number = Number(amount);
  const options = {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
    useGrouping: true
  };
  
  // Formatear usando Intl para obtener el formato correcto
  let formatted = new Intl.NumberFormat('es-AR', options).format(number);
  
  // Asegurarnos de que el formato sea consistente (punto para miles, coma para decimales)
  return formatted;
};

/**
 * Formatea un número como moneda pero sin el símbolo $
 * Útil para mostrar precios unitarios en tablas
 * @param {number} amount - El número a formatear
 * @param {boolean} showCents - Si mostrar o no los centavos
 * @returns {string} El número formateado
 */
export const formatNumber = (amount, showCents = true) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return showCents ? '0,00' : '0';
  }
  
  const number = Number(amount);
  const options = {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
    useGrouping: true
  };
  
  return new Intl.NumberFormat('es-AR', options).format(number);
};

/**
 * --- INPUTS NUMÉRICOS ---
 * El estado de las pantallas sigue siendo un número crudo con punto decimal
 * ("1234.56"), que es lo que esperan la API y los cálculos. Estas funciones
 * convierten entre ese valor crudo y la vista es-AR (1.234,56) del input.
 */

const agruparMiles = (enteros) =>
  enteros.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * Interpreta el texto es-AR de un input. Reglas:
 * - la coma es siempre separador decimal (1.234,56)
 * - el punto es de miles, salvo que cierre el número con 1 o 2 dígitos
 *   (así "1234.56", que se pega desde una planilla, sigue siendo 1234.56)
 * Esto última evita que el punto insertado por el agrupamiento se confunda
 * con un decimal al seguir escribiendo: "2.000" + "0" => "20.000", no "2,0000".
 */
const separarNumero = (texto, showCents) => {
  const original = String(texto);
  // Si el texto ya tiene el prefijo del input, los puntos son de miles: el
  // usuario está borrando sobre "$ 1.532.000" y "$ 1.532.00" debe ser 153200,
  // no 1532.00. La excepción del punto decimal queda solo para texto crudo
  // pegado desde una planilla ("1234.56").
  const yaFormateado = original.includes('$');
  const s = original.replace(/[\s$]/g, '');
  const negativo = /^-/.test(s);
  const limpio = s.replace(/[^\d.,]/g, '');
  const partes = limpio.split(',');
  const comaFinal = partes.length > 1 && partes[partes.length - 1] === '';

  let parteEntera = partes[0];
  let decimales = partes.slice(1).join('');
  if (partes.length === 1 && showCents && !yaFormateado) {
    const puntoDecimal = parteEntera.match(/^(.*)\.(\d{1,2})$/);
    if (puntoDecimal) {
      parteEntera = puntoDecimal[1];
      decimales = puntoDecimal[2];
    }
  }

  if (!showCents) decimales = '';
  decimales = decimales.replace(/\D/g, '').slice(0, 2);
  if (/^0*$/.test(decimales)) decimales = '';
  const enteros = parteEntera.replace(/\D/g, '').replace(/^0+(?=\d)/, '') || '0';
  return { negativo, enteros, decimales, comaFinal, sinDigitos: !/\d/.test(limpio) };
};

/** Convierte lo que escribe el usuario a valor crudo con punto decimal. */
export const parseNumericInput = (texto, { allowNegative = true, showCents = true } = {}) => {
  if (texto === null || texto === undefined) return '';
  const { negativo, enteros, decimales, sinDigitos } = separarNumero(texto, showCents);
  if (sinDigitos) return negativo && allowNegative ? '-' : '';
  const crudo = decimales ? `${enteros}.${decimales}` : enteros;
  return negativo && allowNegative && crudo !== '0' ? `-${crudo}` : crudo;
};

/** Valor crudo -> texto es-AR listo para mostrar (con $ y agrupado). */
export const formatNumericInput = (crudo, { currency = true, showCents = true } = {}) => {
  if (crudo === null || crudo === undefined || crudo === '') return '';
  const texto = String(crudo);
  if (texto === '-') return '-';

  const negativo = texto.startsWith('-');
  const prefijo = `${negativo ? '-' : ''}${currency ? '$ ' : ''}`;
  const sinSigno = texto.replace('-', '').replace(',', '.');

  if (!showCents) {
    // Mismo redondeo que formatCurrency/formatNumber del resto de la app.
    const numero = Number(sinSigno);
    const entero = Number.isNaN(numero)
      ? agruparMiles(sinSigno || '0')
      : new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0, useGrouping: true }).format(numero);
    return `${prefijo}${entero}`;
  }

  const [enterosCrudos, decimalesCrudos = ''] = sinSigno.split('.');
  const enteros = agruparMiles(enterosCrudos || '0');
  const decimales = (decimalesCrudos || '').padEnd(2, '0').slice(0, 2);
  return `${prefijo}${enteros},${decimales}`;
};

/**
 * Agrupa miles mientras se escribe SIN completar decimales aun, para no
 * pelear con el cursor (ej. "$ 1.234," tiene que seguir permitiendo "5").
 */
export const groupNumericInput = (texto, { currency = true, showCents = true } = {}) => {
  if (texto === null || texto === undefined) return '';
  const { negativo, enteros, decimales, comaFinal, sinDigitos } = separarNumero(texto, showCents);
  if (sinDigitos) return negativo ? '-' : '';

  const prefijo = `${negativo ? '-' : ''}${currency ? '$ ' : ''}`;
  const base = `${prefijo}${agruparMiles(enteros)}`;
  if (!showCents) return base;
  if (comaFinal) return `${base},`;
  if (decimales) return `${base},${decimales}`;
  // Mientras se escribe no completamos los centavos: "$ 20.000" sigue siendo
  // escribible y al perder el foco pasa a "$ 20.000,00".
  return base;
};