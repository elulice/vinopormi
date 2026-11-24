import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useConfigSafe } from '@/context/ConfigContext';
import { formatNumericInput, groupNumericInput, parseNumericInput } from '@/lib/currency';

/**
 * Input numérico con formato argentino (1.234,56) y símbolo $ dentro del campo.
 *
 * El valor que entra y sale es el crudo con punto decimal ("1234.56"), así
 * puede reemplazar a un <Input type="number"> sin tocar el estado ni la API.
 * Mantiene el cursor mientras se escribe y muestra el formato canónico al
 * perder el foco. Incluye flechas de ↑/↓ (y las teclas ArrowUp/ArrowDown)
 * como tenía el input numérico original.
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
    onKeyDown,
    step = 1,
    spinner = true,
    className = '',
    style,
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
  const sinInteraccion = Boolean(props.disabled || props.readOnly);
  const conFlechas = spinner && !sinInteraccion;

  // Si el valor cambia desde afuera (otro tab, reset del form), descartamos
  // el borrador para que vuelva a mostrarse el formato canónico.
  useEffect(() => {
    if (draft === null) return;
    if (parseNumericInput(draft, { allowNegative, showCents }) !== crudo) {
      setDraft(null);
    }
  }, [crudo, draft, allowNegative, showCents]);

  const display = draft !== null ? draft : formatNumericInput(crudo, opciones);

  const aplicarPaso = (direccion) => {
    const base = crudo === '' || crudo === '-' ? '0' : crudo;
    const numero = Number(base);
    const paso = Number(step);
    if (!Number.isFinite(numero) || !Number.isFinite(paso) || paso === 0) return;

    let siguiente = Number((numero + direccion * paso).toFixed(10));
    if (!allowNegative && siguiente < 0) siguiente = 0;
    setDraft(null);
    onChange?.(String(siguiente));
  };

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

  // El wrapper toma el mismo ancho que el input para que las flechas queden
  // pegadas al borde derecho, incluso en campos chicos (cantidad, stock).
  const ancho = className.match(/\bw-[\w[\]./%]+\b/)?.[0] || 'w-full';

  return (
    <div className={`relative ${ancho}`}>
      <Input
        {...props}
        ref={inputRef}
        type="text"
        inputMode={showCents ? 'decimal' : 'numeric'}
        className={className}
        style={{ ...style, paddingRight: conFlechas ? '1.4rem' : style?.paddingRight }}
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
        onKeyDown={(event) => {
          if (conFlechas && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            event.preventDefault();
            aplicarPaso(event.key === 'ArrowUp' ? 1 : -1);
          }
          onKeyDown?.(event);
        }}
      />
      {conFlechas && (
        <div className="absolute right-0 top-0 bottom-0 flex w-5 flex-col items-center justify-center rounded-r-md border-l border-input/60 bg-muted/30">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Aumentar"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => aplicarPaso(1)}
            className="flex h-1/2 w-full items-center justify-center rounded-tr-md hover:bg-muted"
          >
            <ChevronUp className="h-2.5 w-2.5" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Disminuir"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => aplicarPaso(-1)}
            className="flex h-1/2 w-full items-center justify-center rounded-br-md hover:bg-muted"
          >
            <ChevronDown className="h-2.5 w-2.5" />
          </button>
        </div>
      )}
    </div>
  );
});

export default CurrencyInput;
