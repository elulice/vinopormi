import { useState } from "react";
import NavbarPublico from "@/components/NavbarPublico";
import { apiGetPublic } from "@/lib/api";
import { API } from "@/lib/config";

const SeccionClientes = () => {
  const [dni, setDni] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [ventas, setVentas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dni.trim()) return;

    setLoading(true);
    setError(null);
    setCliente(null);
    setVentas([]);
    setMovimientos([]);

    try {
      const [clienteRes, ventasRes] = await Promise.all([
        apiGetPublic(`${API}/public/cliente/${dni}`),
        apiGetPublic(`${API}/public/cliente/${dni}/ventas`)
      ]);
      
      setCliente(clienteRes.data);
      setVentas(ventasRes.data);
      
      // Si tiene saldo en cuenta corriente, traer movimientos
      if (clienteRes.data.saldo !== 0) {
        const movimientosRes = await apiGetPublic(`${API}/public/cliente/${dni}/movimientos`);
        setMovimientos(movimientosRes.data);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setError("No se encontró ningún cliente con ese DNI");
      } else {
        setError("Error al consultar. Intenta más tarde.");
      }
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(price);
  };

  const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const totalCompras = ventas.reduce((sum, v) => sum + v.total, 0);
  const tieneCuentaCorriente = cliente?.saldo !== 0;

  return (
    <div className="min-h-screen bg-white">
      <NavbarPublico />

      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-md mx-auto px-4 sm:px-6">
          <h1 className="font-marthin text-2xl sm:text-3xl font-bold text-center text-primary mb-2">
            Mi Cuenta
          </h1>
          <p className="text-center text-gray-500 mb-8">
            Ingresá tu DNI para ver tu información
          </p>

          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="mb-4">
              <label htmlFor="dni" className="block text-sm font-medium text-gray-700 mb-2">
                Número de DNI
              </label>
              <input
                type="text"
                id="dni"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                placeholder="Ej: 12345678"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !dni.trim()}
              className="w-full bg-primary hover:bg-primary/90 disabled:bg-gray-300 text-white px-4 py-2.5 rounded-md font-medium transition-colors"
            >
              {loading ? "Consultando..." : "Consultar mi estado"}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-center">
              {error}
            </div>
          )}

          {cliente && (
            <>
              {/* Tarjeta de miembro con gradiente burdeos */}
              <div className="mt-6 rounded-xl overflow-hidden shadow-lg">
                <div className="bg-gradient-to-br from-[#722F37] to-[#8B3A44] p-6 text-white">
                  <h2 className="font-marthin text-xl mb-1">
                    ¡Bienvenido{cliente.apellido ? ` ${cliente.apellido}` : ""}, {cliente.nombre}!
                  </h2>
                  <p className="text-white/70 text-sm">Miembro VIP</p>
                </div>
                
                <div className="bg-white p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-500">Puntos acumulados</span>
                      <span className="font-bold text-[#722F37] text-lg">{cliente.puntos}</span>
                    </div>
                    
                    {tieneCuentaCorriente ? (
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-500">Saldo Cuenta Corriente</span>
                        <span className={`font-bold text-lg ${cliente.saldo < 0 ? 'text-red-500' : 'text-green-500'}`}>
                          {cliente.saldo < 0 
                            ? formatPrice(Math.abs(cliente.saldo))
                            : formatPrice(cliente.saldo)
                          }
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-500">Total de Compras Realizadas</span>
                        <span className="font-bold text-[#722F37] text-lg">
                          {formatPrice(totalCompras)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Si tiene cuenta corriente, mostrar movimientos de CTA CTE */}
              {tieneCuentaCorriente && movimientos.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-marthin text-lg text-[#722F37] mb-3">
                    Movimientos de Cuenta Corriente
                  </h3>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {movimientos.map((mov, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-3 border-b border-gray-100 last:border-b-0"
                      >
                        <span className="text-gray-600 text-sm">
                          {formatDate(mov.fecha)}
                        </span>
                        
                        <span className="text-gray-500 text-xs flex-1 mx-2 truncate">
                          {mov.concepto}
                        </span>
                        
                        <span className={`font-sans font-bold ${
                          mov.tipo === 'pago' ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {mov.tipo === 'pago' ? '+' : '-'}{formatPrice(mov.monto)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Si NO tiene cuenta corriente, mostrar historial de compras */}
              {!tieneCuentaCorriente && ventas.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-marthin text-lg text-[#722F37] mb-3">
                    Historial de Compras
                  </h3>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {ventas.slice(0, 10).map((venta, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-3 border-b border-gray-100 last:border-b-0"
                      >
                        <span className="text-gray-600 text-sm">
                          {formatDate(venta.fecha)}
                        </span>
                        
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          venta.estado === 'Pagado' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {venta.estado}
                        </span>
                        
                        <span className="font-sans font-bold text-[#722F37]">
                          {formatPrice(venta.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default SeccionClientes;
