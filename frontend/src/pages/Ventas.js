import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, Calendar, CreditCard, User, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, ChevronDown, ChevronRight, List, Layers, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, formatNumber } from '@/lib/currency';
import { capitalizeWords } from '@/lib/utils';
import ResponsiveTable from '@/components/ResponsiveTable';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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

const Ventas = () => {
  const { getAuthHeader } = useAuth();
  const { showCents } = useConfig();
  const [searchParams] = useSearchParams();
const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVenta, setSelectedVenta] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  
  // Estados para filtros y ordenamiento
  const [filters, setFilters] = useState({
    dateType: 'all', // 'all', 'specific', 'range'
    specificDate: '',
    startDate: '',
    endDate: '',
    medioPago: 'all', // 'all', 'cuenta_corriente', 'efectivo', 'posnet', 'transferencia'
    usuario: 'all' // 'all' o ID de usuario específico
  });

  // Efecto para aplicar filtro automático desde URL params
  useEffect(() => {
    const autoFilter = searchParams.get('filter');
    if (autoFilter === 'today') {
      setFilters(prev => ({
        ...prev,
        dateType: 'specific',
        specificDate: format(new Date(), 'yyyy-MM-dd')
      }));
    }
  }, [searchParams]);
  
  const [sortConfig, setSortConfig] = useState({
    key: 'fecha',
    direction: 'desc' // 'asc' or 'desc'
  });

  const [viewMode, setViewMode] = useState('individual'); // 'individual' or 'grouped'
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // Estados de paginación
  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 50,
    totalItems: 0
  });

const fetchVentas = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/ventas`, {
        headers: getAuthHeader()
      });
      setVentas(response.data);
    } catch (error) {
      toast.error('Error al cargar ventas');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  const fetchUsuarios = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/usuarios`, {
        headers: getAuthHeader()
      });
      setUsuarios(response.data);
    } catch (error) {
      toast.error('Error al cargar usuarios');
    }
  }, [getAuthHeader]);

  useEffect(() => {
    fetchVentas();
    fetchUsuarios();
  }, [fetchVentas, fetchUsuarios]);

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
    let filtered = [...ventas];
    
    // Filtrar por fecha
    if (filters.dateType === 'specific' && filters.specificDate) {
      filtered = filtered.filter(venta => {
        const ventaDate = safeParseDate(venta.fecha);
        return format(ventaDate, 'yyyy-MM-dd') === filters.specificDate;
      });
    } else if (filters.dateType === 'range' && filters.startDate && filters.endDate) {
      const start = startOfDay(parseISO(filters.startDate));
      const end = endOfDay(parseISO(filters.endDate));
      filtered = filtered.filter(venta => {
        const ventaDate = safeParseDate(venta.fecha);
        return isWithinInterval(ventaDate, { start, end });
      });
    }
    
    // Filtrar por medio de pago
    if (filters.medioPago !== 'all') {
      filtered = filtered.filter(venta => {
        // Si tiene pagos múltiples, verificar si alguno coincide
        if (venta.pagos && venta.pagos.length > 0) {
          return venta.pagos.some(p => p.medio_pago === filters.medioPago);
        }
        // Si no, usar el medio_pago tradicional
        return venta.medio_pago === filters.medioPago;
      });
    }
    
    // Filtrar por usuario
    if (filters.usuario !== 'all') {
      filtered = filtered.filter(venta => venta.usuario_id === filters.usuario);
    }
    
    return filtered;
  }, [filters, safeParseDate, ventas]);

  // Aplicar ordenamiento
  const sortedVentas = useMemo(() => {
    const sorted = [...filteredVentas];
    
    sorted.sort((a, b) => {
      let aVal, bVal;
      
      if (sortConfig.key === 'fecha') {
        aVal = safeParseDate(a.fecha);
        bVal = safeParseDate(b.fecha);
      } else if (sortConfig.key === 'total') {
        aVal = a.total;
        bVal = b.total;
      } else {
        return 0;
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [filteredVentas, safeParseDate, sortConfig]);

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

  // Función para agrupar ventas por día
  const groupVentasByDay = useCallback((ventasList) => {
    const groups = {};
    
    ventasList.forEach(venta => {
      const date = safeParseDate(venta.fecha);
      const dateKey = format(date, 'yyyy-MM-dd');
      
      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: dateKey,
          dateLabel: getDateLabel(date),
          fullDate: date,
          ventas: [],
          total: 0,
          count: 0
        };
      }
      
      groups[dateKey].ventas.push(venta);
      groups[dateKey].total += venta.total;
      groups[dateKey].count += 1;
    });
    
    // Ordenar grupos por fecha descendente
    const sortedGroups = Object.values(groups).sort((a, b) => {
      return b.fullDate - a.fullDate;
    });
    
    // Ordenar ventas dentro de cada grupo por hora descendente
    sortedGroups.forEach(group => {
      group.ventas.sort((a, b) => {
        return safeParseDate(b.fecha) - safeParseDate(a.fecha);
      });
    });
    
    return sortedGroups;
  }, [getDateLabel, safeParseDate]);

  // Datos agrupados para vista agrupada
  const groupedVentas = useMemo(() => {
    return groupVentasByDay(sortedVentas);
  }, [groupVentasByDay, sortedVentas]);

  // Datos paginados según el modo de vista
  const paginatedData = useMemo(() => {
    const data = viewMode === 'individual' ? sortedVentas : groupedVentas;
    const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
    const endIndex = startIndex + pagination.itemsPerPage;
    
    return data.slice(startIndex, endIndex);
  }, [sortedVentas, groupedVentas, pagination, viewMode]);

  // Calcular total de páginas
  const totalPages = useMemo(() => {
    const totalItems = viewMode === 'individual' ? sortedVentas.length : groupedVentas.length;
    return Math.ceil(totalItems / pagination.itemsPerPage);
  }, [sortedVentas, groupedVentas, pagination.itemsPerPage, viewMode]);

  // Funciones para manejar paginación
  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setPagination(prev => ({ 
      ...prev, 
      itemsPerPage: newItemsPerPage,
      currentPage: 1 
    }));
  };

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, [filters]);

  // Componente de paginación
  const PaginationComponent = ({ currentPage, totalPages, onPageChange, itemsPerPage, onItemsPerPageChange, totalItems }) => {
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-3 p-2 bg-muted/50 rounded-md">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems}</span>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={(value) => onItemsPerPageChange(parseInt(value))}
          >
            <SelectTrigger className="w-14 h-6 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="h-6 w-6 p-0"
          >
            <ChevronLeft className="w-3 h-3" />
            <ChevronLeft className="w-3 h-3 -ml-2" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-6 w-6 p-0"
          >
            <ChevronLeft className="w-3 h-3" />
          </Button>
          
          <div className="flex items-center gap-0.5 text-xs">
            {getVisiblePages().map((page, index) => (
              page === '...' ? (
                <span key={`dots-${index}`} className="px-1 text-muted-foreground">
                  ...
                </span>
              ) : (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onPageChange(page)}
                  className="h-6 w-6 p-0 text-xs"
                >
                  {page}
                </Button>
              )
            ))}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="h-6 w-6 p-0"
          >
            <ChevronRight className="w-3 h-3" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="h-6 w-6 p-0"
          >
            <ChevronRight className="w-3 h-3" />
            <ChevronRight className="w-3 h-3 -ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  // Toggle expand/collapse de grupo
  const toggleGroup = (dateKey) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateKey)) {
        newSet.delete(dateKey);
      } else {
        newSet.add(dateKey);
      }
      return newSet;
    });
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

  // Configuración de headers con ordenamiento
  const headers = [
    { 
      title: (
        <button 
          onClick={() => handleSort('fecha')}
          className="flex items-center gap-2 hover:text-primary transition-colors"
        >
          Venta
          {getSortIcon('fecha')}
        </button>
      ), 
      width: 'col-span-2' 
    },
    { 
      title: (
        <button 
          onClick={() => handleSort('total')}
          className="flex items-center gap-2 hover:text-primary transition-colors"
        >
          Total
          {getSortIcon('total')}
        </button>
      ), 
      width: 'col-span-1' 
    },
    { title: 'Usuario', width: 'col-span-1' },
    { title: 'Medio Pago', width: 'col-span-1' },
    { title: 'Acciones', width: 'col-span-1' }
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
            {venta.cliente_nombre && (
              <div className="text-xs text-muted-foreground truncate max-w-[120px]">{venta.cliente_nombre}</div>
            )}
          </div>
        </div>
      </div>
      <div className="col-span-1 flex items-center justify-end">
        <div className="font-semibold text-primary text-xs">
          {formatCurrency(venta.total, showCents)}
        </div>
      </div>
      <div className="col-span-1 flex items-center text-xs text-muted-foreground truncate">
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
          <span className="text-xs capitalize">{venta.medio_pago.replace('_', ' ')}</span>
        )}
      </div>
      <div className="col-span-1 flex items-center justify-center">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            handleViewDetails(venta);
          }}
          data-testid={`view-details-${venta.id}`}
        >
          Ver
        </Button>
      </div>
    </div>
  );

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
              Total día
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
          <div className="col-span-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                toggleGroup(group.date);
              }}
            >
              {isExpanded ? 'Ocultar' : 'Ver'}
            </Button>
          </div>
        </div>
        
        {/* Ventas expandidas del grupo */}
        {isExpanded && (
          <div className="bg-muted/30 border-t">
            {group.ventas.map((venta, ventaIndex) => (
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
                <div className="col-span-1">
                  <div className="font-semibold text-primary">
                    {formatCurrency(venta.total, showCents)}
                  </div>
                </div>
                <div className="col-span-1 text-sm text-muted-foreground">
                  {venta.usuario_nombre || 'Usuario desconocido'}
                </div>
                <div className="col-span-1">
                  {venta.pagos && venta.pagos.length > 0 ? (
                    <div className="text-sm">
                      {venta.pagos.map((pago, idx) => (
                        <div key={idx} className="capitalize">
                          {pago.medio_pago?.replace('_', ' ')}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm capitalize">{venta.medio_pago.replace('_', ' ')}</span>
                  )}
                </div>
                <div className="col-span-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewDetails(venta);
                    }}
                  >
                    Ver
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

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
              <div className="flex bg-muted rounded-md p-0.5">
                <Button
                  variant={viewMode === 'individual' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('individual')}
                  className="h-6 text-xs px-2"
                  title="Vista Individual"
                >
                  <List className="w-3 h-3" />
                </Button>
                <Button
                  variant={viewMode === 'grouped' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grouped')}
                  className="h-6 text-xs px-2"
                  title="Vista Agrupada"
                >
                  <Layers className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-2 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select 
                value={filters.dateType} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, dateType: value }))}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
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
      <div className="grid grid-cols-3 gap-2">
        <Card className="py-2">
          <CardContent className="py-2">
            <div className="text-lg font-bold text-primary">
              {viewMode === 'individual' ? sortedVentas.length : groupedVentas.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {viewMode === 'individual' 
                ? `Ventas ${filters.dateType === 'all' ? 'totales' : 'filtradas'}`
                : `Días ${filters.dateType === 'all' ? 'totales' : 'filtrados'}`
              }
            </p>
          </CardContent>
        </Card>
        <Card className="py-2">
          <CardContent className="py-2">
            <div className="text-lg font-bold text-green-600">
              {formatCurrency(sortedVentas.reduce((sum, v) => sum + v.total, 0), showCents)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total {filters.dateType === 'all' ? 'general' : 'filtrado'}
            </p>
          </CardContent>
        </Card>
        <Card className="py-2">
          <CardContent className="py-2">
            <div className="text-lg font-bold text-blue-600">
              {viewMode === 'individual' 
                ? formatCurrency(sortedVentas.length > 0 ? sortedVentas.reduce((sum, v) => sum + v.total, 0) / sortedVentas.length : 0, showCents)
                : formatCurrency(groupedVentas.length > 0 ? groupedVentas.reduce((sum, g) => sum + g.total, 0) / groupedVentas.length : 0, showCents)
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {viewMode === 'individual' ? 'Promedio' : 'Promedio día'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla con virtual scrolling */}
{paginatedData.length > 0 ? (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {viewMode === 'individual' 
              ? (filters.dateType === 'all' 
                ? totalPages > 1 
                  ? `Ventas (página ${pagination.currentPage} de ${totalPages})`
                  : 'Mostrando todas las ventas'
                : filters.dateType === 'specific'
                  ? `Ventas del ${filters.specificDate ? format(parseISO(filters.specificDate), 'PPP', { locale: es }) : 'fecha seleccionada'}${totalPages > 1 ? ` (página ${pagination.currentPage} de ${totalPages})` : ''}`
                  : `Ventas desde ${filters.startDate ? format(parseISO(filters.startDate), 'PPP', { locale: es }) : 'fecha inicio'} hasta ${filters.endDate ? format(parseISO(filters.endDate), 'PPP', { locale: es }) : 'fecha fin'}${totalPages > 1 ? ` (página ${pagination.currentPage} de ${totalPages})` : ''}`)
              : `Ventas agrupadas por día (${groupedVentas.length} día${groupedVentas.length !== 1 ? 's' : ''})${totalPages > 1 ? ` - página ${pagination.currentPage} de ${totalPages}` : ''}`
            }
          </div>
          
          {/* Vista individual */}
          {viewMode === 'individual' && (
            <>
              {/* Versión desktop - Tabla virtualizada */}
              <div className="hidden lg:block">
                <VirtualTable
                  items={paginatedData}
                  itemHeight={44}
                  containerHeight={400}
                  renderItem={renderRow}
                  headers={headers}
                />
              </div>
              
              {/* Versión móvil - Cards */}
              <div className="lg:hidden space-y-2">
                {paginatedData.map((venta, index) => (
                  <div
                    key={venta.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors rounded-lg p-4 border"
                    onClick={() => handleViewDetails(venta)}
                    data-testid={`venta-card-${venta.id}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <ShoppingCart className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold">#{venta.id.slice(0, 8)}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(safeParseDate(venta.fecha), 'PPP HH:mm', { locale: es })}
                          </div>
                          {venta.cliente_nombre && (
                            <div className="text-xs text-muted-foreground">{venta.cliente_nombre}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-primary">
                          {formatCurrency(venta.total, showCents)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {venta.detalles.length} producto{venta.detalles.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-4 h-4" />
                        {venta.usuario_nombre || 'Usuario desconocido'}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CreditCard className="w-4 h-4" />
                        <span className="capitalize">{venta.medio_pago.replace('_', ' ')}</span>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(venta);
                        }}
                        data-testid={`view-details-mobile-${venta.id}`}
                      >
                        Ver Detalles
                      </Button>
                    </div>
                  </div>
                ))}
                
                {sortedVentas.length > 50 && (
                  <div className="text-center text-muted-foreground text-sm">
                    Mostrando las primeras 50 ventas de {sortedVentas.length} totales.
                    En desktop se muestran todas con virtual scrolling.
                  </div>
                )}
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
                    <div className="col-span-2">Fecha</div>
                    <div className="col-span-1">Total Día</div>
                    <div className="col-span-1">Cant.</div>
                    <div className="col-span-1">Promedio</div>
                    <div className="col-span-1">Acción</div>
                  </div>
                </div>
                
                {/* Grupos */}
                {paginatedData.map((group, index) => renderGroupRow(group, index))}
              </div>
              
              {/* Versión móvil - Cards agrupadas */}
              <div className="lg:hidden space-y-4">
                {paginatedData.map((group) => {
                  const isExpanded = expandedGroups.has(group.date);
                  
                  return (
                    <div key={group.date} className="border rounded-lg">
                      {/* Card del grupo */}
                      <div
                        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleGroup(group.date)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                              {isExpanded ? <ChevronDown className="w-5 h-5 text-primary" /> : <ChevronRight className="w-5 h-5 text-primary" />}
                            </div>
                            <div>
                              <div className="font-semibold text-lg">{group.dateLabel}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(group.fullDate, 'PPP', { locale: es })}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-primary">
                              {formatCurrency(group.total, showCents)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {group.count} venta{group.count !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Promedio: {formatCurrency(group.count > 0 ? group.total / group.count : 0, showCents)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGroup(group.date);
                            }}
                          >
                            {isExpanded ? 'Ocultar' : 'Ver'} Detalles
                          </Button>
                        </div>
                      </div>
                      
                      {/* Ventas expandidas */}
                      {isExpanded && (
                        <div className="border-t bg-muted/20">
                          {group.ventas.map((venta) => (
                            <div
                              key={venta.id}
                              className="p-4 border-b border-border/50 last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => handleViewDetails(venta)}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-primary/5 rounded flex items-center justify-center">
                                    <ShoppingCart className="w-3 h-3 text-primary" />
                                  </div>
                                  <span className="font-medium text-sm">#{venta.id.slice(0, 8)}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {format(safeParseDate(venta.fecha), 'HH:mm')}
                                  </span>
                                </div>
                                <span className="font-semibold text-primary">
                                  {formatCurrency(venta.total, showCents)}
                                </span>
                              </div>
                              
                              {venta.cliente_nombre && (
                                <div className="text-xs text-muted-foreground mb-1">
                                  Cliente: {venta.cliente_nombre}
                                </div>
                              )}
                              
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{venta.usuario_nombre || 'Usuario desconocido'}</span>
                                <span className="capitalize">{venta.medio_pago.replace('_', ' ')}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          
          {/* Componente de paginación */}
          <PaginationComponent
            currentPage={pagination.currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            itemsPerPage={pagination.itemsPerPage}
            onItemsPerPageChange={handleItemsPerPageChange}
            totalItems={viewMode === 'individual' ? sortedVentas.length : groupedVentas.length}
          />
        </div>
      ) : (
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
      )}

      {/* Diálogo de detalles */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader className="py-3 px-4 flex-shrink-0">
            <DialogTitle className="text-base">Detalle de Venta</DialogTitle>
          </DialogHeader>
          {selectedVenta && (
            <div className="flex flex-col flex-1 min-h-0 px-4 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 p-2 bg-muted rounded-md flex-shrink-0 text-xs">
                <div>
                  <p className="text-muted-foreground">Fecha</p>
                  <p className="font-medium text-xs">
                    {format(safeParseDate(selectedVenta.fecha), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Usuario</p>
                  <p className="font-medium text-xs">
                    {selectedVenta.usuario_nombre || 'Usuario desconocido'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Medio de Pago</p>
                  {selectedVenta.pagos && selectedVenta.pagos.length > 0 ? (
                    <div className="font-medium text-xs">
                      {selectedVenta.pagos.map((pago, idx) => (
                        <div key={idx} className="capitalize">
                          {pago.medio_pago?.replace('_', ' ')}: {formatCurrency(pago.monto, showCents)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="font-medium capitalize text-xs">
                      {selectedVenta.medio_pago?.replace('_', ' ') ?? '—'}
                    </p>
                  )}
                </div>
                {selectedVenta.cliente_nombre && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Cliente</p>
                    <p className="font-medium text-xs">{selectedVenta.cliente_nombre}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col flex-1 min-h-0">
                <h3 className="font-semibold text-sm py-1 flex-shrink-0">Productos</h3>
                <div className="flex-1 overflow-y-auto space-y-1 max-h-[40vh]">
                  {selectedVenta.detalles.map((detalle, index) => (
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

              <div className="flex justify-between items-center p-2 bg-primary/10 rounded-md flex-shrink-0">
                <span className="font-bold text-sm">Total</span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(selectedVenta.total, showCents)}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Ventas;
