import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import PresupuestoNota from '@/components/PresupuestoNota';

const PresupuestoDetalle = ({ presupuesto, fechaTexto, showCents, onClose }) => {
  const items = (presupuesto?.items || []).map((item) => {
    const cantidad = Number(item.cantidad) || 0;
    const precioUnitario = Number(item.precio_unitario) || 0;
    const precioOriginal = item.precio_original != null ? Number(item.precio_original) : null;
    return {
      producto_id: item.producto_id,
      nombre: item.nombre || item.producto_id,
      cantidad,
      precio_unitario: precioUnitario,
      precio_original: precioOriginal != null && Number.isFinite(precioOriginal) ? precioOriginal : null,
      subtotal: Number((precioUnitario * cantidad).toFixed(2)),
      disponible: true,
    };
  });
  const totalOriginal = Number(items.reduce(
    (sum, item) => sum + (item.precio_original != null ? item.precio_original : item.precio_unitario) * item.cantidad,
    0
  ).toFixed(2));

  return (
    <Dialog open={Boolean(presupuesto)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-lg bg-background border-border p-4 sm:p-6"
        style={{ maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto' }}
      >
        <DialogHeader>
          <DialogTitle>Detalle del presupuesto</DialogTitle>
          <span
            className="text-xs font-medium"
            style={{ color: presupuesto?.activo === false ? 'var(--vpm-neg)' : 'var(--vpm-pos)' }}
          >
            {presupuesto?.activo === false ? 'Revocado' : 'Activo'}
          </span>
        </DialogHeader>

        <p className="vpm-hint" style={{ marginTop: 0 }}>
          Emitido el {fechaTexto} · {presupuesto?.usuario_nombre || presupuesto?.usuario_id || '—'}
        </p>

        <PresupuestoNota
          vinotecaNombre={presupuesto?.vinoteca_nombre}
          fechaEmision={presupuesto?.fecha_emision}
          items={items}
          observaciones={presupuesto?.observaciones || ''}
          descuentoMonto={Number(presupuesto?.descuento_monto) || 0}
          total={Number(presupuesto?.total) || 0}
          totalOriginal={totalOriginal}
          mostrarComparativa={presupuesto?.mostrar_comparativa === true}
          showCents={showCents}
        />

        <Button variant="outline" onClick={onClose}>Cerrar</Button>
      </DialogContent>
    </Dialog>
  );
};

export default PresupuestoDetalle;
