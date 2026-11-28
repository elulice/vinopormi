import { forwardRef } from 'react';
import { formatCurrency } from '@/lib/currency';
import { logoImage } from '@/assets/images';

const formatearFecha = (valor) => {
  if (!valor) return '';
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' }).format(fecha);
};

// Misma composición que el sidebar: "Vino" en color de texto y "Por Mí" en acento.
const renderMarca = (nombre) => {
  const texto = nombre || 'Vino por Mí';
  const coincidencia = texto.match(/^(vino)\s+(.+)$/i);
  if (!coincidencia) return <em>{texto}</em>;
  return <>Vino <em>{coincidencia[2]}</em></>;
};

const PresupuestoNota = forwardRef(({
  vinotecaNombre = 'Vino por Mí',
  fechaEmision,
  items = [],
  observaciones = '',
  descuentoMonto = 0,
  total = 0,
  totalOriginal = 0,
  mostrarComparativa = false,
  hayCambios = false,
  showCents = true,
}, ref) => (
  <article ref={ref} className="presupuesto-nota presupuesto-imprimible">
    <header className="presupuesto-nota__header">
      <div className="presupuesto-nota__marca">
        <img src={logoImage} alt="" className="presupuesto-nota__logo" />
        <div className="presupuesto-nota__vinoteca">{renderMarca(vinotecaNombre)}</div>
      </div>
      <div>
        <div className="presupuesto-nota__titulo">Presupuesto</div>
        <div className="presupuesto-nota__fecha">
          {formatearFecha(fechaEmision) || 'Emisión: —'}
        </div>
      </div>
    </header>

    {hayCambios && (
      <div className="presupuesto-nota__aviso">
        Los precios se actualizaron desde la emisión. Esta nota muestra los valores vigentes.
      </div>
    )}

    <div className="presupuesto-nota__columnas">
      <span>Producto</span>
      <span className="presupuesto-nota__num">Cant.</span>
      <span className="presupuesto-nota__num">Precio</span>
      <span className="presupuesto-nota__importe">Subtotal</span>
    </div>

    {items.length > 0 && items.map((item, index) => (
        <div
          className={`presupuesto-nota__fila${item.precio_original != null && item.precio_original !== item.precio_unitario ? ' presupuesto-nota__fila--descuento' : ''}`}
          key={`${item.producto_id || 'item'}-${index}`}
        >
          <span className="presupuesto-nota__nombre">
            {item.nombre || item.producto_id}
            {item.disponible === false && (
              <span className="presupuesto-nota__sin-stock"> · No disponible</span>
            )}
          </span>
          <span className="presupuesto-nota__num">{item.cantidad}</span>
          <span className="presupuesto-nota__num presupuesto-nota__precio">
            {item.precio_original != null && item.precio_original !== item.precio_unitario && (
              <span className="presupuesto-nota__precio-anterior">
                {formatCurrency(item.precio_original, showCents)}
              </span>
            )}
            <span className="presupuesto-nota__precio-final">
              {item.disponible === false ? '—' : formatCurrency(item.precio_unitario, showCents)}
            </span>
          </span>
          <span className="presupuesto-nota__importe">
            {mostrarComparativa && item.precio_original != null
              && item.precio_original !== item.precio_unitario && (
              <span className="presupuesto-nota__precio-anterior">
                {formatCurrency((item.precio_original || 0) * (item.cantidad || 0), showCents)}
              </span>
            )}
            <span className="presupuesto-nota__precio-final">
              {item.disponible === false ? '—' : formatCurrency(item.subtotal, showCents)}
            </span>
          </span>
        </div>
    ))}

    {descuentoMonto > 0 && (
      <div className="presupuesto-nota__descuento">
        <span className="presupuesto-nota__total-label">Descuento</span>
        <span className="presupuesto-nota__descuento-valor">
          - {formatCurrency(descuentoMonto, showCents)}
        </span>
      </div>
    )}

    <div className="presupuesto-nota__total">
      <span className="presupuesto-nota__total-label">Total</span>
      <span className="presupuesto-nota__total-valor">
        {mostrarComparativa && totalOriginal > total && (
          <span className="presupuesto-nota__precio-anterior">
            {formatCurrency(totalOriginal, showCents)}
          </span>
        )}
        <span className="presupuesto-nota__precio-final">
          {formatCurrency(total, showCents)}
        </span>
      </span>
    </div>

    {observaciones && (
      <section className="presupuesto-nota__observaciones">
        <h4>Observaciones</h4>
        <p>{observaciones}</p>
      </section>
    )}

    <div className="presupuesto-nota__pie">
      Precios sujeto a cambios · Consultar disponibilidad
    </div>
  </article>
));

PresupuestoNota.displayName = 'PresupuestoNota';

export default PresupuestoNota;
