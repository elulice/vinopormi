import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, Calendar, CreditCard, User, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, ChevronDown, ChevronRight, List, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, formatNumber } from '@/lib/currency';
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
    <div className="border rounded-lg">
      {/* Header fijo */}
      <div className="bg-muted sticky top-0 z-10">
        <div className="grid grid-cols-6 gap-4 p-4 text-sm font-semibold">
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
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVenta, setSelectedVenta] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Estados para filtros y ordenamiento
  const [filters, setFilters] = useState({
    dateType: 'all', // 'all', 'specific', 'range'
    specificDate: '',
    startDate: '',
    endDate: ''
  });
  
  const [sortConfig, setSortConfig] = useState({
    key: 'fecha',
    direction: 'desc' // 'asc' or 'desc'
  });

  const [viewMode, setViewMode] = useState('individual'); // 'individual' or 'grouped'
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  useEffect(() => {
    fetchVentas();
  }, []);

  const fetchVentas = async () => {
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
  };

  // Función segura para parsear fechas
  const safeParseDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? new Date() : date;
    } catch (error) {
      return new Date();
    }
  };

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
    
    return filtered;
  }, [ventas, filters]);

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
  }, [filteredVentas, sortConfig]);

  // Función para obtener etiqueta de fecha inteligente
  const getDateLabel = (date) => {
    const parsedDate = safeParseDate(date);
    if (isToday(parsedDate)) {
      return 'Hoy';
    } else if (isYesterday(parsedDate)) {
      return 'Ayer';
    } else {
      return format(parsedDate, 'dd/MM/yyyy');
    }
  };

  // Función para agrupar ventas por día
  const groupVentasByDay = (ventasList) => {
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
  };

  // Datos agrupados para vista agrupada
  const groupedVentas = useMemo(() => {
    return groupVentasByDay(sortedVentas);
  }, [sortedVentas]);

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
      endDate: ''
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
      className={`grid grid-cols-6 gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b ${
        index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
      }`}
      onClick={() => handleViewDetails(venta)}
      data-testid={`venta-row-${venta.id}`}
    >
      <div className="col-span-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <ShoppingCart className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="font-medium">#{venta.id.slice(0, 8)}</div>
            <div className="text-xs text-muted-foreground">
              {format(safeParseDate(venta.fecha), 'PPP HH:mm', { locale: es })}
            </div>
            {venta.cliente_nombre && (
              <div className="text-xs text-muted-foreground">{venta.cliente_nombre}</div>
            )}
          </div>
        </div>
      </div>
      <div className="col-span-1">
        <div className="font-semibold text-primary">
          {formatCurrency(venta.total)}
        </div>
      </div>
      <div className="col-span-1 text-sm text-muted-foreground">
        {venta.usuario_nombre || 'Usuario desconocido'}
      </div>
      <div className="col-span-1">
        <span className="text-sm capitalize">{venta.medio_pago.replace('_', ' ')}</span>
      </div>
      <div className="col-span-1">
        <Button
          variant="outline"
          size="sm"
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
          className={`grid grid-cols-6 gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
            index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
          }`}
          onClick={() => toggleGroup(group.date)}
        >
          <div className="col-span-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                {isExpanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-primary" />}
              </div>
              <div>
                <div className="font-medium text-lg">{group.dateLabel}</div>
                <div className="text-xs text-muted-foreground">
                  {format(group.fullDate, 'PPP', { locale: es })}
                </div>
              </div>
            </div>
          </div>
          <div className="col-span-1">
            <div className="font-semibold text-primary text-lg">
              {formatCurrency(group.total)}
            </div>
            <div className="text-xs text-muted-foreground">
              Total del día
            </div>
          </div>
          <div className="col-span-1">
            <div className="font-medium text-lg">
              {group.count}
            </div>
            <div className="text-xs text-muted-foreground">
              Venta{group.count !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="col-span-1">
            <div className="text-sm text-muted-foreground">
              Promedio: {formatCurrency(group.count > 0 ? group.total / group.count : 0)}
            </div>
          </div>
          <div className="col-span-1">
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
        
        {/* Ventas expandidas del grupo */}
        {isExpanded && (
          <div className="bg-muted/30 border-t">
            {group.ventas.map((venta, ventaIndex) => (
              <div
                key={venta.id}
                className="grid grid-cols-6 gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50"
                onClick={() => handleViewDetails(venta)}
                style={{ paddingLeft: '2rem' }}
              >
                <div className="col-span-2">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-primary/5 rounded flex items-center justify-center">
                      <ShoppingCart className="w-3 h-3 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">#{venta.id.slice(0, 8)}</div>
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
                    {formatCurrency(venta.total)}
                  </div>
                </div>
                <div className="col-span-1 text-sm text-muted-foreground">
                  {venta.usuario_nombre || 'Usuario desconocido'}
                </div>
                <div className="col-span-1">
                  <span className="text-sm capitalize">{venta.medio_pago.replace('_', ' ')}</span>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Ventas</h1>
        <p className="text-muted-foreground">Historial de ventas realizadas</p>
      </div>

      {/* Filtros y Vista */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Vista:</span>
              <div className="flex bg-muted rounded-lg p-1">
                <Button
                  variant={viewMode === 'individual' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('individual')}
                  className="flex items-center gap-2"
                >
                  <List className="w-4 h-4" />
                  Individual
                </Button>
                <Button
                  variant={viewMode === 'grouped' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grouped')}
                  className="flex items-center gap-2"
                >
                  <Layers className="w-4 h-4" />
                  Agrupada
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Tipo de filtro</Label>
              <Select 
                value={filters.dateType} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, dateType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las ventas</SelectItem>
                  <SelectItem value="specific">Fecha específica</SelectItem>
                  <SelectItem value="range">Rango de fechas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {filters.dateType === 'specific' && (
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={filters.specificDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, specificDate: e.target.value }))}
                />
              </div>
            )}
            
            {filters.dateType === 'range' && (
              <>
                <div className="space-y-2">
                  <Label>Desde</Label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hasta</Label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>
          
          {(filters.dateType !== 'all' || (filters.dateType === 'specific' && filters.specificDate) || 
            (filters.dateType === 'range' && (filters.startDate || filters.endDate))) && (
            <Button 
              variant="outline" 
              onClick={clearFilters}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Limpiar filtros
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">
              {viewMode === 'individual' ? sortedVentas.length : groupedVentas.length}
            </div>
            <p className="text-sm text-muted-foreground">
              {viewMode === 'individual' 
                ? `Ventas ${filters.dateType === 'all' ? 'totales' : 'filtradas'}`
                : `Días ${filters.dateType === 'all' ? 'totales' : 'filtrados'}`
              }
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(sortedVentas.reduce((sum, v) => sum + v.total, 0))}
            </div>
            <p className="text-sm text-muted-foreground">
              Total {filters.dateType === 'all' ? 'general' : 'filtrado'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {viewMode === 'individual' 
                ? formatCurrency(sortedVentas.length > 0 ? sortedVentas.reduce((sum, v) => sum + v.total, 0) / sortedVentas.length : 0)
                : formatCurrency(groupedVentas.length > 0 ? groupedVentas.reduce((sum, g) => sum + g.total, 0) / groupedVentas.length : 0)
              }
            </div>
            <p className="text-sm text-muted-foreground">
              {viewMode === 'individual' ? 'Promedio por venta' : 'Promedio por día'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla con virtual scrolling */}
{(viewMode === 'individual' ? sortedVentas : groupedVentas).length > 0 ? (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {viewMode === 'individual' 
              ? (filters.dateType === 'all' 
                ? 'Mostrando todas las ventas'
                : filters.dateType === 'specific'
                  ? `Ventas del ${filters.specificDate ? format(parseISO(filters.specificDate), 'PPP', { locale: es }) : 'fecha seleccionada'}`
                  : `Ventas desde ${filters.startDate ? format(parseISO(filters.startDate), 'PPP', { locale: es }) : 'fecha inicio'} hasta ${filters.endDate ? format(parseISO(filters.endDate), 'PPP', { locale: es }) : 'fecha fin'}`)
              : `Ventas agrupadas por día (${groupedVentas.length} día${groupedVentas.length !== 1 ? 's' : ''})`
            }
          </div>
          
          {/* Vista individual */}
          {viewMode === 'individual' && (
            <>
              {/* Versión desktop - Tabla virtualizada */}
              <div className="hidden lg:block">
                <VirtualTable
                  items={sortedVentas}
                  itemHeight={100}
                  containerHeight={600}
                  renderItem={renderRow}
                  headers={headers}
                />
              </div>
              
              {/* Versión móvil - Cards */}
              <div className="lg:hidden space-y-4">
                {sortedVentas.slice(0, 50).map((venta, index) => (
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
                          {formatCurrency(venta.total)}
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
              <div className="hidden lg:block border rounded-lg">
                {/* Header fijo para vista agrupada */}
                <div className="bg-muted sticky top-0 z-10">
                  <div className="grid grid-cols-6 gap-4 p-4 text-sm font-semibold">
                    <div className="col-span-2">Fecha</div>
                    <div className="col-span-1">Total del Día</div>
                    <div className="col-span-1">Cantidad</div>
                    <div className="col-span-1">Promedio</div>
                    <div className="col-span-1">Acciones</div>
                  </div>
                </div>
                
                {/* Grupos */}
                {groupedVentas.map((group, index) => renderGroupRow(group, index))}
              </div>
              
              {/* Versión móvil - Cards agrupadas */}
              <div className="lg:hidden space-y-4">
                {groupedVentas.map((group) => {
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
                              {formatCurrency(group.total)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {group.count} venta{group.count !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Promedio: {formatCurrency(group.count > 0 ? group.total / group.count : 0)}
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
                                  {formatCurrency(venta.total)}
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
            {/* Diálogo de detalles */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Detalle de Venta</DialogTitle>
            <DialogDescription>
              Información completa de la venta seleccionada
            </DialogDescription>
          </DialogHeader>
          {selectedVenta && (
            <div className="flex flex-col flex-1 min-h-0 space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg flex-shrink-0">
                <div>
                  <p className="text-sm text-muted-foreground">Fecha y Hora</p>
                  <p className="font-medium">
                    {format(safeParseDate(selectedVenta.fecha), 'PPP HH:mm:ss', { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Usuario</p>
                  <p className="font-medium">
                    {selectedVenta.usuario_nombre || 'Usuario desconocido'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Medio de Pago</p>
                  <p className="font-medium capitalize">
                    {selectedVenta.medio_pago?.replace('_', ' ') ?? '—'}
                  </p>
                </div>
                {selectedVenta.cliente_nombre && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Cliente</p>
                    <p className="font-medium">{selectedVenta.cliente_nombre}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col flex-1 min-h-0">
                <h3 className="font-semibold mb-3 flex-shrink-0">Productos</h3>
                <div className="flex-1 overflow-y-auto space-y-2 max-h-[50vh]">
                  {selectedVenta.detalles.map((detalle, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-muted rounded-md"
                    >
                      <div>
                        <p className="font-medium">{detalle.producto_nombre}</p>
                        <p className="text-sm text-muted-foreground">
                          {detalle.cantidad} x {formatCurrency(detalle.precio_unitario)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {formatCurrency(detalle.subtotal)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg flex-shrink-0">
                <span className="text-xl font-bold">Total</span>
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(selectedVenta.total)}
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