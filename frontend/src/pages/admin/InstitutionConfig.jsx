import React, { useEffect, useState } from 'react';
import { adminService, resolveApiAssetUrl } from '../../services/api';
import { useInstitution } from '../../context/InstitutionContext';
import Card from '../../components/Card';
import Button from '../../components/Button';
import FormInput from '../../components/FormInput';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';

export default function InstitutionConfig() {
  const { setInstitution } = useInstitution();
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'BANCO_PRIVADO',
    ruc: '',
    direccion: '',
    telefono: '',
    email: '',
    sitioWeb: '',
    logo: '/LogoFinanEcuador.png',
    colorPrincipal: '#001026',
    colorSecundario: '#0050cc',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminService
      .getInstitution()
      .then((res) => {
        if (res.success && res.data?.institution) {
          const inst = res.data.institution;
          setFormData({
            nombre: inst.nombre || '',
            tipo: inst.tipo || 'BANCO_PRIVADO',
            ruc: inst.ruc || '',
            direccion: inst.direccion || '',
            telefono: inst.telefono || '',
            email: inst.email || '',
            sitioWeb: inst.sitioWeb || '',
            logo: inst.logo || '/LogoFinanEcuador.png',
            colorPrincipal: inst.colorPrincipal || '#001026',
            colorSecundario: inst.colorSecundario || '#0050cc',
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('El logotipo debe ser una imagen JPG o PNG.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('El logotipo no puede superar 5 MB.');
      return;
    }

    setError(null);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      let res = await adminService.updateInstitution(formData);
      if (logoFile) {
        const payload = new FormData();
        payload.append('logo', logoFile);
        res = await adminService.uploadInstitutionLogo(payload);
      }

      if (res.success && res.data?.institution) {
        const updatedInstitution = res.data.institution;
        setInstitution(updatedInstitution);
        setFormData((previous) => ({ ...previous, logo: updatedInstitution.logo }));
        setLogoFile(null);
        setLogoPreview(null);
        setSuccessMsg('Información institucional y parámetros de identidad actualizados.');
      }
    } catch (err) {
      setError(err.message || 'Error al actualizar datos de la institución.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Cargando configuración institucional..." />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-space-md">
      {/* Header */}
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs">
        <h1 className="font-headline-lg text-[24px] text-primary font-bold">
          Administración de la Institución
        </h1>
        <p className="font-body-sm text-[13px] text-on-surface-variant mt-0.5">
          Datos oficiales de la entidad fiduciaria para reportes, encabezados de PDFs y marca institucional.
        </p>
      </div>

      {error && <Alert type="error" title="Error">{error}</Alert>}
      {successMsg && <Alert type="success" title="Actualizado">{successMsg}</Alert>}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput
              label="Nombre de la Institución"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="FinanEcuador Demo"
              required
            />
            <FormInput
              type="select"
              label="Tipo de Entidad Supervisada"
              name="tipo"
              value={formData.tipo}
              onChange={handleChange}
              options={[
                { value: 'BANCO_PRIVADO', label: 'Banco Privado (SuperBancos)' },
                { value: 'COOPERATIVA', label: 'Cooperativa (SEPS)' },
              ]}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput
              label="RUC Institucional"
              name="ruc"
              value={formData.ruc}
              onChange={handleChange}
              placeholder="1790000000001"
              maxLength={13}
              required
            />
            <FormInput
              label="Teléfono de Contacto"
              name="telefono"
              value={formData.telefono}
              onChange={handleChange}
              placeholder="(02) 299-9999"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput
              type="email"
              label="Correo Institucional"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="contacto@finanecuador.local"
              required
            />
            <FormInput
              label="Sitio Web Oficial"
              name="sitioWeb"
              value={formData.sitioWeb}
              onChange={handleChange}
              placeholder="https://finanecuador.local"
            />
          </div>

          <FormInput
            label="Dirección Domiciliaria Matriz"
            name="direccion"
            value={formData.direccion}
            onChange={handleChange}
            placeholder="Av. Amazonas y República, Quito - Ecuador"
          />

          <FormInput
            label="Ruta o URL del Logo"
            name="logo"
            value={formData.logo}
            onChange={handleChange}
            placeholder="/LogoFinanEcuador.png"
            hint="Ruta del logotipo oficial para pantalla y reportes PDF"
          />

          <div className="space-y-1">
            <label className="block font-title-md text-[13px] text-primary" htmlFor="institutionLogo">
              Subir logotipo
            </label>
            <input
              id="institutionLogo"
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleLogoChange}
              className="block w-full text-[13px] text-on-surface-variant file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-4 file:py-2 file:font-semibold file:text-white hover:file:opacity-90"
            />
            <p className="text-[12px] text-on-surface-variant">PNG o JPG, máximo 5 MB.</p>
          </div>

          {(logoPreview || formData.logo) && (
            <div className="rounded-lg border border-surface-container-high bg-surface-container-low p-3">
              <span className="block font-title-md text-[12px] text-primary mb-2">
                Vista previa del logo
              </span>
              <img
                src={logoPreview || resolveApiAssetUrl(formData.logo)}
                alt={`Logo de ${formData.nombre || 'la institución'}`}
                className="h-16 max-w-full object-contain"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="space-y-1">
              <label className="block font-title-md text-[13px] text-primary" htmlFor="colorPrincipal">
                Color Principal
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="colorPrincipal"
                  type="color"
                  name="colorPrincipal"
                  value={formData.colorPrincipal}
                  onChange={handleChange}
                  className="h-10 w-14 rounded cursor-pointer border border-surface-container-high"
                />
                <input
                  type="text"
                  value={formData.colorPrincipal}
                  onChange={(e) => setFormData((p) => ({ ...p, colorPrincipal: e.target.value }))}
                  className="h-10 px-3 rounded-lg border border-surface-container-high text-[13px] font-numeric-data flex-1"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block font-title-md text-[13px] text-primary" htmlFor="colorSecundario">
                Color Secundario (Fintech)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="colorSecundario"
                  type="color"
                  name="colorSecundario"
                  value={formData.colorSecundario}
                  onChange={handleChange}
                  className="h-10 w-14 rounded cursor-pointer border border-surface-container-high"
                />
                <input
                  type="text"
                  value={formData.colorSecundario}
                  onChange={(e) => setFormData((p) => ({ ...p, colorSecundario: e.target.value }))}
                  className="h-10 px-3 rounded-lg border border-surface-container-high text-[13px] font-numeric-data flex-1"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-surface-container-high flex justify-end">
            <Button
              type="submit"
              variant="fintech"
              loading={saving}
              loadingText="Guardando cambios..."
              iconName="save"
            >
              Guardar cambios
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
