import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';
import { capitalizeWords } from '@/lib/utils';

/**
 * Buscador de productos compartido entre Nueva Venta y Presupuestos.
 *
 * Conserva el comportamiento original: debounce de 300 ms, búsqueda por todos
 * los términos (AND), exclusión de productos ya agregados, navegación con
 * flechas/Enter/Escape, cierre al hacer clic fuera y aviso de descuento por
 * cantidad. Expone focus() y clear() para que la pantalla que lo usa maneje
 * el foco de su propia fila.
 */
const ProductSearch = forwardRef(function ProductSearch(
  {
    productos = [],
    excludeIds = [],
    onSelect,
    placeholder = 'Buscar...',
    inputClassName = 'h-7 text-sm pr-8',
    inputId,
    inputName,
    formatPrecio = (producto) => `$${producto?.precio_unitario}`,
    autoFocus = false,
  },
  ref
) {
  const [termino, setTermino] = useState('');
  const [activo, setActivo] = useState(false);
  const [indiceSeleccionado, setIndiceSeleccionado] = useState(0);
  const inputRef = useRef(null);
  const resultRefs = useRef([]);
  const containerRef = useRef(null);
  const terminoDebounced = useDebounce(termino, 300);
  const excludeKey = (excludeIds || []).join(',');

  const resultados = useMemo(() => {
    const excluidos = new Set(excludeKey ? excludeKey.split(',') : []);
    const disponibles = (productos || []).filter((producto) => !excluidos.has(producto.id));

    const texto = terminoDebounced.trim().toLowerCase();
    if (!texto) return disponibles;

    const terminos = texto.split(/\s+/).filter(Boolean);
    return disponibles.filter((producto) => {
      const nombre = (producto.nombre || '').toLowerCase();
      return terminos.length > 1
        ? terminos.every((termino) => nombre.includes(termino))
        : nombre.includes(texto);
    });
  }, [productos, excludeKey, terminoDebounced]);

  useEffect(() => {
    setIndiceSeleccionado(0);
    resultRefs.current = [];
  }, [terminoDebounced]);

  // Cerrar el dropdown al hacer clic fuera, sin borrar lo escrito para que se
  // pueda retomar la búsqueda (mismo comportamiento que Nueva Venta).
  useEffect(() => {
    if (!activo) return undefined;
    const handleClickOutside = (event) => {
      if (containerRef.current?.contains(event.target)) return;
      setActivo(false);
      setIndiceSeleccionado(0);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activo]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => {
      setTermino('');
      setActivo(false);
      setIndiceSeleccionado(0);
      resultRefs.current = [];
    },
  }), []);

  const elegir = useCallback((producto) => {
    onSelect?.(producto);
    setTermino('');
    setActivo(false);
    setIndiceSeleccionado(0);
    resultRefs.current = [];
  }, [onSelect]);

  const moverSeleccion = (siguiente) => {
    setIndiceSeleccionado(siguiente);
    setTimeout(() => {
      resultRefs.current[siguiente]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 0);
  };

  const handleKeyDown = (event) => {
    if (!activo || !termino) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moverSeleccion(Math.min(indiceSeleccionado + 1, resultados.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        moverSeleccion(Math.max(indiceSeleccionado - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (resultados[indiceSeleccionado]) elegir(resultados[indiceSeleccionado]);
        break;
      case 'Escape':
        event.preventDefault();
        setTermino('');
        setActivo(false);
        setIndiceSeleccionado(0);
        resultRefs.current = [];
        break;
      default:
        break;
    }
  };

  const mostrarDropdown = activo && Boolean(termino);

  return (
    <div className="relative" ref={containerRef}>
      <Input
        ref={inputRef}
        id={inputId}
        name={inputName}
        placeholder={placeholder}
        value={termino}
        onChange={(event) => {
          setTermino(event.target.value);
          setActivo(true);
        }}
        onFocus={() => setActivo(true)}
        onKeyDown={handleKeyDown}
        className={inputClassName}
      />
      {activo && (
        <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground w-3 h-3 pointer-events-none" />
      )}
      {mostrarDropdown && (
        <div className="search-dropdown absolute z-10 left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg max-h-40 overflow-auto">
          {resultados.length > 0 ? (
            resultados.map((producto, indice) => (
              <div
                key={producto.id}
                ref={(elemento) => { resultRefs.current[indice] = elemento; }}
                className={`px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/40 cursor-pointer flex justify-between items-center transition-colors text-sm ${
                  indice === indiceSeleccionado
                    ? 'bg-blue-100 dark:bg-blue-900/50 border-l-4 border-blue-500 dark:border-blue-400'
                    : ''
                }`}
                onClick={() => elegir(producto)}
              >
                <div>
                  <span>{capitalizeWords(producto.nombre)} - {formatPrecio(producto)}</span>
                  {producto.descuento_cantidad_minima && producto.descuento_precio_unitario && (
                    <div className="text-xs text-green-600 font-medium">
                      ≥{producto.descuento_cantidad_minima}: {formatPrecio({
                        precio_unitario: producto.descuento_precio_unitario,
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {productos.length === 0 ? 'No hay productos' : 'Todos agregados o no coinciden'}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default ProductSearch;
