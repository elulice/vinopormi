import { capitalizeWords } from '@/lib/utils';

const STATUS_CONFIG = {
  pendiente: {
    bg: 'bg-yellow-100 dark:bg-yellow-500/20',
    text: 'text-yellow-700 dark:text-yellow-300',
    label: 'Pendiente'
  },
  completado: {
    bg: 'bg-green-100 dark:bg-green-500/20',
    text: 'text-green-700 dark:text-green-300',
    label: 'Completado'
  },
  activo: {
    bg: 'bg-blue-100 dark:bg-blue-500/20',
    text: 'text-blue-700 dark:text-blue-300',
    label: 'Activo'
  },
  inactivo: {
    bg: 'bg-gray-100 dark:bg-gray-500/20',
    text: 'text-gray-700 dark:text-gray-300',
    label: 'Inactivo'
  },
  promo: {
    bg: 'bg-orange-100 dark:bg-orange-500/20',
    text: 'text-orange-700 dark:text-orange-300',
    label: 'Promo'
  },
  normal: {
    bg: 'bg-transparent',
    text: 'text-muted-foreground',
    label: 'Normal'
  },
  debe: {
    bg: 'bg-red-100 dark:bg-red-500/20',
    text: 'text-red-700 dark:text-red-300',
    label: 'Debe'
  },
  favor: {
    bg: 'bg-green-100 dark:bg-green-500/20',
    text: 'text-green-700 dark:text-green-300',
    label: 'A favor'
  },
  admin: {
    bg: 'bg-red-100 dark:bg-red-500/20',
    text: 'text-red-800 dark:text-red-200',
    label: 'Admin'
  },
  usuario: {
    bg: 'bg-blue-100 dark:bg-blue-500/20',
    text: 'text-blue-800 dark:text-blue-200',
    label: 'Usuario'
  },
  approved: {
    bg: 'bg-green-100 dark:bg-green-500/20',
    text: 'text-green-800 dark:text-green-200',
    label: 'Approved'
  },
  producto: {
    bg: 'bg-blue-100 dark:bg-blue-500/20',
    text: 'text-blue-800 dark:text-blue-200',
    label: 'Producto'
  },
  cliente: {
    bg: 'bg-green-100 dark:bg-green-500/20',
    text: 'text-green-800 dark:text-green-200',
    label: 'Cliente'
  },
  proveedor: {
    bg: 'bg-orange-100 dark:bg-orange-500/20',
    text: 'text-orange-800 dark:text-orange-200',
    label: 'Proveedor'
  },
  egreso: {
    bg: 'bg-red-100 dark:bg-red-500/20',
    text: 'text-red-800 dark:text-red-200',
    label: 'Egreso'
  },
  sticky_note: {
    bg: 'bg-yellow-100 dark:bg-yellow-500/20',
    text: 'text-yellow-800 dark:text-yellow-200',
    label: 'Nota'
  },
  creado: {
    bg: 'bg-green-100 dark:bg-green-500/20',
    text: 'text-green-800 dark:text-green-200',
    label: 'Creado'
  },
  crear: {
    bg: 'bg-green-100 dark:bg-green-500/20',
    text: 'text-green-800 dark:text-green-200',
    label: 'Creado'
  },
  modificado: {
    bg: 'bg-yellow-100 dark:bg-yellow-500/20',
    text: 'text-yellow-800 dark:text-yellow-200',
    label: 'Modificado'
  },
  actualizar: {
    bg: 'bg-yellow-100 dark:bg-yellow-500/20',
    text: 'text-yellow-800 dark:text-yellow-200',
    label: 'Modificado'
  },
  eliminado: {
    bg: 'bg-red-100 dark:bg-red-500/20',
    text: 'text-red-800 dark:text-red-200',
    label: 'Eliminado'
  },
  eliminar: {
    bg: 'bg-red-100 dark:bg-red-500/20',
    text: 'text-red-800 dark:text-red-200',
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
  
  const bgClass = customBg || config.bg || 'bg-gray-100 dark:bg-gray-500/20';
  const textClass = customText || config.text || 'text-gray-700 dark:text-gray-300';
  const displayLabel = label || config.label || status;
  const sizeClass = Size[size] || Size.md;

  return (
    <span className={`${bgClass} ${textClass} ${sizeClass} rounded font-medium inline-block ${customClass || ''}`}>
      {capitalizeWords(displayLabel)}
    </span>
  );
}

export default StatusBadge;

