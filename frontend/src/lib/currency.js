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

/** Convierte lo que escribe el usuario a valor crudo con punto decimal. */
export const parseNumericInput = (texto, { allowNegative = true, showCents = true } = {}) => {
  if (texto === null || texto === undefined) return '';
  let s = String(texto).replace(/[\s$]/g, '');
  const negativo = allowNegative && /^-/.test(s);
  s = s.replace(/[^\d.,]/g, '');
  if (!s) return negativo ? '-' : '';

  let enteros = s;
  let decimales = '';

  const ultimoPunto = s.lastIndexOf('.');
  const ultimaComa = s.lastIndexOf(',');

  if (!showCents) {
    // Sin centavos, todos los puntos son de miles y la coma (si hay) inicia
    // la parte decimal, que se descarta.
    const corte = ultimaComa >= 0 ? ultimaComa : s.length;
    enteros = s.slice(0, corte).replace(/[^\d]/g, '');
  } else {
    const separador = Math.max(ultimoPunto, ultimaComa);
    if (separador >= 0) {
      enteros = s.slice(0, separador).replace(/[.,]/g, '');
      decimales = s.slice(separador + 1).replace(/[.,]/g, '');
      const puntos = (s.match(/\./g) || []).length;
      // Sin coma decimal, varios puntos (o "1.234") son agrupamiento es-AR.
      // Con coma, los puntos son miles y la coma manda los centavos.
      if (ultimaComa === -1 && (puntos > 1 || (/^\d{3}$/.test(decimales) && enteros.length <= 3))) {
        enteros = s.replace(/\./g, '');
        decimales = '';
      }
    }
  }

  if (/^0*$/.test(decimales)) decimales = '';
  enteros = enteros.replace(/^0+(?=\d)/, '') || '0';
  const crudo = decimales ? `${enteros}.${decimales}` : enteros;
  return negativo && crudo !== '0' ? `-${crudo}` : crudo;
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
  const negativo = /^-/.test(texto) ? '-' : '';
  const prefijo = `${negativo ? '-' : ''}${currency ? '$ ' : ''}`;
  const s = texto.replace(/[^\d.,]/g, '');

  if (!showCents) {
    const enteros = agruparMiles(s.replace(/[.,]/g, ''));
    return `${prefijo}${enteros}`;
  }

  const separador = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  const enteros = agruparMiles((separador >= 0 ? s.slice(0, separador) : s).replace(/[^\d]/g, ''));
  let resto = separador >= 0 ? s.slice(separador) : '';
  // Si escriben "1234.56", mostramos la coma decimal de es-AR.
  if (resto.startsWith('.') && /\d/.test(resto.slice(1))) resto = `,${resto.slice(1)}`;

  return `${prefijo}${enteros}${resto}`;
};