import { forwardRef, useRef, useImperativeHandle } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/currency';
import { capitalizeWords } from '@/lib/utils';

const DetalleVentaContent = forwardRef(({ venta, showCents = true, showClientInfo = true }, ref) => {
  const contentRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getContentRef: () => contentRef.current
  }));

  const safeParseDate = (dateStr) => {
    if (!dateStr) return new Date();
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? new Date() : date;
  };

  if (!venta) return null;

  return (
    <div ref={contentRef} className="flex flex-col flex-1 min-h-0 space-y-3 p-1">
      <div className="grid grid-cols-2 gap-2 p-2 bg-muted rounded-md flex-shrink-0 text-xs">
        <div>
          <p className="text-muted-foreground">Fecha</p>
          <p className="font-medium text-xs">
            {format(safeParseDate(venta.fecha), 'dd/MM/yyyy HH:mm', { locale: es })}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Usuario</p>
          <p className="font-medium text-xs">
            {venta.usuario_nombre || 'Usuario desconocido'}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Medio de Pago</p>
          {venta.pagos && venta.pagos.length > 0 ? (
            <div className="font-medium text-xs">
              {venta.pagos.map((pago, idx) => (
                <div key={idx} className="capitalize">
                  {pago.medio_pago?.replace('_', ' ')}: {formatCurrency(pago.monto, showCents)}
                </div>
              ))}
            </div>
          ) : (
            <p className="font-medium capitalize text-xs">
              {venta.medio_pago?.replace('_', ' ') ?? '—'}
            </p>
          )}
        </div>
        {showClientInfo && venta.cliente_nombre && (
          <div className="col-span-2">
            <p className="text-muted-foreground">Cliente</p>
            <p className="font-medium text-xs">{venta.cliente_nombre}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        <h3 className="font-semibold text-sm py-1 flex-shrink-0">Productos</h3>
        <div className="flex-1 overflow-y-auto space-y-1 max-h-[40vh]">
          {venta.detalles?.map((detalle, index) => (
            <div
              key={index}
              className="flex justify-between items-center p-2 bg-muted rounded-md text-xs"
            >
              <div>
                <p className="font-medium text-xs">{capitalizeWords(detalle.producto_nombre)}</p>
                <p className="text-muted-foreground text-xs">
                  {detalle.cantidad} x {formatCurrency(detalle.precio_unitario, showCents)}
                </p>
              </div>
              <div className="text-right">
                <div className="font-semibold text-xs">
                  {formatCurrency(detalle.subtotal, showCents)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {venta.ajuste_monto !== 0 && (
        <div className={`flex justify-between items-center p-2 rounded-md flex-shrink-0 ${venta.ajuste_monto < 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="flex items-center">
            <p className={`font-medium text-xs ${venta.ajuste_monto < 0 ? 'text-green-700' : 'text-red-700'}`}>
              {venta.ajuste_monto < 0 ? 'Descuento' : 'Recargo'}
            </p>
            {venta.ajuste_detalle && (
              <p className="text-xs text-muted-foreground ml-1">
                ({venta.ajuste_detalle})
              </p>
            )}
          </div>
          <p className={`font-semibold text-xs ${venta.ajuste_monto < 0 ? 'text-green-700' : 'text-red-700'}`}>
            {venta.ajuste_monto < 0 ? '-' : '+'}{formatCurrency(Math.abs(venta.ajuste_monto), showCents)}
          </p>
        </div>
      )}

      <div className="flex justify-between items-center p-2 bg-primary/10 rounded-md flex-shrink-0">
        <span className="font-bold text-sm">Total</span>
        <span className="text-lg font-bold text-primary">
          {formatCurrency(venta.total, showCents)}
        </span>
      </div>
    </div>
  );
});

DetalleVentaContent.displayName = 'DetalleVentaContent';

export default DetalleVentaContent;
