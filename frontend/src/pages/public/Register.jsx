import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import FormInput from '../../components/FormInput';
import Alert from '../../components/Alert';
import { rules, isValidCedula, isValidPhone } from '../../utils/validation';

function validate(form) {
  const errors = {
    nombres: rules.name(form.nombres, 'nombres'),
    apellidos: rules.name(form.apellidos, 'apellidos'),
    email: rules.email(form.email),
    cedula: form.cedula && !isValidCedula(form.cedula) ? 'La cédula no es válida. Revisa los 10 dígitos.' : undefined,
    telefono: form.telefono && !isValidPhone(form.telefono)
      ? 'Ingresa un celular de 10 dígitos (09...) o un teléfono fijo con código de provincia.'
      : undefined,
    password: !form.password
      ? 'Ingresa una contraseña.'
      : form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)
        ? 'Usa al menos 8 caracteres con letras y números.'
        : undefined,
    confirmPassword: form.confirmPassword !== form.password ? 'Las contraseñas no coinciden.' : undefined,
  };
  return Object.fromEntries(Object.entries(errors).filter(([, value]) => value));
}

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
  const [fieldErrors, setFieldErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const errors = validate(formData);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Revisa los campos marcados.');
      return;
    }

    setLoading(true);

    try {
      const fullName = `${formData.nombres.trim()} ${formData.apellidos.trim()}`;
      await register({
        nombre: fullName,
        email: formData.email.trim(),
        password: formData.password,
        cedula: formData.cedula.trim(),
        telefono: formData.telefono.trim(),
      });

      // La cuenta ya quedó con sesión iniciada: se ofrece verificar la identidad (o hacerlo más tarde)
      navigate('/cliente/verificacion?bienvenida=1');
    } catch (err) {
      setError(err.message || 'No se pudo crear la cuenta. Intenta nuevamente.');
      if (err.errors && !Array.isArray(err.errors)) {
        // El backend valida el nombre completo en el campo "nombre"
        const { nombre, ...rest } = err.errors;
        setFieldErrors({ ...rest, ...(nombre ? { nombres: nombre } : {}) });
      }
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
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput
              label="Nombres"
              name="nombres"
              value={formData.nombres}
              onChange={handleChange}
              placeholder="Juan Mateo"
              error={fieldErrors.nombres}
              required
            />
            <FormInput
              label="Apellidos"
              name="apellidos"
              value={formData.apellidos}
              onChange={handleChange}
              placeholder="Pérez Gómez"
              error={fieldErrors.apellidos}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput
              label="Cédula de identidad"
              name="cedula"
              inputMode="numeric"
              value={formData.cedula}
              onChange={handleChange}
              placeholder="1712345678"
              maxLength={10}
              error={fieldErrors.cedula}
              hint="10 dígitos numéricos"
            />
            <FormInput
              label="Teléfono"
              name="telefono"
              inputMode="tel"
              value={formData.telefono}
              onChange={handleChange}
              placeholder="0991234567"
              error={fieldErrors.telefono}
            />
          </div>

          <FormInput
            type="email"
            label="Correo electrónico"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="ejemplo@correo.com"
            error={fieldErrors.email}
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
              error={fieldErrors.password}
              hint="Mínimo 8 caracteres, con letras y números."
              required
            />
            <FormInput
              type="password"
              label="Confirmar contraseña"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              error={fieldErrors.confirmPassword}
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
