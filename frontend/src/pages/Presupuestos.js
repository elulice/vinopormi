import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ban, Check, Copy, Download, ExternalLink, Eye, FilePlus2, FileText, Pencil, Printer, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import CurrencyInput from '@/components/CurrencyInput';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Pagination from '@/components/Pagination';
import ResponsiveTable from '@/components/ResponsiveTable';
import { useConfig } from '@/context/ConfigContext';
import { API } from '@/lib/config';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api';
import { useDataRefresh } from '@/lib/dataEvents';
import { formatCurrency } from '@/lib/currency';
import { downloadElementAsPDF } from '@/lib/downloadUtils';
import ProductSearch from '@/components/ProductSearch';
import PresupuestoNota from '@/components/PresupuestoNota';
import PresupuestoDetalle from '@/components/PresupuestoDetalle';
import './Presupuestos.css';

const VINOTECA_DEFAULT = 'Vino por Mí';
const PRESUPUESTOS_POR_PAGINA = 10;

const formatearFecha = (valor) => {
  const partes = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  }).formatToParts(new Date(valor)).reduce((acc, parte) => ({ ...acc, [parte.type]: parte.value }), {});
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}`;
};

const precioConDescuento = (producto, cantidad) => {
  const lista = Number(producto?.precio_unitario) || 0;
  const minimo = producto?.descuento_cantidad_minima;
  const descuento = producto?.descuento_precio_unitario;
  if (minimo != null && descuento != null && cantidad >= Number(minimo)) {
    return { precio: Number(descuento), precioOriginal: lista };
  }
  return { precio: lista, precioOriginal: null };
};

// Un número solo es monto; con % se aplica sobre el subtotal.
const calcularDescuento = (texto, subtotal) => {
  const limpio = String(texto || '').trim().replace(/\s/g, '');
  if (!limpio || subtotal <= 0) return 0;
  const esPorcentaje = limpio.endsWith('%');
  const valor = Number((esPorcentaje ? limpio.slice(0, -1) : limpio).replace(',', '.'));
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  const monto = esPorcentaje ? (subtotal * valor) / 100 : valor;
  return Number(Math.min(monto, subtotal).toFixed(2));
};

const firmaDe = (lista, observaciones, descuento, mostrarComparativa) => JSON.stringify({
  items: (lista || []).map(({ producto_id, cantidad }) => [producto_id, cantidad]),
  observaciones: (observaciones || '').trim(),
  descuento: (descuento || '').trim(),
  mostrarComparativa,
});

const Presupuestos = () => {
  const { showCents } = useConfig();
  const notaRef = useRef(null);
  const searchRef = useRef(null);
  const cantidadPendienteRef = useRef(null);

  const [productos, setProductos] = useState([]);
  const [items, setItems] = useState([]);
  const [observaciones, setObservaciones] = useState('');
  const [descuento, setDescuento] = useState('');
  const [productoPendiente, setProductoPendiente] = useState(null);
  const [cantidadPendiente, setCantidadPendiente] = useState(1);
  const [mostrarComparativa, setMostrarComparativa] = useState(false);
  const [presupuestos, setPresupuestos] = useState([]);
  const [paginaPresupuestos, setPaginaPresupuestos] = useState(1);
  const [linkGenerado, setLinkGenerado] = useState('');
  const [firmaGuardada, setFirmaGuardada] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [confirmandoGuardar, setConfirmandoGuardar] = useState(false);
  const [cargando, setCargando] = useState(true);

  const cargarProductos = useCallback(async () => {
    try {
      const res = await apiGet(`${API}/productos-paginados?limit=1000`);
      setProductos(Array.isArray(res.data?.productos) ? res.data.productos : []);
    } catch (error) {
      toast.error('No se pudo cargar el catálogo de productos');
    }
  }, []);

  const cargarPresupuestos = useCallback(async () => {
    try {
      const res = await apiGet(`${API}/presupuestos`);
      setPresupuestos(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error('No se pudo cargar los presupuestos guardados');
    }
  }, []);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      setCargando(true);
      await Promise.all([cargarProductos(), cargarPresupuestos()]);
      if (activo) setCargando(false);
    };
    cargar();
    return () => { activo = false; };
  }, [cargarProductos, cargarPresupuestos]);

  useDataRefresh(
    ['presupuestos', 'productos'],
    () => Promise.all([cargarProductos(), cargarPresupuestos()])
  );

  const itemsNota = useMemo(() => items.map((item) => {
    const producto = productos.find((p) => p.id === item.producto_id);
    const { precio, precioOriginal } = precioConDescuento(
      producto || { precio_unitario: item.precio_unitario },
      item.cantidad
    );
    return {
      producto_id: item.producto_id,
      nombre: item.nombre,
      cantidad: item.cantidad,
      precio_unitario: precio,
      precio_original: precioOriginal,
      subtotal: Number((precio * item.cantidad).toFixed(2)),
      disponible: true,
    };
  }), [items, productos]);

  const subtotal = useMemo(
    () => Number(itemsNota.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)),
    [itemsNota]
  );
  const descuentoMonto = useMemo(
    () => calcularDescuento(descuento, subtotal),
    [descuento, subtotal]
  );
  const total = Number((subtotal - descuentoMonto).toFixed(2));
  const totalOriginal = useMemo(
    () => Number(itemsNota.reduce(
      (sum, item) => sum + (item.precio_original != null ? item.precio_original : item.precio_unitario) * item.cantidad,
      0
    ).toFixed(2)),
    [itemsNota]
  );

  const firmaActual = useMemo(
    () => firmaDe(items, observaciones, descuento, mostrarComparativa),
    [items, observaciones, descuento, mostrarComparativa]
  );
  const sinCambios = firmaGuardada !== '' && firmaGuardada === firmaActual;
  const hayCarga = items.length > 0 || Boolean(observaciones.trim()) || Boolean(descuento.trim());

  const totalPaginasPresupuestos = Math.max(1, Math.ceil(presupuestos.length / PRESUPUESTOS_POR_PAGINA));
  const paginaActual = Math.min(paginaPresupuestos, totalPaginasPresupuestos);
  const presupuestosVisibles = presupuestos.slice(
    (paginaActual - 1) * PRESUPUESTOS_POR_PAGINA,
    paginaActual * PRESUPUESTOS_POR_PAGINA
  );

  const estadoPresupuesto = (presupuesto) => (
    <span
      className="text-xs font-medium"
      style={{ color: presupuesto.activo === false ? 'var(--vpm-neg)' : 'var(--vpm-pos)' }}
    >
      {presupuesto.activo === false ? 'Revocado' : 'Activo'}
    </span>
  );

  const accionesPresupuesto = (presupuesto) => {
    const url = `${window.location.origin}/presupuesto/${presupuesto.token}`;
    const revocado = presupuesto.activo === false;
    const botonEliminar = (
      <Button variant="ghost" size="sm" style={{ padding: 4 }} onClick={() => eliminar(presupuesto)} title="Eliminar presupuesto">
        <Trash2 className="w-4 h-4" />
      </Button>
    );
    if (revocado) {
      return (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="outline"
            size="sm"
            style={{ padding: 4 }}
            onClick={() => setDetalle(presupuesto)}
            title="Ver detalle del presupuesto"
          >
            <Eye className="w-4 h-4" />
          </Button>
          {botonEliminar}
        </div>
      );
    }
    return (
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="sm" style={{ padding: 4 }} onClick={() => editarPresupuesto(presupuesto)} title="Editar presupuesto">
          <Pencil className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => copiarLink(url)} title="Copiar link">
          <Copy className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')} title="Abrir link">
          <ExternalLink className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => revocar(presupuesto)} title="Revocar enlace">
          <Ban className="w-4 h-4" />
        </Button>
        {botonEliminar}
      </div>
    );
  };

  const agregarProducto = (producto, cantidad = 1) => {
    setItems((prev) => [
      {
        producto_id: producto.id,
        nombre: producto.nombre,
        cantidad,
        precio_unitario: Number(producto.precio_unitario) || 0,
      },
      ...prev,
    ]);
  };

  // Igual que Nueva Venta: elegir en el dropdown no agrega todavía, lleva el
  // foco a la cantidad y recién Enter confirma y devuelve el foco al buscador.
  const seleccionarProducto = (producto) => {
    setProductoPendiente(producto);
    setCantidadPendiente(1);
    setTimeout(() => {
      cantidadPendienteRef.current?.focus();
      cantidadPendienteRef.current?.select();
    }, 50);
  };

  const confirmarProducto = () => {
    if (!productoPendiente) return;
    agregarProducto(productoPendiente, Math.max(1, parseInt(cantidadPendiente, 10) || 1));
    setProductoPendiente(null);
    setCantidadPendiente(1);
    searchRef.current?.clear();
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const descartarProducto = () => {
    setProductoPendiente(null);
    setCantidadPendiente(1);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const cambiarCantidad = (index, valor) => {
    const cantidad = Math.max(1, parseInt(valor, 10) || 1);
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, cantidad } : item)));
  };

  const quitarProducto = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const copiarLink = async (url) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado al portapapeles');
    } catch {
      const aux = document.createElement('textarea');
      aux.value = url;
      aux.style.position = 'fixed';
      aux.style.opacity = '0';
      document.body.appendChild(aux);
      aux.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(aux);
      if (ok) toast.success('Link copiado al portapapeles');
      else toast.error('No se pudo copiar el link');
    }
  };

  const nuevoPresupuesto = () => {
    setItems([]);
    setObservaciones('');
    setDescuento('');
    setProductoPendiente(null);
    setCantidadPendiente(1);
    setMostrarComparativa(false);
    setLinkGenerado('');
    setFirmaGuardada('');
    setEditando(null);
    setConfirmandoGuardar(false);
  };

  const editarPresupuesto = (presupuesto) => {
    const hayBorradorSinGuardar = Boolean(productoPendiente) || (hayCarga && !sinCambios);
    if (hayBorradorSinGuardar && !window.confirm(
      'Tenés un presupuesto sin guardar. Al editar otro se van a descartar los cambios actuales. ¿Continuar?'
    )) return;

    const itemsCargados = (presupuesto.items || []).map((item) => ({
      producto_id: item.producto_id,
      nombre: item.nombre || item.producto_id,
      cantidad: Number(item.cantidad) || 1,
      precio_unitario: Number(item.precio_unitario) || 0,
    }));
    setItems(itemsCargados);
    setObservaciones(presupuesto.observaciones || '');
    setDescuento(presupuesto.descuento || '');
    setProductoPendiente(null);
    setCantidadPendiente(1);
    setMostrarComparativa(presupuesto.mostrar_comparativa === true);
    setLinkGenerado(`${window.location.origin}/presupuesto/${presupuesto.token}`);
    setFirmaGuardada(firmaDe(
      itemsCargados,
      presupuesto.observaciones,
      presupuesto.descuento,
      presupuesto.mostrar_comparativa === true
    ));
    setEditando({
      id: presupuesto.id,
      token: presupuesto.token,
      fechaEmision: presupuesto.fecha_emision,
    });
    setConfirmandoGuardar(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.success('Presupuesto cargado para editar');
  };

  const guardar = async () => {
    if (items.length === 0) {
      toast.error('Agregá al menos un producto');
      return;
    }
    if (!confirmandoGuardar) {
      setConfirmandoGuardar(true);
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        items: items.map(({ producto_id, cantidad }) => ({ producto_id, cantidad })),
        observaciones: observaciones.trim(),
        descuento: descuento.trim(),
        mostrar_comparativa: mostrarComparativa,
        vinoteca_nombre: VINOTECA_DEFAULT,
      };
      const res = editando
        ? await apiPut(`${API}/presupuestos/${editando.id}`, payload)
        : await apiPost(`${API}/presupuestos`, payload);
      const url = `${window.location.origin}/presupuesto/${res.data.token}`;
      setLinkGenerado(url);
      setFirmaGuardada(firmaActual);
      toast.success(editando ? 'Presupuesto actualizado' : 'Presupuesto guardado y link generado');
      await cargarPresupuestos();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo guardar el presupuesto');
    } finally {
      setGuardando(false);
      setConfirmandoGuardar(false);
    }
  };

  const revocar = async (presupuesto) => {
    if (!window.confirm('¿Revocar el enlace de este presupuesto? Dejará de estar disponible.')) return;
    try {
      await apiPut(`${API}/presupuestos/${presupuesto.id}`, { activo: false });
      toast.success('Enlace revocado');
      await cargarPresupuestos();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo revocar el enlace');
    }
  };

  const eliminar = async (presupuesto) => {
    if (!window.confirm('¿Eliminar definitivamente este presupuesto? Esta acción no se puede deshacer.')) return;
    try {
      await apiDelete(`${API}/presupuestos/${presupuesto.id}`);
      toast.success('Presupuesto eliminado');
      await cargarPresupuestos();
      if (linkGenerado && linkGenerado.endsWith(`/${presupuesto.token}`)) setLinkGenerado('');
      if (detalle?.id === presupuesto.id) setDetalle(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo eliminar el presupuesto');
    }
  };

  const recargarDatos = () => {
    cargarProductos();
    cargarPresupuestos();
  };

  const descargarPDF = () => {
    downloadElementAsPDF(notaRef.current, 'presupuesto-vino-por-mi');
  };

  const acciones = (
    <div className="presupuestos-acciones">
      <Button variant="ghost" size="sm" onClick={recargarDatos} disabled={cargando} title="Actualizar">
        <RefreshCw className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={nuevoPresupuesto} disabled={!hayCarga} title="Limpiar y empezar un presupuesto nuevo">
        <FilePlus2 className="w-4 h-4" />
        Nuevo
      </Button>
      <Button variant="outline" size="sm" onClick={descargarPDF} disabled={items.length === 0} title="Descargar PDF">
        <Download className="w-4 h-4" />
        PDF
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()} disabled={items.length === 0} title="Imprimir">
        <Printer className="w-4 h-4" />
        Imprimir
      </Button>
      <Button
        size="sm"
        onClick={guardar}
        disabled={guardando || items.length === 0 || sinCambios}
        title={sinCambios ? 'El presupuesto no cambió desde el último guardado' : undefined}
      >
        {sinCambios && !confirmandoGuardar ? <Check className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
        {guardando
          ? 'Guardando...'
          : confirmandoGuardar
            ? 'Confirmar'
            : sinCambios
              ? 'Guardado'
              : editando
                ? 'Guardar cambios'
                : 'Generar presupuesto'}
      </Button>
      {confirmandoGuardar && (
        <Button variant="ghost" size="sm" onClick={() => setConfirmandoGuardar(false)}>
          Cancelar
        </Button>
      )}
    </div>
  );

  return (
    <div className="vpm-section vpm-app" style={{ paddingBottom: 24 }}>
      <div className="vpm-card-head" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <p className="vpm-eyebrow">Ventas</p>
          <h1 className="vpm-heading">Presupuestos</h1>
          <p className="vpm-hint">
            {editando
              ? 'Editando un presupuesto. Los cambios se actualizan en el mismo enlace.'
              : 'Generá un enlace público con los precios actualizados.'}
          </p>
        </div>
        {acciones}
      </div>

      <div className="presupuestos-layout">
        <section className="vpm-card" style={{ padding: 16 }}>
          <h2 className="vpm-card-title" style={{ margin: 0, marginBottom: 10 }}>Productos</h2>

          <div style={{ marginBottom: 12 }}>
            <ProductSearch
              ref={searchRef}
              autoFocus
              productos={productos}
              excludeIds={[...items.map((item) => item.producto_id), productoPendiente?.producto_id].filter(Boolean)}
              onSelect={seleccionarProducto}
              placeholder="Buscar producto..."
              formatPrecio={(producto) => formatCurrency(producto?.precio_unitario, showCents)}
            />
          </div>

          {items.length === 0 && !productoPendiente ? (
            <p className="vpm-hint">Sin productos agregados.</p>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              <div className="presupuestos-columnas">
                <span>Producto</span>
                <span className="vpm-num">Cant.</span>
                <span className="vpm-num">Importe</span>
                <span />
              </div>
              {productoPendiente && (
                <div className="presupuestos-item presupuestos-item--pendiente">
                  <span className="presupuestos-item__nombre" title={productoPendiente.nombre}>
                    {productoPendiente.nombre}
                    <button
                      type="button"
                      className="presupuestos-item__descartar"
                      onClick={descartarProducto}
                      title="Descartar producto"
                      aria-label="Descartar producto"
                    >
                      ×
                    </button>
                  </span>
                  <div className="presupuestos-item__cantidad">
                    <CurrencyInput
                      ref={cantidadPendienteRef}
                      aria-label="Cantidad"
                      currency={false}
                      showCents={false}
                      allowNegative={false}
                      value={cantidadPendiente}
                      onChange={(valor) => setCantidadPendiente(Math.max(1, parseInt(valor, 10) || 1))}
                      onKeyDown={(evento) => {
                        if (evento.key === 'Enter') {
                          evento.preventDefault();
                          confirmarProducto();
                        } else if (evento.key === 'Escape') {
                          evento.preventDefault();
                          descartarProducto();
                        }
                      }}
                      style={{ width: '100%', height: 32, padding: '4px 6px' }}
                    />
                  </div>
                  <span className="vpm-num presupuestos-item__monto">
                    {(() => {
                      const cantidad = Number(cantidadPendiente) || 1;
                      const { precio, precioOriginal } = precioConDescuento(productoPendiente, cantidad);
                      return (
                        <>
                          {precioOriginal != null && (
                            <span className="presupuestos-item__anterior">
                              {formatCurrency(precioOriginal * cantidad, showCents)}
                            </span>
                          )}
                          {formatCurrency(precio * cantidad, showCents)}
                        </>
                      );
                    })()}
                  </span>
                  <Button
                    className="presupuestos-item__quitar"
                    variant="ghost"
                    size="sm"
                    style={{ padding: 4 }}
                    onClick={confirmarProducto}
                    title="Agregar producto (Enter)"
                    aria-label="Agregar producto"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              )}
              {items.map((item, index) => {
                const { precio, precioOriginal } = precioConDescuento(
                  productos.find((p) => p.id === item.producto_id) || item,
                  item.cantidad
                );
                return (
                  <div key={`${item.producto_id}-${index}`} className="presupuestos-item">
                    <span className="presupuestos-item__nombre" title={item.nombre}>
                      {item.nombre}
                    </span>
                    <div className="presupuestos-item__cantidad">
                      <CurrencyInput
                        aria-label="Cantidad"
                        currency={false}
                        showCents={false}
                        allowNegative={false}
                        value={item.cantidad}
                        onChange={(valor) => cambiarCantidad(index, valor)}
                        style={{ width: '100%', height: 32, padding: '4px 6px' }}
                      />
                    </div>
                    <span className="vpm-num presupuestos-item__monto">
                      {precioOriginal != null && (
                        <span className="presupuestos-item__anterior">
                          {formatCurrency(precioOriginal, showCents)}
                        </span>
                      )}
                      {formatCurrency(precio * item.cantidad, showCents)}
                    </span>
                    <Button
                      className="presupuestos-item__quitar"
                      variant="ghost"
                      size="sm"
                      style={{ padding: 4 }}
                      onClick={() => quitarProducto(index)}
                      title="Quitar producto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <Label htmlFor="pp-descuento">Descuento</Label>
            <Input
              id="pp-descuento"
              value={descuento}
              onChange={(e) => setDescuento(e.target.value)}
              placeholder="Monto o porcentaje (ej.: 1500 o 10%)"
              inputMode="decimal"
              style={{ marginTop: 6 }}
            />
            <p className="vpm-hint" style={{ marginTop: 4 }}>
              {descuento.trim()
                ? `Descuento aplicado: ${formatCurrency(descuentoMonto, showCents)}`
                : 'Escribí un número para descontar ese monto o agregá % para un porcentaje.'}
            </p>
          </div>

          <label
            htmlFor="pp-comparativa"
            style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}
          >
            <Checkbox
              id="pp-comparativa"
              checked={mostrarComparativa}
              onCheckedChange={(valor) => setMostrarComparativa(valor === true)}
              style={{ marginTop: 2 }}
            />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>Mostrar importes anteriores</span>
              <span className="vpm-hint" style={{ display: 'block', marginTop: 2 }}>
                Muestra tachados el subtotal y el total antes de los descuentos. Los descuentos por cantidad siempre se ven.
              </span>
            </span>
          </label>

          <div style={{ marginTop: 12 }}>
            <Label htmlFor="pp-obs">Observaciones</Label>
            <Textarea
              id="pp-obs"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej.: válido hasta el sábado..."
              rows={2}
              style={{ marginTop: 6, resize: 'vertical' }}
            />
          </div>
        </section>

        <section style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <PresupuestoNota
            ref={notaRef}
            vinotecaNombre={VINOTECA_DEFAULT}
            fechaEmision={editando?.fechaEmision ? new Date(editando.fechaEmision) : new Date()}
            items={itemsNota}
            observaciones={observaciones}
            descuentoMonto={descuentoMonto}
            total={total}
            totalOriginal={totalOriginal}
            mostrarComparativa={mostrarComparativa}
            showCents={showCents}
          />

          {linkGenerado && (
            <div className="vpm-card no-print" style={{ padding: 10, background: 'var(--vpm-field)' }}>
              <p className="vpm-hint" style={{ marginTop: 0, marginLeft: 2, marginBottom: 6 }}>Link público para compartir</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <Input readOnly value={linkGenerado} onFocus={(e) => e.target.select()} />
                <Button variant="outline" size="sm" onClick={() => copiarLink(linkGenerado)} title="Copiar link">
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.open(linkGenerado, '_blank', 'noopener,noreferrer')} title="Abrir link">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="presupuestos-acciones-wrap no-print">
        {acciones}
      </div>

      <section className="vpm-card no-print" style={{ padding: 14 }}>
        <h2 className="vpm-card-title" style={{ marginBottom: 8, fontSize: 15 }}>
          Presupuestos guardados
          {presupuestos.length > 0 && (
            <span className="vpm-hint" style={{ marginLeft: 8, fontWeight: 400 }}>
              {presupuestos.length} en total
            </span>
          )}
        </h2>
        {presupuestos.length === 0 ? (
          <p className="vpm-hint">Todavía no guardaste ningún presupuesto.</p>
        ) : (
          <>
            <ResponsiveTable
              headers={[
                { title: 'Fecha', width: '17%' },
                { title: 'Usuario', width: '18%' },
                { title: 'Productos', width: '12%' },
                { title: 'Total', width: '15%', align: 'right' },
                { title: 'Estado', width: '12%' },
                { title: 'Acciones', width: '26%' },
              ]}
              rows={presupuestosVisibles}
              renderDesktopRow={(presupuesto) => {
                const cantidad = presupuesto.items?.length || 0;
                return (
                  <tr key={presupuesto.id} className="border-b">
                    <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">
                      {formatearFecha(presupuesto.fecha_emision)}
                    </td>
                    <td className="p-2 text-xs font-medium">
                      {presupuesto.usuario_nombre || presupuesto.usuario_id || '—'}
                    </td>
                    <td className="p-2 text-xs whitespace-nowrap">
                      {cantidad} {cantidad === 1 ? 'producto' : 'productos'}
                    </td>
                    <td className="p-2 text-right vpm-num text-xs font-semibold whitespace-nowrap">
                      {formatCurrency(presupuesto.total, showCents)}
                    </td>
                    <td className="p-2">{estadoPresupuesto(presupuesto)}</td>
                    <td className="p-2">{accionesPresupuesto(presupuesto)}</td>
                  </tr>
                );
              }}
              renderMobileCard={(presupuesto) => {
                const cantidad = presupuesto.items?.length || 0;
                return (
                  <div key={presupuesto.id} className="p-3 border-b" style={{ background: 'var(--vpm-field)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatearFecha(presupuesto.fecha_emision)}
                      </span>
                      {estadoPresupuesto(presupuesto)}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-xs font-medium min-w-0 truncate">
                        {presupuesto.usuario_nombre || presupuesto.usuario_id || '—'}
                      </span>
                      <span className="vpm-num text-xs font-semibold text-right whitespace-nowrap">
                        {formatCurrency(presupuesto.total, showCents)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {cantidad} {cantidad === 1 ? 'producto' : 'productos'}
                    </div>
                    <div className="mt-2">{accionesPresupuesto(presupuesto)}</div>
                  </div>
                );
              }}
              useCard={false}
            />
            <Pagination
              currentPage={paginaActual}
              totalPages={totalPaginasPresupuestos}
              onPageChange={setPaginaPresupuestos}
              hasPrev={paginaActual > 1}
              hasNext={paginaActual < totalPaginasPresupuestos}
            />
          </>
        )}
      </section>

      <PresupuestoDetalle
        presupuesto={detalle}
        fechaTexto={detalle ? formatearFecha(detalle.fecha_emision) : ''}
        showCents={showCents}
        onClose={() => setDetalle(null)}
      />
    </div>
  );
};

export default Presupuestos;
