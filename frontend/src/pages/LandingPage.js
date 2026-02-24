import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import NavbarPublico from "@/components/NavbarPublico";
import { apiGetPublic } from "@/lib/api";
import { API } from "@/lib/config";

const LandingPage = () => {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProductosPublicos = async () => {
      try {
        const response = await apiGetPublic(`${API}/public/destacados`);
        setProductos(response.data);
      } catch (err) {
        console.error("Error fetching productos:", err);
        setError("Error al cargar los productos");
      } finally {
        setLoading(false);
      }
    };

    fetchProductosPublicos();
  }, []);

  const formatPrice = (price) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-white">
      <NavbarPublico />

      {/* Hero Section con imagen de fondo */}
      <section className="relative bg-gradient-to-b from-primary/5 to-white py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <img
            src="https://images.pexels.com/photos/33553572/pexels-photo-33553572.jpeg"
            alt="Fondo Vino"
            className="w-full h-full object-cover"
          />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-primary mb-6">
            Vino Por Mi
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed">
            Descubrí nuestra selección exclusiva de vinos premium para los paladares más exigentes.
            Calidad, tradición y los mejores productores en un solo lugar.
          </p>
          <Link
            to="/Landing#catalogo"
            className="inline-block bg-primary hover:bg-primary/90 text-white px-8 py-3.5 rounded-md text-lg font-medium transition-all shadow-md hover:shadow-lg"
          >
            Ver Catálogo
          </Link>
        </div>
      </section>

      {/* Productos Destacados */}
      <section id="catalogo" className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-center text-foreground mb-2">
            Productos Destacados
          </h2>
          <p className="text-center text-gray-500 mb-8">
            Seleccionados especialmente para vos
          </p>

          {loading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-500 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          {!loading && !error && productos.length === 0 && (
            <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow-sm">
              <p className="text-lg">No hay productos disponibles actualmente.</p>
              <p className="text-sm mt-2">Pronto tendremos nuevas incorporaciones.</p>
            </div>
          )}

          {!loading && !error && productos.length > 0 && (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-3">
              {productos.map((producto, index) => (
                <div
                  key={`${producto.nombre}-${index}`}
                  className="group bg-white border border-gray-200 rounded-md overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                >
                  <div className="aspect-[3/4] bg-gray-100 flex items-center justify-center overflow-hidden">
                    {producto.image_url ? (
                      <img
                        src={producto.image_url}
                        alt={producto.nombre}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="text-4xl">🍷</div>
                    )}
                  </div>
                  <div className="p-2">
                    <h3 className="font-medium text-gray-800 truncate text-xs leading-tight">
                      {producto.nombre}
                    </h3>
                    <p className="text-sm font-bold text-primary mt-1">
                      {formatPrice(producto.precio_unitario)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Sección Características */}
      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="p-6">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                Variedad Premium
              </h3>
              <p className="text-gray-500">
                Selección de los mejores vinos locales e importados
              </p>
            </div>
            <div className="p-6">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚚</span>
              </div>
              <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                Entrega Rápida
              </h3>
              <p className="text-gray-500">
                Envíos a todo el país con máximo cuidado
              </p>
            </div>
            <div className="p-6">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💬</span>
              </div>
              <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                Atención Personalizada
              </h3>
              <p className="text-gray-500">
                Te asesoramos para encontrar el vino perfecto
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-100 py-8 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-foreground">Vino Por Mi</span>
            </div>
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} Todos los derechos reservados
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
