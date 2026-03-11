import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Login from "@/pages/Login";
import LandingPage from "@/pages/LandingPage";
import PaginaCatalogo from "@/pages/PaginaCatalogo";
import SeccionClientes from "@/pages/SeccionClientes";
import Dashboard from "@/pages/Dashboard";
import Productos from "@/pages/Productos";
import Clientes from "@/pages/Clientes";
import Proveedores from "@/pages/Proveedores";
import Ventas from "@/pages/Ventas";
import NuevaVenta from "@/pages/NuevaVenta";

import Egresos from "@/pages/Egresos";
import Usuarios from "@/pages/Usuarios";
import LoginRegistros from "@/pages/LoginRegistros";
import Auditoria from "@/pages/Auditoria";
import Herramientas from "@/pages/Herramientas";
import Configuracion from "@/pages/Configuracion";
import Mercadopago from "@/pages/Mercadopago";
import Layout from "@/components/Layout";
import BackgroundSync from "@/components/BackgroundSync";
import AdminRoute from "@/components/AdminRoute";
import { AuthProvider } from "@/context/AuthContext";
import { ConfigProvider } from "@/context/ConfigContext";
import ProtectedRoute from "@/components/ProtectedRoute";

window.addEventListener("wheel", () => {
  if (document.activeElement && document.activeElement.type === "number") {
    document.activeElement.blur();
  }
});

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* RUTAS PÚBLICAS - Sin AuthProvider ni ConfigProvider */}
        <Route path="/Landing" element={<LandingPage />} />
        <Route path="/catalogo" element={<PaginaCatalogo />} />
        <Route path="/miembros" element={<SeccionClientes />} />
        
        {/* LOGIN - Con AuthProvider pero sin ProtectedRoute */}
        <Route path="/login" element={
          <AuthProvider>
            <ConfigProvider>
              <Login />
            </ConfigProvider>
          </AuthProvider>
        } />

        {/* RUTAS PROTEGIDAS CON CONTEXTOS */}
        <Route
          element={
            <AuthProvider>
              <ConfigProvider>
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              </ConfigProvider>
            </AuthProvider>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/nueva-venta" element={<NuevaVenta />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/egresos" element={<Egresos />} />
          <Route path="/usuarios" element={
            <AdminRoute>
              <Usuarios />
            </AdminRoute>
          } />
          <Route path="/login-registros" element={
            <AdminRoute>
              <LoginRegistros />
            </AdminRoute>
          } />
          <Route path="/auditoria" element={
            <AdminRoute>
              <Auditoria />
            </AdminRoute>
          } />
          <Route path="/herramientas" element={
            <AdminRoute>
              <Herramientas />
            </AdminRoute>
          } />
          <Route path="/mercadopago" element={
            <Mercadopago />
          } />
          <Route path="/configuracion" element={<Configuracion />} />
          <Route path="/clientes" element={<Clientes />} />
        </Route>
      </Routes>

      <BackgroundSync />
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}

export default App;
