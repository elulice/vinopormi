import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { cellarImage, loginLogoImage } from '@/assets/images';
import './Login.css';

const eyeOpen = (
  <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </>
);

const eyeOff = (
  <>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </>
);

const VARIEDADES = [
  'Malbec',
  'Cabernet Franc',
  'Torrontés',
  'Pinot Noir',
  'Bonarda',
  'Chardonnay',
  'Syrah',
  'Riesling',
];

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(username, password, remember);
      toast.success('Inicio de sesión exitoso');
      navigate('/dashboard');
    } catch (error) {
      const detalle = error.response?.data?.detail;
      if (detalle) {
        toast.error(detalle);
      } else if (!error.response) {
        toast.error('No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.');
      } else {
        toast.error('Error en la autenticación');
      }
    } finally {
      setLoading(false);
    }
  };

  const checkCaps = (e) => {
    setCapsLock(!!(e.getModifierState && e.getModifierState('CapsLock')));
  };

  return (
    <div className="login-v4">
      <main className="shell">
        <section className="form-col">
          <header className="topbar">
            <span className="status">
              <i aria-hidden="true" />
              Panel de gestión
            </span>
          </header>

          <div className="form-body">
            <p className="eyebrow">Acceso</p>
            <h1>
              <span className="logo">
                <img src={loginLogoImage} alt="Vino por Mí Bebidas" />
              </span>
              <span className="h1-text">Vino <em>Por Mi</em></span>
            </h1>

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="username">Usuario</label>
                <div className="control">
                  <svg
                    className="icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                  </svg>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoFocus
                    autoComplete="username"
                    placeholder="Tu nombre de usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    data-testid="login-username-input"
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="password">Contraseña</label>
                <div className="control">
                  <svg
                    className="icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="4" y="10" width="16" height="11" rx="2.5" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={checkCaps}
                    onKeyDown={checkCaps}
                    onBlur={() => setCapsLock(false)}
                    required
                    data-testid="login-password-input"
                  />
                  <button
                    type="button"
                    className="toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={showPassword}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {showPassword ? eyeOff : eyeOpen}
                    </svg>
                  </button>
                </div>
                {capsLock && (
                  <p className="caps" role="status">
                    Bloq Mayús está activado
                  </p>
                )}
              </div>

              <label className="check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Mantener la sesión iniciada
              </label>

              <button
                type="submit"
                className={`submit${loading ? ' loading' : ''}`}
                disabled={loading}
                data-testid="login-submit-button"
              >
                <span>{loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}</span>
                <span className="pill">
                  <svg
                    className="arrow"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                  <span className="spinner" aria-hidden="true" />
                </span>
              </button>
            </form>
          </div>

          <footer className="bottom">
            <span>© 2026 Vino por Mí · Bebidas</span>
          </footer>
        </section>

        <section className="visual" aria-hidden="true">
          <img className="visual-bg" src={cellarImage} alt="" />
          <div className="visual-top">
            <span className="tag">Selección de la casa</span>
            <span className="vintage">Cosecha MMXXVI</span>
          </div>

          <div className="note">
            <p className="note-label">Nota de cata</p>
            <p className="note-quote">
              Cada botella guarda una historia esperando ser descorchada.
            </p>
          </div>

          <div className="marquee">
            <div className="marquee-track">
              {VARIEDADES.map((v) => (
                <span key={v}>{v}</span>
              ))}
              {VARIEDADES.map((v) => (
                <span key={`${v}-2`}>{v}</span>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Login;
