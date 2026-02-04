import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ShoppingCart, Calendar, CreditCard, User, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
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
  const [ventasData, setVentasData] = useState({ grouped: false, data: [] });
  const [loading, setLoading] = useState(true);
  const [selectedVenta, setSelectedVenta] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isGroupedView, setIsGroupedView] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  
  // Estados para filtros y ordenamiento
  const [filters, setFilters] = useState({
    dateType: 'all', // 'all', 'specific', 'range'
    specificDate: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchVentas();
  }, [isGroupedView]);

  const fetchVentas = async () => {
    try {
      const response = await axios.get(`${API}/ventas`, {
        headers: getAuthHeader(),
        params: { grouped: isGroupedView }
      });
      setVentasData(response.data);
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

  // Aplicar filtros (solo para vista individual)
  const filteredData = useMemo(() => {
    if (isGroupedView) {
      // Para vista agrupada, aplicar filtros a los grupos
      let filtered = [...ventasData.data];
      
      if (filters.dateType === 'specific' && filters.specificDate) {
        filtered = filtered.filter(grupo => 
          grupo.fecha_iso === filters.specificDate
        );
      } else if (filters.dateType === 'range' && filters.startDate && filters.endDate) {
        filtered = filtered.filter(grupo => {
          return grupo.fecha_iso >= filters.startDate && grupo.fecha_iso <= filters.endDate;
        });
      }
      
      return filtered;
    } else {
      // Para vista individual, aplicar filtros a las ventas
      let filtered = [...ventasData.data];
      
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
    }
  }, [ventasData, filters, isGroupedView]);

  // Toggle para expandir/contraer grupos
  const toggleGroupExpansion = (fecha) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fecha)) {
        newSet.delete(fecha);
      } else {
        newSet.add(fecha);
      }
      return newSet;
    });
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
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

  const toggleView = () => {
    setIsGroupedView(!isGroupedView);
    setExpandedGroups(new Set()); // Resetear grupos expandidos al cambiar vista
  };

  // Renderizado de grupo expandible
  const renderGroupHeader = (grupo) => {
    const isExpanded = expandedGroups.has(grupo.fecha);
    
    return (
      <div 
        className="grid grid-cols-6 gap-4 p-4 bg-muted/50 cursor-pointer hover:bg-muted transition-colors border-b font-semibold"
        onClick={() => toggleGroupExpansion(grupo.fecha)}
      >
        <div className="col-span-2 flex items-center gap-2">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="font-medium">{grupo.fecha}</div>
                <div className="text-xs text-muted-foreground">
                  {grupo.cantidad_ventas} venta{grupo.cantidad_ventas !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-span-1 flex items-center">
          <div className="font-semibold text-primary">
            {formatCurrency(grupo.total_ventas)}
          </div>
        </div>
        <div className="col-span-1 flex items-center text-sm text-muted-foreground">
          -
        </div>
        <div className="col-span-1 flex items-center">
          <span className="text-sm capitalize">-</span>
        </div>
        <div className="col-span-1 flex items-center">
          <span className="text-sm text-muted-foreground">
            {grupo.cantidad_ventas} venta{grupo.cantidad_ventas !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    );
  };

  // Renderizado de ventas individuales (dentro de grupo)
  const renderVentaInGroup = (venta, index) => (
    <div
      key={venta.id}
      className={`grid grid-cols-6 gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b ml-8 ${
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
              {format(safeParseDate(venta.fecha), 'HH:mm:ss', { locale: es })}
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

  // Headers para tabla individual
  const individualHeaders = [
    { title: 'Venta', width: 'col-span-2' },
    { title: 'Total', width: 'col-span-1' },
    { title: 'Usuario', width: 'col-span-1' },
    { title: 'Medio Pago', width: 'col-span-1' },
    { title: 'Acciones', width: 'col-span-1' }
  ];

  // Headers para tabla agrupada
  const groupedHeaders = [
    { title: 'Fecha', width: 'col-span-2' },
    { title: 'Total del Día', width: 'col-span-1' },
    { title: 'Usuario', width: 'col-span-1' },
    { title: 'Medio Pago', width: 'col-span-1' },
    { title: 'Ventas', width: 'col-span-1' }
  ];

  // Renderizado de filas para vista individual
  const renderIndividualRow = (venta, index) => (
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

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  // Calcular estadísticas para mostrar
  const stats = useMemo(() => {
    if (isGroupedView) {
      return {
        totalItems: filteredData.length,
        totalAmount: filteredData.reduce((sum, grupo) => sum + grupo.total_ventas, 0),
        averageAmount: filteredData.length > 0 
          ? filteredData.reduce((sum, grupo) => sum + grupo.total_ventas, 0) / filteredData.length 
          : 0
      };
    } else {
      return {
        totalItems: filteredData.length,
        totalAmount: filteredData.reduce((sum, venta) => sum + venta.total, 0),
        averageAmount: filteredData.length > 0 
          ? filteredData.reduce((sum, venta) => sum + venta.total, 0) / filteredData.length 
          : 0
      };
    }
  }, [filteredData, isGroupedView]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Ventas</h1>
          <p className="text-muted-foreground">Historial de ventas realizadas</p>
        </div>
        <div className="flex items-center space-x-2">
          <Label htmlFor="view-toggle">Vista individual</Label>
          <Switch
            id="view-toggle"
            checked={isGroupedView}
            onCheckedChange={toggleView}
          />
          <Label htmlFor="view-toggle">Agrupar por día</Label>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
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
              {stats.totalItems}
            </div>
            <p className="text-sm text-muted-foreground">
              {isGroupedView ? 'Días' : 'Ventas'} {filters.dateType === 'all' ? 'totales' : 'filtrados'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.totalAmount)}
            </div>
            <p className="text-sm text-muted-foreground">
              Total {filters.dateType === 'all' ? 'general' : 'filtrado'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(stats.averageAmount)}
            </div>
            <p className="text-sm text-muted-foreground">
              Promedio por {isGroupedView ? 'día' : 'venta'}
            </p>
          </CardContent>
        </Card>
      </div>

{/* Tabla con virtual scrolling */}
      {filteredData.length > 0 ? (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {filters.dateType === 'all' 
              ? `Mostrando todos los ${isGroupedView ? 'días' : 'registros'}`
              : filters.dateType === 'specific'
                ? `${isGroupedView ? 'Día' : 'Ventas'} del ${filters.specificDate ? format(parseISO(filters.specificDate), 'PPP', { locale: es }) : 'fecha seleccionada'}`
                : `${isGroupedView ? 'Días' : 'Ventas'} desde ${filters.startDate ? format(parseISO(filters.startDate), 'PPP', { locale: es }) : 'fecha inicio'} hasta ${filters.endDate ? format(parseISO(filters.endDate), 'PPP', { locale: es }) : 'fecha fin'}`
            }
          </div>
          
          {/* Versión desktop - Tabla virtualizada */}
          <div className="hidden lg:block">
            {isGroupedView ? (
              <div className="border rounded-lg">
                {/* Header fijo */}
                <div className="bg-muted sticky top-0 z-10">
                  <div className="grid grid-cols-6 gap-4 p-4 text-sm font-semibold">
                    {groupedHeaders.map((header, index) => (
                      <div key={index} className={`${header.width}`}>
                        {header.title}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Grupos expandibles */}
                <div className="max-h-[600px] overflow-auto">
                  {filteredData.map((grupo) => (
                    <div key={grupo.fecha}>
                      {renderGroupHeader(grupo)}
                      {expandedGroups.has(grupo.fecha) && (
                        <div>
                          {grupo.ventas.map((venta, index) => 
                            renderVentaInGroup(venta, index)
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <VirtualTable
                items={filteredData}
                itemHeight={100}
                containerHeight={600}
                renderItem={renderIndividualRow}
                headers={individualHeaders}
              />
            )}
          </div>
          
          {/* Versión móvil - Cards */}
          <div className="lg:hidden space-y-4">
            {isGroupedView ? (
              // Vista agrupada móvil
              filteredData.map((grupo) => (
                <div key={grupo.fecha} className="border rounded-lg">
                  <div 
                    className="p-4 bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => toggleGroupExpansion(grupo.fecha)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expandedGroups.has(grupo.fecha) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold">{grupo.fecha}</div>
                          <div className="text-xs text-muted-foreground">
                            {grupo.cantidad_ventas} venta{grupo.cantidad_ventas !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-primary">
                          {formatCurrency(grupo.total_ventas)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {expandedGroups.has(grupo.fecha) && (
                    <div className="border-t">
                      {grupo.ventas.slice(0, 10).map((venta) => (
                        <div key={venta.id} className="p-3 border-b last:border-b-0">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium">#{venta.id.slice(0, 8)}</div>
                            <div className="font-semibold text-primary">
                              {formatCurrency(venta.total)}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            {format(safeParseDate(venta.fecha), 'HH:mm:ss', { locale: es })}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => handleViewDetails(venta)}
                          >
                            Ver Detalles
                          </Button>
                        </div>
                      ))}
                      {grupo.ventas.length > 10 && (
                        <div className="p-3 text-center text-muted-foreground text-sm">
                          +{grupo.ventas.length - 10} ventas más
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              // Vista individual móvil
              filteredData.slice(0, 50).map((venta, index) => (
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
              ))
            )}
            
            {!isGroupedView && filteredData.length > 50 && (
              <div className="text-center text-muted-foreground text-sm">
                Mostrando las primeras 50 ventas de {filteredData.length} totales.
                En desktop se muestran todas con virtual scrolling.
              </div>
            )}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {filters.dateType === 'all' 
                ? `No hay ${isGroupedView ? 'días con ventas' : 'ventas aún'}.`
                : `No hay ${isGroupedView ? 'días' : 'ventas'} que coincidan con los filtros aplicados.`
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Diálogo de detalles */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de Venta</DialogTitle>
            <DialogDescription>
              Información completa de la venta seleccionada
            </DialogDescription>
          </DialogHeader>
          {selectedVenta && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
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
                    {selectedVenta.medio_pago.replace('_', ' ')}
                  </p>
                </div>
                {selectedVenta.cliente_nombre && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Cliente</p>
                    <p className="font-medium">{selectedVenta.cliente_nombre}</p>
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-3">Productos</h3>
                <div className="space-y-2">
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

              <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg">
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