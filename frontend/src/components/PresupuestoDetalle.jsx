import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import PresupuestoNota from '@/components/PresupuestoNota';

const PresupuestoDetalle = ({ presupuesto, fechaTexto, showCents, onClose }) => {
  const items = (presupuesto?.items || []).map((item) => ({
    producto_id: item.producto_id,
    nombre: item.nombre || item.producto_id,
    cantidad: Number(item.cantidad) || 0,
    precio_unitario: Number(item.precio_unitario) || 0,
    subtotal: Number(((Number(item.precio_unitario) || 0) * (Number(item.cantidad) || 0)).toFixed(2)),
    disponible: true,
  }));

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
          showCents={showCents}
        />

        <Button variant="outline" onClick={onClose}>Cerrar</Button>
      </DialogContent>
    </Dialog>
  );
};

export default PresupuestoDetalle;
