import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useConfigSafe } from '@/context/ConfigContext';
import { formatNumericInput, groupNumericInput, parseNumericInput } from '@/lib/currency';

/**
 * Input numérico con formato argentino (1.234,56) y símbolo $ dentro del campo.
 *
 * El valor que entra y sale es el crudo con punto decimal ("1234.56"), así
 * puede reemplazar a un <Input type="number"> sin tocar el estado ni la API.
 * Mantiene el cursor mientras se escribe y muestra el formato canónico al
 * perder el foco.
 */
const CurrencyInput = forwardRef(function CurrencyInput(
  {
    value,
    onChange,
    currency = true,
    showCents: showCentsProp,
    allowNegative = true,
    onFocus,
    onBlur,
    ...props
  },
  ref
) {
  const config = useConfigSafe();
  const showCents = showCentsProp === undefined ? (config?.showCents ?? true) : showCentsProp;
  const inputRef = useRef(null);
  useImperativeHandle(ref, () => inputRef.current, []);

  const crudo = value === null || value === undefined ? '' : String(value);
  const [draft, setDraft] = useState(null);

  const opciones = { currency, showCents };

  // Si el valor cambia desde afuera (otro tab, reset del form), descartamos
  // el borrador para que vuelva a mostrarse el formato canónico.
  useEffect(() => {
    if (draft === null) return;
    if (parseNumericInput(draft, { allowNegative, showCents }) !== crudo) {
      setDraft(null);
    }
  }, [crudo, draft, allowNegative, showCents]);

  const display = draft !== null ? draft : formatNumericInput(crudo, opciones);

  const handleChange = (event) => {
    const texto = event.target.value;
    const cursor = event.target.selectionStart ?? texto.length;
    const digitosAntes = (texto.slice(0, cursor).match(/\d/g) || []).length;

    setDraft(groupNumericInput(texto, opciones));
    onChange?.(parseNumericInput(texto, { allowNegative, showCents }));

    // El formato inserta puntos/comas: recolocamos el cursor después del
    // mismo dígito que tenía el usuario antes del render.
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      let pos = 0;
      let vistos = 0;
      while (pos < input.value.length && vistos < digitosAntes) {
        if (/\d/.test(input.value[pos])) vistos += 1;
        pos += 1;
      }
      try {
        input.setSelectionRange(pos, pos);
      } catch (_) {
        // Algunos inputMode no soportan selección; no es crítico.
      }
    });
  };

  return (
    <Input
      {...props}
      ref={inputRef}
      type="text"
      inputMode={showCents ? 'decimal' : 'numeric'}
      value={display}
      onChange={handleChange}
      onFocus={(event) => {
        setDraft(formatNumericInput(crudo, opciones));
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setDraft(null);
        onBlur?.(event);
      }}
    />
  );
});

export default CurrencyInput;
