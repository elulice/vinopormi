import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import NavbarPublico from "@/components/NavbarPublico";
import { apiGetPublic } from "@/lib/api";
import { API } from "@/lib/config";

const ITEMS_PER_PAGE = 32;

const PaginaCatalogo = () => {
  const [allProductos, setAllProductos] = useState([]);
  const [displayedProductos, setDisplayedProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [page, setPage] = useState(1);
  const loaderRef = useRef(null);

  const fetchProductos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (minPrice) params.append("min_price", minPrice);
      if (maxPrice) params.append("max_price", maxPrice);
      
      const response = await apiGetPublic(`${API}/public/catalogo?${params.toString()}`);
      setAllProductos(response.data);
    } catch (err) {
      console.error("Error fetching productos:", err);
      setError("Error al cargar el catálogo");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, minPrice, maxPrice]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchProductos();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [fetchProductos]);

  useEffect(() => {
    setDisplayedProductos(allProductos.slice(0, ITEMS_PER_PAGE));
    setPage(1);
  }, [allProductos]);

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    const start = ITEMS_PER_PAGE * (nextPage - 1);
    const end = start + ITEMS_PER_PAGE;
    const newItems = allProductos.slice(start, end);
    
    if (newItems.length > 0) {
      setDisplayedProductos((prev) => [...prev, ...newItems]);
      setPage(nextPage);
    }
  }, [allProductos, page]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) {
          if (displayedProductos.length < allProductos.length) {
            setLoadingMore(true);
            setTimeout(() => {
              loadMore();
              setLoadingMore(false);
            }, 100);
          }
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [loadMore, loadingMore, displayedProductos.length, allProductos.length]);

  const formatPrice = (price) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(price);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setMinPrice("");
    setMaxPrice("");
  };

  return (
    <div className="min-h-screen bg-white">
      <NavbarPublico />

      <section className="py-8 sm:py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-marthin text-3xl sm:text-4xl font-bold text-center text-primary mb-2">
            Catálogo
          </h1>
          <p className="text-center text-gray-500 mb-6">
            Explora nuestra colección completa
          </p>

          {/* Filtros */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <input
                  type="text"
                  placeholder="Buscar por nombre o categoría..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Precio mínimo"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Precio máximo"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            {(searchTerm || minPrice || maxPrice) && (
              <button
                onClick={clearFilters}
                className="mt-2 text-sm text-primary hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>

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

          {!loading && !error && displayedProductos.length === 0 && (
            <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow-sm">
              <p className="text-lg">No se encontraron productos.</p>
              <p className="text-sm mt-2">Probá cambiando los filtros de búsqueda.</p>
            </div>
          )}

          {!loading && !error && displayedProductos.length > 0 && (
            <>
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-3">
                {displayedProductos.map((producto, index) => (
                  <div
                    key={`${producto.id}-${index}`}
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
                      <h3 className="font-sans text-gray-800 truncate text-xs leading-tight">
                        {producto.nombre}
                      </h3>
                      <p className="text-sm font-bold text-primary mt-1">
                        {formatPrice(producto.precio_unitario)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {displayedProductos.length < allProductos.length && (
                <div ref={loaderRef} className="flex justify-center py-8">
                  {loadingMore ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  ) : (
                    <button
                      onClick={loadMore}
                      className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-md font-medium transition-colors"
                    >
                      Cargar más ({allProductos.length - displayedProductos.length} restantes)
                    </button>
                  )}
                </div>
              )}

              <div className="text-center mt-4 text-gray-500">
                <p>Mostrando {displayedProductos.length} de {allProductos.length} productos</p>
              </div>
            </>
          )}
        </div>
      </section>

      <footer className="bg-gray-100 py-8 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-marthin font-bold text-lg text-foreground">Vino por Mí</span>
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

export default PaginaCatalogo;
