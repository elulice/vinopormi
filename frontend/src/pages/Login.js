import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { logoImage } from '@/assets/images';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await login(username, password);
        toast.success('Inicio de sesión exitoso');
        navigate('/dashboard');
      } else {
        await register(username, password, nombre);
        toast.success('Registro exitoso. Ahora puedes iniciar sesión.');
        setIsLogin(true);
        setPassword('');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error en la autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4">
      <div className="absolute inset-0 opacity-5 dark:opacity-10">
        <img
          src="https://images.pexels.com/photos/33553572/pexels-photo-33553572.jpeg"
          alt="Background"
          className="w-full h-full object-cover"
        />
      </div>
      
      <Card className="w-full max-w-md relative z-10 shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            {/* <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center overflow-hidden"> */}
            <div className="w-18 h-18 rounded-full flex items-center justify-center overflow-hidden">
              <img 
                src={logoImage} 
                alt="Vinoteca Logo" 
                className="w-18 h-18 object-contain"
              />
            </div>
          </div>
          <div>
            {/* <CardTitle className="text-3xl font-bold">Vino Por Mi</CardTitle> */}
            <CardDescription className="text-base mt-2">
              {isLogin ? 'Inicia sesión para continuar' : 'Crea una nueva cuenta'}
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre completo</Label>
                <Input
                  id="nombre"
                  type="text"
                  placeholder="Juan Pérez"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required={!isLogin}
                  data-testid="register-nombre-input"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                type="text"
                placeholder="usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                data-testid="login-username-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="login-password-input"
              />
            </div>
            
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="login-submit-button"
            >
              {loading ? 'Cargando...' : isLogin ? 'Iniciar Sesión' : 'Registrarse'}
            </Button>
          </form>
          
{/*           <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-primary hover:underline"
              data-testid="toggle-auth-mode"
            >
              {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          </div> */}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;