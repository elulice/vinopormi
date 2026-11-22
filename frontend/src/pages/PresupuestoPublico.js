import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiGetPublic } from '@/lib/api';
import { API } from '@/lib/config';
import { downloadElementAsPDF } from '@/lib/downloadUtils';
import PresupuestoNota from '@/components/PresupuestoNota';
import './Presupuestos.css';

const PresupuestoPublico = () => {
  const { token } = useParams();
  const notaRef = useRef(null);
  const [presupuesto, setPresupuesto] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      setCargando(true);
      setError('');
      try {
        const res = await apiGetPublic(`${API}/public/presupuesto/${encodeURIComponent(token || '')}`);
        if (activo) setPresupuesto(res.data);
      } catch (err) {
        if (activo) {
          setError(
            err.response?.status === 404
              ? 'Este presupuesto no está disponible o fue revocado.'
              : 'No se pudo cargar el presupuesto. Intentá nuevamente más tarde.'
          );
        }
      } finally {
        if (activo) setCargando(false);
      }
    };
    cargar();
    return () => { activo = false; };
  }, [token]);

  if (cargando) {
    return (
      <div className="presupuesto-publico" style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ width: 'min(100%, 480px)' }}>
          <Skeleton variant="title" />
          <SkeletonCard lines={5} />
        </div>
      </div>
    );
  }

  if (error || !presupuesto) {
    return (
      <div className="presupuesto-publico" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="vpm-card" style={{ padding: 28, maxWidth: 480, textAlign: 'center' }}>
          <p className="vpm-heading" style={{ fontSize: 24 }}>Presupuesto</p>
          <p className="vpm-hint" style={{ marginTop: 10 }}>{error || 'Presupuesto no encontrado.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="presupuesto-publico">
      <div className="presupuesto-publico__topbar no-print">
        <div className="vpm-eyebrow">Vino por Mí</div>
        <div className="presupuesto-publico__acciones">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadElementAsPDF(notaRef.current, 'presupuesto')}>
            <Download className="w-4 h-4 mr-2" />
            Descargar PDF
          </Button>
        </div>
      </div>

      <PresupuestoNota
        ref={notaRef}
        vinotecaNombre={presupuesto.vinoteca_nombre}
        fechaEmision={presupuesto.fecha_emision}
        items={presupuesto.items || []}
        observaciones={presupuesto.observaciones}
        descuentoMonto={presupuesto.descuento_monto}
        total={presupuesto.total}
        hayCambios={presupuesto.hay_cambios}
        showCents={false}
      />
    </div>
  );
};

export default PresupuestoPublico;
