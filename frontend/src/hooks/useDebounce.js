import { useState, useEffect } from 'react';

/**
 * Hook para implementar debouncing
 * @param {any} value - El valor a hacer debouncing
 * @param {number} delay - Tiempo de espera en milisegundos
 * @returns {any} El valor con debouncing aplicado
 */
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};