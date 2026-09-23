import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import FormInput from '../../components/FormInput';
import Alert from '../../components/Alert';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(location.state?.message || null);
  const [successMsg, setSuccessMsg] = useState(location.state?.success || null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const loggedUser = await login(email, password);
      const defaultDest = loggedUser.rol === 'CLIENTE' ? '/cliente' : '/admin';
      const destination = location.state?.from || defaultDest;
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || 'Credenciales no válidas. Verifique su correo y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const fillQuickCredentials = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-10 space-y-6">
      {/* Cabecera */}
      <div className="text-center space-y-1">
        <h1 className="text-[26px] font-bold text-primary tracking-tight">Iniciar sesión</h1>
        <p className="text-[14px] text-on-surface-variant">
          Accede a tus simulaciones y solicitudes guardadas
        </p>
      </div>

      {successMsg && <Alert type="success" title="Excelente">{successMsg}</Alert>}
      {error && <Alert type="error" title="Error de autenticación">{error}</Alert>}

      {/* Formulario */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            type="email"
            label="Correo electrónico"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ejemplo@finanecuador.local"
            required
          />

          <FormInput
            type="password"
            label="Contraseña"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          <div className="pt-2">
            <Button
              type="submit"
              variant="fintech"
              size="lg"
              loading={loading}
              loadingText="Iniciando sesión..."
              className="w-full"
            >
              Iniciar sesión
            </Button>
          </div>
        </form>

        <div className="pt-2 text-center text-[13px] text-gray-500">
          ¿Aún no tienes una cuenta?{' '}
          <Link to="/register" className="font-semibold text-secondary hover:underline">
            Regístrate aquí
          </Link>
        </div>
      </div>

      {/* Credenciales de Prueba Rápida para Evaluación */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/80 space-y-3">
        <div className="text-[12px] font-semibold text-gray-600">
          Credenciales de prueba para evaluación:
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => fillQuickCredentials('admin@finanecuador.local', 'Admin123!')}
            className="p-2 rounded-lg bg-white border border-gray-200 hover:border-secondary text-left transition-colors"
          >
            <div className="font-bold text-primary text-[12px]">Admin</div>
            <div className="text-[11px] text-gray-400 truncate">admin@...</div>
          </button>

          <button
            type="button"
            onClick={() => fillQuickCredentials('asesor@finanecuador.local', 'Asesor123!')}
            className="p-2 rounded-lg bg-white border border-gray-200 hover:border-secondary text-left transition-colors"
          >
            <div className="font-bold text-primary text-[12px]">Asesor</div>
            <div className="text-[11px] text-gray-400 truncate">asesor@...</div>
          </button>

          <button
            type="button"
            onClick={() => fillQuickCredentials('cliente@finanecuador.local', 'Cliente123!')}
            className="p-2 rounded-lg bg-white border border-gray-200 hover:border-secondary text-left transition-colors"
          >
            <div className="font-bold text-primary text-[12px]">Cliente</div>
            <div className="text-[11px] text-gray-400 truncate">cliente@...</div>
          </button>
        </div>
      </div>
    </div>
  );
}
