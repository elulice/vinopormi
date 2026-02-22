import { capitalizeWords } from '@/lib/utils';

const STATUS_CONFIG = {
  pendiente: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
    label: 'Pendiente'
  },
  completado: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    label: 'Completado'
  },
  activo: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    label: 'Activo'
  },
  inactivo: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    label: 'Inactivo'
  },
  promo: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    label: 'Promo'
  },
  normal: {
    bg: 'bg-transparent',
    text: 'text-muted-foreground',
    label: 'Normal'
  },
  debe: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    label: 'Debe'
  },
  favor: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    label: 'A favor'
  },
  admin: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    label: 'Admin'
  },
  usuario: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    label: 'Usuario'
  },
  approved: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    label: 'Approved'
  },
  producto: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    label: 'Producto'
  },
  cliente: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    label: 'Cliente'
  },
  proveedor: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    label: 'Proveedor'
  },
  egreso: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    label: 'Egreso'
  },
  sticky_note: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    label: 'Nota'
  },
  creado: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    label: 'Creado'
  },
  crear: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    label: 'Creado'
  },
  modificado: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    label: 'Modificado'
  },
  actualizar: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    label: 'Modificado'
  },
  eliminado: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    label: 'Eliminado'
  },
  eliminar: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    label: 'Eliminado'
  }
};

const Size = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-xs px-2 py-0.5',
  lg: 'text-sm px-2.5 py-1'
};

function StatusBadge({ 
  status, 
  size = 'md',
  customBg, 
  customText,
  label,
  customClass 
}) {
  const config = STATUS_CONFIG[status?.toLowerCase()] || {};
  
  const bgClass = customBg || config.bg || 'bg-gray-100';
  const textClass = customText || config.text || 'text-gray-700';
  const displayLabel = label || config.label || status;
  const sizeClass = Size[size] || Size.md;

  return (
    <span className={`${bgClass} ${textClass} ${sizeClass} rounded font-medium inline-block ${customClass || ''}`}>
      {capitalizeWords(displayLabel)}
    </span>
  );
}

export default StatusBadge;
