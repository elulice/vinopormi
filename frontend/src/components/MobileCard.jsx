const MobileCard = ({ 
  children, 
  onClick, 
  className = '', 
  ...props 
}) => (
  <div 
    className={`cursor-pointer hover:bg-muted/50 transition-colors rounded-lg p-1 sm:p-2 border text-xs ${className}`}
    onClick={onClick}
    {...props}
  >
    {children}
  </div>
);

export const MobileCardHeader = ({ children, className = '' }) => (
  <div className={`flex items-center justify-between mb-1 ${className}`}>
    {children}
  </div>
);

export const MobileCardIcon = ({ children, className = '', bgClass = 'bg-primary/10' }) => (
  <div className={`w-6 h-6 ${bgClass} rounded flex items-center justify-center ${className}`}>
    {children}
  </div>
);

export const MobileCardInfo = ({ children, className = '' }) => (
  <div className={`flex items-center gap-1 text-xs text-muted-foreground ${className}`}>
    {children}
  </div>
);

export const MobileCardActions = ({ children, className = '' }) => (
  <div className={`flex gap-1 pt-1 border-t ${className}`}>
    {children}
  </div>
);

export default MobileCard;
