/**
 * Formatea un número como moneda con formato argentino:
 * - Punto para separar miles
 * - Coma para separar centavos
 * @param {number} amount - El número a formatear
 * @returns {string} El número formateado como moneda
 */
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '$0,00';
  }
  
  const number = Number(amount);
  const options = {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
 * @returns {string} El número formateado
 */
export const formatNumber = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0,00';
  }
  
  const number = Number(amount);
  const options = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  };
  
  return new Intl.NumberFormat('es-AR', options).format(number);
};