import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import FormInput from '../../components/FormInput';
import Alert from '../../components/Alert';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    nombres: '',
    apellidos: '',
    cedula: '',
    email: '',
    telefono: '',
    password: '',
    confirmPassword: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas ingresadas no coinciden.');
      return;
    }

    if (formData.cedula && formData.cedula.length !== 10) {
      setError('La cédula de identidad ecuatoriana debe tener exactamente 10 dígitos.');
      return;
    }

    setLoading(true);

    try {
      const fullName = `${formData.nombres.trim()} ${formData.apellidos.trim()}`;
      await register({
        nombre: fullName,
        email: formData.email,
        password: formData.password,
        cedula: formData.cedula,
        telefono: formData.telefono,
      });

      navigate('/login', {
        state: {
          success: 'Cuenta creada correctamente. Ya puedes iniciar sesión con tus credenciales.',
        },
      });
    } catch (err) {
      setError(err.message || 'Error al procesar el registro de cliente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-[26px] font-bold text-primary tracking-tight">
          Crear una cuenta
        </h1>
        <p className="text-[14px] text-on-surface-variant">
          Registra tus datos para gestionar y dar seguimiento a tus solicitudes
        </p>
      </div>

      {error && <Alert type="error" title="Atención">{error}</Alert>}

      <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput
              label="Nombres"
              name="nombres"
              value={formData.nombres}
              onChange={handleChange}
              placeholder="Juan Mateo"
              required
            />
            <FormInput
              label="Apellidos"
              name="apellidos"
              value={formData.apellidos}
              onChange={handleChange}
              placeholder="Pérez Gómez"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput
              label="Cédula de identidad"
              name="cedula"
              value={formData.cedula}
              onChange={handleChange}
              placeholder="1720000001"
              maxLength={10}
              required
              hint="10 dígitos numéricos"
            />
            <FormInput
              label="Teléfono"
              name="telefono"
              value={formData.telefono}
              onChange={handleChange}
              placeholder="0991234567"
            />
          </div>

          <FormInput
            type="email"
            label="Correo electrónico"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="ejemplo@correo.com"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput
              type="password"
              label="Contraseña"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
            <FormInput
              type="password"
              label="Confirmar contraseña"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="fintech"
              size="lg"
              loading={loading}
              loadingText="Registrando..."
              className="w-full"
            >
              Crear cuenta
            </Button>
          </div>
        </form>

        <div className="pt-2 text-center text-[13px] text-gray-500">
          ¿Ya tienes una cuenta registrada?{' '}
          <Link to="/login" className="font-semibold text-secondary hover:underline">
            Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
