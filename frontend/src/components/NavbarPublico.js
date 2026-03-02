import { useState } from "react";
import { Link } from "react-router-dom";
import { logoImage } from "@/assets/images";

const NavbarPublico = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/Landing" className="flex items-center gap-3">
              <img 
                src={logoImage} 
                alt="Vino Por Mi" 
                className="w-10 h-10 sm:w-12 sm:h-12"
              />
              <span className="font-marthin-lg text-foreground text-primary hidden sm:block">
                Vino por Mí
              </span>
            </Link>
          </div>
          
          <div className="hidden sm:flex items-center gap-6">
            <Link 
              to="/Landing" 
              className="text-gray-700 hover:text-primary transition-colors font-medium"
            >
              Inicio
            </Link>
            <Link
              to="/miembros"
              className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-md font-medium transition-colors shadow-sm"
            >
              Acceso Miembros
            </Link>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="sm:hidden p-2 text-gray-600 hover:text-primary focus:outline-none"
            aria-label="Menú"
          >
            {isOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="sm:hidden border-t border-gray-200">
          <div className="px-4 py-3 space-y-3">
            <Link 
              to="/Landing" 
              className="block text-gray-700 hover:text-primary transition-colors font-medium py-2"
              onClick={() => setIsOpen(false)}
            >
              Inicio
            </Link>
            <Link
              to="/miembros"
              className="block bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-md font-medium transition-colors shadow-sm text-center"
              onClick={() => setIsOpen(false)}
            >
              Acceso Miembros
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default NavbarPublico;
