import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Productos from "@/pages/Productos";
import Clientes from "@/pages/Clientes";
import Ventas from "@/pages/Ventas";
import NuevaVenta from "@/pages/NuevaVenta";
import CuentaCorriente from "@/pages/CuentaCorriente";
import Egresos from "@/pages/Egresos";
import Usuarios from "@/pages/Usuarios";
import Herramientas from "@/pages/Herramientas";
import Layout from "@/components/Layout";
import AdminRoute from "@/components/AdminRoute";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* LOGIN */}
          <Route path="/login" element={<Login />} />

          {/* RUTAS PROTEGIDAS CON LAYOUT */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/nueva-venta" element={<NuevaVenta />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/ventas" element={<Ventas />} />
            <Route path="/egresos" element={<Egresos />} />
            <Route path="/usuarios" element={
              <AdminRoute>
                <Usuarios />
              </AdminRoute>
            } />
            <Route path="/herramientas" element={
              <AdminRoute>
                <Herramientas />
              </AdminRoute>
            } />
            <Route
              path="/clientes/:clienteId/cuenta-corriente"
              element={<CuentaCorriente />}
            />
            <Route
              path="/clientes/:clienteId/cuenta-corriente"
              element={<CuentaCorriente />}
            />
          </Route>
        </Routes>

        <Toaster position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
