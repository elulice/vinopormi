import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { 
  DollarSign, 
  MessageCircle, 
  Wine, 
  Users,
  Sparkles
} from 'lucide-react';

const NEWS_KEY = 'vpm_news_seen_v1';

const features = [
  {
    icon: DollarSign,
    title: 'Control de Rentabilidad',
    description: 'Ahora podés ver tu ganancia Neta y Bruta en cada venta y en los totales del día.'
  },
  {
    icon: MessageCircle,
    title: 'Hilos de Comentarios',
    description: 'Las StickyNotes ahora permiten agregar comentarios para hacer seguimiento de trámites o pedidos.'
  },
  {
    icon: Wine,
    title: 'Catálogo Separado',
    description: 'La Landing Page ahora es más rápida y el catálogo completo tiene su propia sección con filtros.'
  },
  {
    icon: Users,
    title: 'Portal de Miembros',
    description: 'Mejoramos la visualización de puntos y saldos para tus clientes.'
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 shadow-2xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
            <Sparkles className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="font-bold text-2xl text-amber-800">
            ¡Novedades!
          </h2>
        </div>

        <div className="space-y-4 mb-6 max-h-[50vh] overflow-y-auto pr-2">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="flex gap-3 p-3 bg-white/60 rounded-lg border border-amber-100/50"
            >
              <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <feature.icon className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-sans font-medium text-gray-800 text-sm">{feature.title}</h3>
                <p className="text-xs text-gray-600 leading-tight">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleClose}
          className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-lg shadow-md transition-all duration-200 transform hover:scale-[1.02]"
        >
          ¡Entendido, vamos a trabajar!
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeModal;
