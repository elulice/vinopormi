import { Link } from "react-router-dom";
import { logoImage } from "@/assets/images";

const NavbarPublico = () => {
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/Landing" className="flex items-center gap-3">
              <img 
                src={logoImage} 
                alt="Vino Por Mi" 
                className="w-8 h-8"
              />
              <span className="font-bold text-xl text-foreground">
                Vino Por Mi
              </span>
            </Link>
          </div>
          
          <div className="flex items-center gap-6">
            <Link 
              to="/Landing" 
              className="text-gray-700 hover:text-primary transition-colors font-medium"
            >
              Inicio
            </Link>
            <Link
              to="/clientes"
              className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-md font-medium transition-colors shadow-sm"
            >
              Acceso Clientes
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavbarPublico;
