import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { 
  Calculator,
  Wallet,
  LayoutGrid,
  CreditCard,
  Globe,
  ExternalLink
} from 'lucide-react';

const NEWS_KEY = 'vpm_news_seen_v1.04';

const features = [
  {
    icon: Wallet,
    title: 'Balance del Día',
    description: 'Ahora muestra la liquidez real: efectivo + transferencia + posnet + cobros de cuentas corrientes.'
  },
  {
    icon: Calculator,
    title: 'Calculadora de Vuelto',
    description: 'Opcional desde Configuración. Mostrá u ocultá la calculadora de vuelto en nuevas ventas.'
  },
  {
    icon: LayoutGrid,
    title: 'Card de Balance',
    description: 'Diseño mejorado con efecto hover para destacar el balance del día.'
  },
  {
    icon: CreditCard,
    title: 'Mercadopago',
    description: 'Nueva sección para buscar transferencias y asociarlas con ventas.'
  },
  {
    icon: Globe,
    title: 'Sección Landing',
    description: 'Nueva sección pública para tu catálogo de productos. (En desarrollo).',
    link: '/Landing',
    linkText: 'Ver Landing'
  }
];

const WelcomeModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const hasSeenNews = localStorage.getItem(NEWS_KEY);
    if (!hasSeenNews) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(NEWS_KEY, 'true');
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm bg-background border-border">
        <div className="text-center mb-4">
          <h2 className="font-semibold text-lg text-foreground">
            Novedades
          </h2>
        </div>

        <div className="space-y-3 mb-4">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="flex gap-3 p-2"
            >
              <div className="flex-shrink-0 w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                <feature.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium text-sm">{feature.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {feature.description}
                  {feature.link && (
                    <a 
                      href={feature.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-1 text-blue-600 hover:underline inline-flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {feature.linkText} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleClose}
          className="w-full py-2 text-sm bg-primary text-primary-foreground font-medium rounded-md hover:opacity-90 transition-opacity"
        >
          Cerrar
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeModal;
