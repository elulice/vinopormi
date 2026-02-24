import { useState } from "react";
import NavbarPublico from "@/components/NavbarPublico";
import { apiGetPublic } from "@/lib/api";
import { API } from "@/lib/config";

const SeccionClientes = () => {
  const [dni, setDni] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cliente, setCliente] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dni.trim()) return;

    setLoading(true);
    setError(null);
    setCliente(null);

    try {
      const response = await apiGetPublic(`${API}/public/cliente/${dni}`);
      setCliente(response.data);
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

  return (
    <div className="min-h-screen bg-white">
      <NavbarPublico />

      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-md mx-auto px-4 sm:px-6">
          <h1 className="font-marthin text-2xl sm:text-3xl font-bold text-center text-primary mb-2">
            Consulta tu Estado
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
            <div className="mt-6 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
              <h2 className="font-marthin text-xl font-semibold text-foreground mb-4">
                ¡Bienvenido{cliente.apellido ? ` ${cliente.apellido}` : ""}, {cliente.nombre}!
              </h2>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-500">Puntos acumulados</span>
                  <span className="font-bold text-primary text-lg">{cliente.puntos}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-500">Saldo cuenta corriente</span>
                  <span className={`font-bold text-lg ${cliente.saldo > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {formatPrice(cliente.saldo)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default SeccionClientes;
