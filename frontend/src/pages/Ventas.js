import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useConfig } from '@/context/ConfigContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, Calendar, CreditCard, User, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, ChevronDown, ChevronRight, List, Layers, ChevronLeft, ChevronsLeft, ChevronsRight, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, formatNumber } from '@/lib/currency';
import MobileCard from '@/components/MobileCard';
import { SkeletonTable } from '@/components/Skeleton';
import { API } from '@/lib/config';
import { apiGet } from '@/lib/api';
import { useDataRefresh } from '@/lib/dataEvents';
import { downloadVentaAsImage, downloadVentaAsPDF } from '@/lib/downloadUtils';
import DetalleVentaContent from '@/components/DetalleVentaCard';

// La vista agrupada muestra días, no ventas: conviene pedir pocos por página.
// Las ventas de un día se cargan solo cuando ese día se expande.
const LIMIT_POR_MODO = { individual: 100, grouped: 20 };
const GROUP_DETAIL_LIMIT = 50;
const getModeLimit = (modo) => LIMIT_POR_MODO[modo] ?? LIMIT_POR_MODO.individual;

const buildVentasParams = ({ page, limit, modo, filtros, fechaGrupo = null, sortConfig = null }) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    // Con fecha_grupo pedimos las ventas del día, no los grupos.
    agrupar_por_dia: fechaGrupo ? 'false' : (modo === 'grouped' ? 'true' : 'false')
  });
  if (sortConfig?.key) {
    params.append('sort_by', sortConfig.key);
    params.append('sort_dir', sortConfig.direction === 'asc' ? 'asc' : 'desc');
  }
  if (fechaGrupo) params.append('fecha_grupo', fechaGrupo);

  if (filtros.dateType === 'specific' && filtros.specificDate) {
    params.append('fecha_inicio', filtros.specificDate);
    params.append('fecha_fin', filtros.specificDate);
  } else if (filtros.dateType === 'range' && filtros.startDate && filtros.endDate) {
    params.append('fecha_inicio', filtros.startDate);
    params.append('fecha_fin', filtros.endDate);
  }
  if (filtros.medioPago !== 'all') params.append('metodo_pago', filtros.medioPago);
  if (filtros.usuario !== 'all') params.append('usuario_id', filtros.usuario);

  return params;
};

// Componente de virtual scrolling manual
const VirtualTable = ({ items, itemHeight, containerHeight, renderItem, headers }) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);
  
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );
  
  const visibleItems = items.slice(visibleStart, visibleEnd);
  
  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);
  
  const totalHeight = items.length * itemHeight;
  
  return (
    <div className="border rounded-md overflow-hidden">
      {/* Header fijo */}
      <div className="bg-muted sticky top-0 z-10">
        <div className="grid grid-cols-6 gap-2 p-2 text-xs font-semibold">
          {headers.map((header, index) => (
            <div key={index} className={`${header.width}`}>
              {header.title}
            </div>
          ))}
        </div>
      </div>
      
      {/* Contenedor virtualizado */}
      <div
        ref={containerRef}
        className="overflow-auto"
        style={{ height: containerHeight }}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleItems.map((item, index) => (
            <div
              key={visibleStart + index}
              style={{
                position: 'absolute',
                top: (visibleStart + index) * itemHeight,
                width: '100%',
                height: itemHeight
              }}
            >
              {renderItem(item, visibleStart + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Componente de paginación (fuera del componente para no remontarlo en cada render)
const PaginationComponent = ({ currentPage, totalPages, onPageChange, itemsPerPage, onItemsPerPageChange, totalItems, pageSizeOptions = [100, 250, 500] }) => {
  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    range.forEach((i) => {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    });

    return rangeWithDots;
  };

  return (
    <Card className="py-2">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-2 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground order-2 sm:order-1">
            <span>{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems}</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => onItemsPerPageChange(Number(value))}
            >
              <SelectTrigger className="w-16 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-center space-x-1 sm:space-x-2 order-1 sm:order-2">
            <Button variant="outline" size="icon" onClick={() => onPageChange(1)} disabled={currentPage === 1} className="h-8 w-8">
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center space-x-1">
              {getVisiblePages().map((page, index) => (
                page === '...' ? (
                  <span key={`dots-${index}`} className="px-1 text-muted-foreground">...</span>
                ) : (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => onPageChange(page)}
                    className="h-8 w-8"
                  >
                    {page}
                  </Button>
                )
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="h-8 w-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className="h-8 w-8">
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const Ventas = () => {
  const { showCents } = useConfig();
  const [searchParams] = useSearchParams();
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const detalleVentaRef = useRef(null);
  const contenidoVentaRef = useRef(null);
  const [usuarios, setUsuarios] = useState([]);
  const [updatingMedioPago, setUpdatingMedioPago] = useState([]);
  
  const [pagination, setPagination] = useState({
    page: 1,
    limit: getModeLimit('individual'),
    total: 0,
    pages: 0
  });
  
  const [stats, setStats] = useState({
    total_bruto: 0,
    total_neto: 0,
    cantidad: 0,
    promedio: 0,
    dias_unicos: 0
  });
  
  // Estados para filtros y ordenamiento
  const defaultFilters = {
    dateType: 'all', // 'all', 'specific', 'range'
    specificDate: '',
    startDate: '',
    endDate: '',
    medioPago: 'all', // 'all', 'cuenta_corriente', 'efectivo', 'posnet', 'transferencia'
    usuario: 'all' // 'all' o ID de usuario específico
  };

  const getInitialFilters = () => {
    const autoFilter = searchParams.get('filter');
    if (autoFilter === 'today') {
      return {
        ...defaultFilters,
        dateType: 'specific',
        specificDate: format(new Date(), 'yyyy-MM-dd')
      };
    }
    return defaultFilters;
  };

  const [filters, setFilters] = useState(getInitialFilters);

  // Efecto para aplicar filtro automático desde URL params (navegación sin remount)
  useEffect(() => {
    const autoFilter = searchParams.get('filter');
    if (autoFilter === 'today') {
      const specificDate = format(new Date(), 'yyyy-MM-dd');
      setFilters(prev => {
        if (prev.dateType === 'specific' && prev.specificDate === specificDate) return prev;
        return { ...prev, dateType: 'specific', specificDate };
      });
    }
  }, [searchParams]);

  const [viewMode, setViewMode] = useState('individual'); // 'individual' or 'grouped'
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  const [sortConfig, setSortConfig] = useState({
    key: 'fecha',
    direction: 'desc' // 'asc' or 'desc'
  });
  // Resetear página cuando cambian los filtros, el modo de vista o el orden
  useEffect(() => {
    const limite = getModeLimit(viewMode);
    setPagination(prev => ({ ...prev, page: 1, limit: limite }));
    setExpandedGroups(new Set());
    expandedGroupsRef.current = new Set();
    setGroupDetails({});
    groupDetailsRef.current = {};
    setLoadingPage(true);
    const timer = setTimeout(() => {
      fetchVentasRef.current?.(1, { ...filters, limit: limite });
    }, 50);
    
    return () => clearTimeout(timer);
  }, [filters, viewMode, sortConfig]);

  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const expandedGroupsRef = useRef(expandedGroups);
  expandedGroupsRef.current = expandedGroups;
  // Detalle ya pedido por día. Se conserva al colapsar para reabrir sin refetch.
  const [groupDetails, setGroupDetails] = useState({});
  const groupDetailsRef = useRef(groupDetails);
  groupDetailsRef.current = groupDetails;
  const limitRef = useRef(pagination.limit);
  limitRef.current = pagination.limit;
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const fetchVentasRef = useRef();
  const paginationRef = useRef(pagination.page);
  paginationRef.current = pagination.page;
  // Modo al que pertenecen los datos de `ventas`. Evita que el render del
  // toggle procese ventas individuales como grupos (y viceversa) mientras
  // llega la respuesta del modo nuevo.
  const datosModoRef = useRef(viewMode);

  const fetchVentas = useCallback(async (page = 1, currentFilters = null) => {
    const modo = viewModeRef.current;
    try {
      // Solo usar el loading de pantalla completa en la primera carga vacía
      if (page === 1 && ventas.length === 0) {
        setLoading(true);
      } else {
        setLoadingPage(true); // Usa el overlay suave para evitar desmontar el DOM
      }

      const filtros = currentFilters || filters;
      const currentLimit = filtros.limit || limitRef.current || getModeLimit(modo);
      const params = buildVentasParams({ page, limit: currentLimit, modo, filtros, sortConfig });

      const res = await apiGet(`${API}/ventas?${params}`);

      // Si el usuario cambió de vista mientras respondía, esta respuesta ya
      // no sirve: el efecto del toggle disparó el fetch del modo nuevo.
      if (viewModeRef.current !== modo) return;

      datosModoRef.current = modo;
      setVentas(res.data.ventas);
      setPagination(prev => ({
        ...prev,
        page: res.data.pagination.page,
        limit: currentLimit,
        total: res.data.pagination.total,
        pages: res.data.pagination.pages
      }));
      setStats(res.data.stats);
    } catch (error) {
      toast.error('Error al cargar ventas');
      console.error('Error fetching ventas:', error);
    } finally {
      setLoading(false);
      setLoadingPage(false);
    }
     // eslint-disable-next-line
  }, [filters, sortConfig]);

  fetchVentasRef.current = fetchVentas;

  // Una sola request por día, recién cuando el usuario lo expande. El detalle
  // queda en memoria: al cerrar y volver a abrir no se vuelve a pedir.
  const fetchGroupDetail = useCallback(async (dateKey, page = 1, append = false) => {
    if (viewModeRef.current !== 'grouped' || !dateKey) return;
    const filtrosUsados = filtersRef.current;
    const actual = groupDetailsRef.current[dateKey];
    if (!append && actual?.status === 'loaded' && actual.page >= 1) return;
    if (append && actual?.loadingMore) return;

    const actualizar = (parcial) => {
      setGroupDetails((prev) => {
        const base = prev[dateKey] || { ventas: [], page: 0, pages: 1, total: 0 };
        const next = { ...prev, [dateKey]: { ...base, ...parcial } };
        groupDetailsRef.current = next;
        return next;
      });
    };

    actualizar({ status: append ? 'loaded' : 'loading', loadingMore: append });

    try {
      const params = buildVentasParams({
        page,
        limit: GROUP_DETAIL_LIMIT,
        modo: 'grouped',
        filtros: filtrosUsados,
        fechaGrupo: dateKey
      });
      const res = await apiGet(`${API}/ventas?${params}`);

      // Si cambiaron los filtros o el modo mientras respondía, descartamos.
      if (viewModeRef.current !== 'grouped' || filtersRef.current !== filtrosUsados) return;
      const nuevasVentas = res.data.ventas || [];

      setGroupDetails((prev) => {
        const base = prev[dateKey] || { ventas: [], page: 0, pages: 1, total: 0 };
        const next = {
          ...prev,
          [dateKey]: {
            status: 'loaded',
            loadingMore: false,
            ventas: append ? [...(base.ventas || []), ...nuevasVentas] : nuevasVentas,
            page: res.data.pagination?.page ?? page,
            pages: res.data.pagination?.pages ?? 1,
            total: res.data.pagination?.total ?? nuevasVentas.length
          }
        };
        groupDetailsRef.current = next;
        return next;
      });
    } catch (error) {
      if (viewModeRef.current !== 'grouped' || filtersRef.current !== filtrosUsados) return;
      console.error('Error al cargar ventas del grupo:', error);
      toast.error('Error al cargar las ventas del día');
      actualizar({ status: 'error', loadingMore: false });
    }
  }, []);

  const fetchUsuarios = useCallback(async () => {
    try {
      const response = await apiGet(`${API}/usuarios`);
      setUsuarios(response.data);
    } catch (error) {
      toast.error('Error al cargar usuarios');
    }
  }, []);

  useEffect(() => {
    fetchUsuarios();
     // eslint-disable-next-line
  }, []);

  useDataRefresh(
    ['ventas'],
    () => {
      fetchVentasRef.current?.(paginationRef.current);
      if (viewModeRef.current !== 'grouped') return;
      // El bus avisó que cambiaron ventas: los detalles abiertos ya no sirven.
      setGroupDetails({});
      groupDetailsRef.current = {};
      Array.from(expandedGroupsRef.current || []).forEach((fecha) => {
        fetchGroupDetail(fecha, 1);
      });
    }
  );

  // Función segura para parsear fechas
  const safeParseDate = useCallback((dateString) => {
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? new Date() : date;
    } catch (error) {
      return new Date();
    }
  }, []);

// Aplicar filtros
  const filteredVentas = useMemo(() => {
    return ventas;
  }, [ventas]);

  // El orden ya viene del backend (antes de paginar): solo filtramos por modo.
  const sortedVentas = useMemo(() => {
    if (viewMode !== 'individual' || datosModoRef.current !== 'individual') return [];
    return filteredVentas;
  }, [filteredVentas, viewMode]);

  // Monto a mostrar/sumar: si hay filtro de medio activo, el backend manda
  // `monto_filtrado` (solo la porción cobrada con ese medio en ventas combinadas).
  const getMonto = useCallback((venta) => (
    venta.monto_filtrado !== undefined && venta.monto_filtrado !== null
      ? venta.monto_filtrado
      : venta.total
  ), []);

  // Función para obtener etiqueta de fecha inteligente
  const getDateLabel = useCallback((date) => {
    const parsedDate = safeParseDate(date);
    if (isToday(parsedDate)) {
      return 'Hoy';
    } else if (isYesterday(parsedDate)) {
      return 'Ayer';
    } else {
      return format(parsedDate, 'dd/MM/yyyy');
    }
  }, [safeParseDate]);

  // El backend ya agrupa y totaliza por día: acá solo preparamos la etiqueta.
  // Si por una respuesta en vuelo o un caché viejo llegan ventas individuales,
  // se agrupan acá como red de seguridad (nunca parseISO con undefined).
  const groupedVentas = useMemo(() => {
    if (viewMode !== 'grouped' || datosModoRef.current !== 'grouped') return [];

    let grupos = ventas;
    const sonGrupos = ventas.every((v) => v && v.date !== undefined);

    if (!sonGrupos) {
      const porDia = {};
      ventas.forEach((venta) => {
        if (!venta?.fecha) return;
        const fecha = safeParseDate(venta.fecha);
        const date = format(fecha, 'yyyy-MM-dd');
        if (!porDia[date]) {
          porDia[date] = { date, total: 0, ganancia_neta: 0, count: 0, ventas: [] };
        }
        porDia[date].total += getMonto(venta) || 0;
        porDia[date].ganancia_neta += venta.ganancia_neta || 0;
        porDia[date].count += 1;
        porDia[date].ventas.push(venta);
      });
      grupos = Object.values(porDia).sort((a, b) => b.date.localeCompare(a.date));
      grupos.forEach((grupo) => {
        grupo.ventas.sort((a, b) => safeParseDate(b.fecha) - safeParseDate(a.fecha));
      });
    }

    return grupos.map((grupo) => {
      // `grupo.date` es solo YYYY-MM-DD. `new Date('2026-11-27')` lo parsea
      // como UTC medianoche y en Argentina muestra el dia anterior.
      // parseISO lo interpreta en hora local, igual que el backend agrupa.
      const fullDate = /^\d{4}-\d{2}-\d{2}$/.test(grupo.date)
        ? parseISO(grupo.date)
        : safeParseDate(grupo.date);
      return {
        ...grupo,
        fullDate,
        dateLabel: getDateLabel(fullDate)
      };
    });
  }, [ventas, viewMode, getDateLabel, safeParseDate, getMonto]);

  // Datos a mostrar según modo de vista
  const displayData = useMemo(() => {
    return viewMode === 'individual' ? sortedVentas : groupedVentas;
  }, [sortedVentas, groupedVentas, viewMode]);

  // Calcular total de páginas del servidor
  const totalPages = pagination.pages;

  // Funciones para manejar paginación
  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchVentasRef.current?.(newPage, filters);
    window.scrollTo(0, 0);
  };

  const handleItemsPerPageChange = (newLimit) => {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
    fetchVentasRef.current?.(1, { ...filters, limit: newLimit });
  };

  // Toggle expand/collapse de grupo
  const toggleGroup = (dateKey) => {
    const seExpandira = !expandedGroupsRef.current.has(dateKey);
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateKey)) {
        newSet.delete(dateKey);
      } else {
        newSet.add(dateKey);
      }
      expandedGroupsRef.current = newSet;
      return newSet;
    });
    if (seExpandira && !groupDetailsRef.current[dateKey]) {
      fetchGroupDetail(dateKey, 1);
    }
  };

  const handleViewDetails = (venta) => {
    setSelectedVenta(venta);
    setDialogOpen(true);
  };

const clearFilters = () => {
    setFilters({
      dateType: 'all',
      specificDate: '',
      startDate: '',
      endDate: '',
      medioPago: 'all',
      usuario: 'all'
    });
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="w-4 h-4" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-4 h-4" />
      : <ArrowDown className="w-4 h-4" />;
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Todos los headers son botones de ordenamiento (asc -> desc -> asc).
  const headerBoton = (titulo, key) => (
    <button
      type="button"
      onClick={() => handleSort(key)}
      className="flex items-center gap-2 hover:text-primary transition-colors"
      aria-label={`Ordenar por ${titulo}`}
      title={`Ordenar por ${titulo}`}
    >
      {titulo}
      {getSortIcon(key)}
    </button>
  );

  const headers = [
    { title: headerBoton('Venta', 'fecha'), width: 'col-span-2' },
    { title: headerBoton('Total', 'total'), width: 'col-span-1' },
    { title: headerBoton('Ganancia', 'ganancia'), width: 'col-span-1' },
    { title: headerBoton('Usuario', 'usuario'), width: 'col-span-1' },
    { title: headerBoton('Medio Pago', 'medio_pago'), width: 'col-span-1' }
  ];

  // Renderizado de filas individuales
  const renderRow = (venta, index) => (
    <div
      className={`grid grid-cols-6 gap-2 px-2 py-1 cursor-pointer hover:bg-muted/50 transition-colors border-b text-sm items-center ${
        index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
      }`}
      onClick={() => handleViewDetails(venta)}
      data-testid={`venta-row-${venta.id}`}
    >
      <div className="col-span-2 flex items-center">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-primary/10 rounded flex items-center justify-center">
            <ShoppingCart className="w-3 h-3 text-primary" />
          </div>
          <div>
            <div className="font-medium text-xs">#{venta.id.slice(0, 8)}</div>
            <div className="text-xs text-muted-foreground">
              {format(safeParseDate(venta.fecha), 'dd/MM HH:mm')}
            </div>
          </div>
        </div>
      </div>
      <div className="col-span-1 flex items-center">
        <div className="font-semibold text-primary text-xs px-1">
          {formatCurrency(getMonto(venta), showCents)}
        </div>
      </div>
      <div className="col-span-1 flex items-center">
        <div className={`font-semibold text-xs px-1 ${(venta.ganancia_neta || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(venta.ganancia_neta || 0, showCents)}
        </div>
      </div>
      <div className="col-span-1 flex items-center text-xs text-muted-foreground truncate">
      <div className='px-2 text-xs'>{venta.usuario_nombre || 'Usuario desconocido'}</div>
      </div>
      <div className="col-span-1 flex items-center">
        {venta.pagos && venta.pagos.length > 0 ? (
          <div className="text-xs px-3">
            {venta.pagos.map((pago, idx) => (
              <div key={idx} className="capitalize">
                {pago.medio_pago?.replace('_', ' ')}
                {pago.medio_pago === 'cuenta_corriente' && venta.cliente_nombre && (
                  <div className="text-muted-foreground font-normal truncate max-w-[80px]">
                    {venta.cliente_nombre}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs">
            <span className="capitalize">{venta.medio_pago.replace('_', ' ')}</span>
            {venta.medio_pago === 'cuenta_corriente' && venta.cliente_nombre && (
              <div className="text-muted-foreground font-normal truncate max-w-[80px]">
                {venta.cliente_nombre}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Detalle de un día: se muestra recién después de expandir. Comparte estado
  // entre la fila desktop y la card mobile.
  const renderDetalleGrupo = (group, { movil = false } = {}) => {
    const detalle = groupDetails[group.date];

    if (!detalle || detalle.status === 'loading') {
      return (
        <div className="bg-muted/30 border-t p-3 text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Cargando ventas del día...
        </div>
      );
    }

    if (detalle.status === 'error') {
      return (
        <div className="bg-muted/30 border-t p-3 text-xs flex items-center justify-between gap-2">
          <span className="text-destructive">No se pudieron cargar las ventas del día.</span>
          <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => fetchGroupDetail(group.date, 1)}>
            Reintentar
          </Button>
        </div>
      );
    }

    const ventas = detalle.ventas || [];
    if (ventas.length === 0) {
      return (
        <div className="bg-muted/30 border-t p-3 text-xs text-muted-foreground">
          No hay ventas en este día.
        </div>
      );
    }

    return (
      <div className="bg-muted/30 border-t">
        {ventas.map((venta) => movil ? (
          <div
            key={venta.id}
            className="p-2 border-b border-border/50 last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => handleViewDetails(venta)}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <div className="w-5 h-5 bg-primary/5 rounded flex items-center justify-center">
                  <ShoppingCart className="w-2 h-2 text-primary" />
                </div>
                <span className="font-medium text-xs">#{venta.id.slice(0, 8)}</span>
                <span className="text-xs text-muted-foreground">
                  {format(safeParseDate(venta.fecha), 'HH:mm')}
                </span>
              </div>
              <div className="text-right">
                <span className="font-semibold text-primary text-xs">
                  {formatCurrency(getMonto(venta), showCents)}
                </span>
                <span className={`ml-2 text-xs ${(venta.ganancia_neta || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(venta.ganancia_neta || 0, showCents)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{venta.usuario_nombre || 'User'}</span>
              <span className="capitalize">{venta.medio_pago?.replace('_', ' ')}</span>
            </div>
          </div>
        ) : (
          <div
            key={venta.id}
            className="grid grid-cols-6 gap-2 p-2 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50"
            onClick={() => handleViewDetails(venta)}
            style={{ paddingLeft: '1.5rem' }}
          >
            <div className="col-span-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-primary/5 rounded flex items-center justify-center">
                  <ShoppingCart className="w-2 h-2 text-primary" />
                </div>
                <div>
                  <div className="font-medium text-xs">#{venta.id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(safeParseDate(venta.fecha), 'HH:mm')}
                  </div>
                  {venta.cliente_nombre && (
                    <div className="text-xs text-muted-foreground">{venta.cliente_nombre}</div>
                  )}
                </div>
              </div>
            </div>
            <div className="col-span-1 flex items-center">
              <div className="font-semibold text-primary text-xs">
                {formatCurrency(getMonto(venta), showCents)}
              </div>
            </div>
            <div className="col-span-1 flex items-center">
              <div className={`font-semibold text-xs ${(venta.ganancia_neta || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(venta.ganancia_neta || 0, showCents)}
              </div>
            </div>
            <div className="col-span-1 text-xs text-muted-foreground flex items-center">
              {venta.usuario_nombre || 'Usuario desconocido'}
            </div>
            <div className="col-span-1 flex items-center">
              {venta.pagos && venta.pagos.length > 0 ? (
                <div className="text-xs">
                  {venta.pagos.map((pago, idx) => (
                    <div key={idx} className="capitalize">
                      {pago.medio_pago?.replace('_', ' ')}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xs capitalize">{venta.medio_pago?.replace('_', ' ')}</span>
              )}
            </div>
          </div>
        ))}
        {detalle.page < detalle.pages && (
          <div className="p-2 flex justify-center border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={detalle.loadingMore}
              onClick={() => fetchGroupDetail(group.date, detalle.page + 1, true)}
            >
              {detalle.loadingMore ? (
                <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Cargando...</>
              ) : (
                `Cargar más (${Math.max(0, detalle.total - ventas.length)} restantes)`
              )}
            </Button>
          </div>
        )}
      </div>
    );
  };

  // Renderizado de grupos para vista agrupada
  const renderGroupRow = (group, index) => {
    const isExpanded = expandedGroups.has(group.date);
    
    return (
      <div key={group.date} className="border-b">
        {/* Fila del grupo */}
        <div
          className={`grid grid-cols-6 gap-2 px-2 py-1 cursor-pointer hover:bg-muted/50 transition-colors text-sm items-center ${
            index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
          }`}
          onClick={() => toggleGroup(group.date)}
        >
          <div className="col-span-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary/10 rounded flex items-center justify-center">
                {isExpanded ? <ChevronDown className="w-3 h-3 text-primary" /> : <ChevronRight className="w-3 h-3 text-primary" />}
              </div>
              <div>
                <div className="font-medium text-xs">{group.dateLabel}</div>
                <div className="text-xs text-muted-foreground">
                  {format(group.fullDate, 'dd/MM/yyyy')}
                </div>
              </div>
            </div>
          </div>
          <div className="col-span-1">
            <div className="font-semibold text-primary text-xs">
              {formatCurrency(group.total, showCents)}
            </div>
            <div className="text-xs text-muted-foreground">
              Bruto
            </div>
          </div>
          <div className="col-span-1">
            <div className={`font-semibold text-xs ${(group.ganancia_neta || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(group.ganancia_neta || 0, showCents)}
            </div>
            <div className="text-xs text-muted-foreground">
              Neto
            </div>
          </div>
          <div className="col-span-1">
            <div className="font-medium text-xs">
              {group.count}
            </div>
            <div className="text-xs text-muted-foreground">
              Venta{group.count !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="col-span-1">
            <div className="text-xs text-muted-foreground">
              {formatCurrency(group.count > 0 ? group.total / group.count : 0, showCents)}
            </div>
          </div>
        </div>
        
        {/* Ventas expandidas del grupo (se piden al abrir) */}
        {isExpanded && renderDetalleGrupo(group)}
      </div>
    );
  };

  if (loading) {
    return <SkeletonTable rows={8} columns={6} />;
  }

  const downloadAsImage = async () => {
    if (!contenidoVentaRef.current || !selectedVenta) return;
    setDownloading(true);
    const contentRef = contenidoVentaRef.current.getContentRef ? contenidoVentaRef.current.getContentRef() : contenidoVentaRef.current;
    await downloadVentaAsImage(contentRef, selectedVenta.id);
    setDownloading(false);
  };

  const downloadAsPDF = async () => {
    if (!contenidoVentaRef.current || !selectedVenta) return;
    setDownloading(true);
    const contentRef = contenidoVentaRef.current.getContentRef ? contenidoVentaRef.current.getContentRef() : contenidoVentaRef.current;
    await downloadVentaAsPDF(contentRef, selectedVenta.id);
    setDownloading(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ventas</h1>
        <p className="text-sm text-muted-foreground">Historial de ventas realizadas</p>
      </div>

      {/* Filtros y Vista */}
      <Card className="py-3">
        <CardHeader className="py-2 pb-2">
          <div className="flex items-center justify-between py-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtros
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Vista:</span>
              <div className="flex bg-muted rounded-md p-0.5" role="group" aria-label="Modo de vista de ventas">
                <Button
                  type="button"
                  variant={viewMode === 'individual' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('individual')}
                  className="h-7 text-xs px-2 gap-1"
                  aria-pressed={viewMode === 'individual'}
                  title="Ver cada venta por separado"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Individual</span>
                </Button>
                <Button
                  type="button"
                  variant={viewMode === 'grouped' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grouped')}
                  className="h-7 text-xs px-2 gap-1"
                  aria-pressed={viewMode === 'grouped'}
                  title="Agrupar ventas por día"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Agrupada</span>
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-2 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Período</Label>
              <Select 
                value={filters.dateType} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, dateType: value }))}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="specific">Fecha específica</SelectItem>
                  <SelectItem value="range">Rango</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs">Medio</Label>
              <Select 
                value={filters.medioPago} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, medioPago: value }))}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="cuenta_corriente">Cta. Cte.</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="posnet">PosNet</SelectItem>
                  <SelectItem value="transferencia">Transf.</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs">Usuario</Label>
              <Select 
                value={filters.usuario} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, usuario: value }))}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {usuarios.map(usuario => (
                    <SelectItem key={usuario.id} value={usuario.id.toString()}>
                      {usuario.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {filters.dateType === 'specific' && (
              <div className="space-y-1">
                <Label className="text-xs">Fecha</Label>
                <Input
                  type="date"
                  value={filters.specificDate}
                  className="h-7 text-xs"
                  onChange={(e) => setFilters(prev => ({ ...prev, specificDate: e.target.value }))}
                />
              </div>
            )}
            
            {filters.dateType === 'range' && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Desde</Label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    className="h-7 text-xs"
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hasta</Label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    className="h-7 text-xs"
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>
          
          {(filters.dateType !== 'all' || (filters.dateType === 'specific' && filters.specificDate) || 
            (filters.dateType === 'range' && (filters.startDate || filters.endDate)) ||
            filters.medioPago !== 'all' || filters.usuario !== 'all') && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={clearFilters}
              className="h-6 text-xs"
            >
              <X className="w-3 h-3 mr-1" />
              Limpiar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Card className="py-2">
          <CardContent className="py-2">
            <p className="text-xs text-muted-foreground">
              {viewMode === 'individual' 
                ? `Ventas ${filters.dateType === 'all' ? 'totales' : 'filtradas'}`
                : `Días ${filters.dateType === 'all' ? 'totales' : 'filtrados'}`
              }
            </p>
            <div className="text-lg font-bold text-primary">
              {stats.cantidad}
            </div>
            {viewMode === 'grouped' && stats.cantidad_ventas !== undefined && (
              <p className="text-xs text-muted-foreground">
                ({stats.cantidad_ventas} ventas)
              </p>
            )}
            {viewMode === 'individual' && stats.dias_unicos !== undefined && (
              <p className="text-xs text-muted-foreground">
                ({stats.dias_unicos} días)
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="py-2">
          <CardContent className="py-2">
            <p className="text-xs text-muted-foreground">
              Total {filters.dateType === 'all' ? 'general' : 'filtrado'}
            </p>
            <div className="text-lg font-bold text-green-600">
              {formatCurrency(stats.total_bruto, showCents)}
            </div>
            <div className="text-xs text-green-600/80">
              Neto: {formatCurrency(stats.total_neto, showCents)}
            </div>
          </CardContent>
        </Card>
        <Card className="py-2">
          <CardContent className="py-2">
            <p className="text-xs text-muted-foreground">
              {viewMode === 'individual' ? 'Promedio venta' : 'Promedio día'}
            </p>
            <div className="text-lg font-bold text-blue-600">
              {formatCurrency(stats.promedio, showCents)}
            </div>
            {stats.promedio_neto !== undefined && (
              <div className="text-xs text-blue-600/80">
                Neto: {formatCurrency(stats.promedio_neto, showCents)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabla con virtual scrolling */}
      {!loadingPage && displayData.length > 0 ? (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {viewMode === 'individual' 
              ? (filters.dateType === 'all' 
                ? totalPages > 1 
                  ? `Ventas (página ${pagination.page} de ${totalPages})`
                  : 'Mostrando todas las ventas'
                : filters.dateType === 'specific'
                  ? `Ventas del ${filters.specificDate ? format(parseISO(filters.specificDate), 'PPP', { locale: es }) : 'fecha seleccionada'}${totalPages > 1 ? ` (página ${pagination.page} de ${totalPages})` : ''}`
                  : `Ventas desde ${filters.startDate ? format(parseISO(filters.startDate), 'PPP', { locale: es }) : 'fecha inicio'} hasta ${filters.endDate ? format(parseISO(filters.endDate), 'PPP', { locale: es }) : 'fecha fin'}${totalPages > 1 ? ` (página ${pagination.page} de ${totalPages})` : ''}`)
              : `Ventas agrupadas por día (${displayData.length} día${displayData.length !== 1 ? 's' : ''})${totalPages > 1 ? ` - página ${pagination.page} de ${totalPages}` : ''}`
            }
          </div>
          
          {/* Vista individual */}
          {viewMode === 'individual' && (
            <>
              {/* Versión desktop - Tabla virtualizada */}
              <div className="hidden lg:block">
                <VirtualTable
                  items={displayData}
                  itemHeight={44}
                  containerHeight={400}
                  renderItem={renderRow}
                  headers={headers}
                />
              </div>
              
              {/* Versión móvil - Cards */}
              <div className="lg:hidden space-y-2">
                {displayData.slice(0, pagination.limit).map((venta, index) => (
                  <MobileCard
                    key={venta.id}
                    onClick={() => handleViewDetails(venta)}
                    data-testid={`venta-card-${venta.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                          <ShoppingCart className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold text-xs">#{venta.id.slice(0, 8)}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(safeParseDate(venta.fecha), 'PPP HH:mm', { locale: es })}
                          </div>
                          {venta.cliente_nombre && (
                            <div className="text-xs text-muted-foreground truncate max-w-[120px]">{venta.cliente_nombre}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold text-primary">
                          {formatCurrency(getMonto(venta), showCents)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {venta.detalles.length} prod{venta.detalles.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span className="truncate max-w-[80px]">{venta.usuario_nombre || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        <span className="capitalize text-xs">{venta.medio_pago.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </MobileCard>
                ))}
                
              </div>
            </>
          )}
          
          {/* Vista agrupada */}
          {viewMode === 'grouped' && (
            <>
              {/* Versión desktop - Grupos con expansión */}
              <div className="hidden lg:block border rounded-md">
                {/* Header fijo para vista agrupada */}
                <div className="bg-muted sticky top-0 z-10">
                  <div className="grid grid-cols-6 gap-2 p-2 text-xs font-semibold">
                    <div className="col-span-2">{headerBoton('Fecha', 'fecha')}</div>
                    <div className="col-span-1">{headerBoton('Total Bruto', 'total')}</div>
                    <div className="col-span-1">{headerBoton('Ganancia', 'ganancia')}</div>
                    <div className="col-span-1">{headerBoton('Cant.', 'count')}</div>
                    <div className="col-span-1">{headerBoton('Promedio', 'promedio')}</div>
                  </div>
                </div>
                
                {/* Grupos */}
                {displayData.map((group, index) => renderGroupRow(group, index))}
              </div>
              
              {/* Versión móvil - Cards agrupadas */}
              <div className="lg:hidden space-y-2">
                {displayData.map((group) => {
                  const isExpanded = expandedGroups.has(group.date);
                  
                  return (
                    <div key={group.date} className="border rounded-lg">
                      {/* Card del grupo */}
                      <div
                        className="p-2 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleGroup(group.date)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-primary" />}
                            </div>
                            <div>
                              <div className="font-semibold text-sm">{group.dateLabel}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(group.fullDate, 'dd/MM/yyyy')}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-base font-bold text-primary">
                              {formatCurrency(group.total, showCents)}
                            </div>
                            <div className="text-xs text-green-600">
                              Neto: {formatCurrency(group.ganancia_neta || 0, showCents)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {group.count} venta{group.count !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-xs">
                          <span className="text-muted-foreground">
                            Prom: {formatCurrency(group.count > 0 ? group.total / group.count : 0, showCents)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Ventas expandidas (se piden al abrir) */}
                      {isExpanded && renderDetalleGrupo(group, { movil: true })}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          
          {/* Componente de paginación */}
          <PaginationComponent
            currentPage={pagination.page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            itemsPerPage={pagination.limit}
            onItemsPerPageChange={handleItemsPerPageChange}
            totalItems={pagination.total}
            pageSizeOptions={viewMode === 'grouped' ? [10, 20, 50] : [100, 250, 500]}
          />
        </div>
      ) : !loadingPage && ventas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {viewMode === 'individual'
                ? (filters.dateType === 'all' 
                  ? 'No hay ventas aún.'
                  : 'No hay ventas que coincidan con los filtros aplicados.')
                : (filters.dateType === 'all' 
                  ? 'No hay días con ventas.'
                  : 'No hay días con ventas que coincidan con los filtros aplicados.')
              }
            </p>
          </CardContent>
        </Card>
      ) : loadingPage ? (
        <SkeletonTable rows={5} columns={6} />
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base">Detalle de Venta</DialogTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadAsImage}
                  disabled={downloading}
                  className="text-xs h-8"
                >
                  {downloading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}
                  Imagen
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadAsPDF}
                  disabled={downloading}
                  className="text-xs h-8"
                >
                  {downloading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}
                  PDF
                </Button>
              </div>
            </div>
          </DialogHeader>
          {selectedVenta && (
            <DetalleVentaContent
              ref={contenidoVentaRef}
              venta={selectedVenta}
              showCents={showCents}
              showClientInfo={true}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Ventas;
