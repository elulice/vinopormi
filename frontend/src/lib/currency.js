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