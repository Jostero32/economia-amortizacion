import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { publicService, resolveApiAssetUrl } from '../services/api';

const defaultInstitution = {
  nombre: 'FinanEcuador Demo',
  tipo: 'BANCO_PRIVADO',
  ruc: '1790012345001',
  direccion: '',
  telefono: '',
  email: '',
  sitioWeb: '',
  logo: '/LogoFinanEcuador.png',
  colorPrincipal: '#001026',
  colorSecundario: '#0050cc',
};

const InstitutionContext = createContext(null);

function normalizeInstitution(institution = {}) {
  return {
    ...defaultInstitution,
    ...institution,
    nombre: institution.nombre || defaultInstitution.nombre,
    logo: institution.logo || defaultInstitution.logo,
    colorPrincipal: institution.colorPrincipal || defaultInstitution.colorPrincipal,
    colorSecundario: institution.colorSecundario || defaultInstitution.colorSecundario,
  };
}

function applyInstitutionTheme(institution) {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', institution.colorPrincipal || defaultInstitution.colorPrincipal);
  root.style.setProperty('--color-secondary', institution.colorSecundario || defaultInstitution.colorSecundario);
  document.title = `${institution.nombre || defaultInstitution.nombre} • Simulador Financiero`;
}

export function InstitutionProvider({ children }) {
  const [institution, setInstitutionState] = useState(defaultInstitution);
  const [loading, setLoading] = useState(true);

  const setInstitution = (nextInstitution) => {
    const merged = normalizeInstitution(nextInstitution);
    setInstitutionState(merged);
    applyInstitutionTheme(merged);
  };

  const reloadInstitution = async () => {
    try {
      const response = await publicService.getInstitution();
      if (response.success && response.data?.institution) {
        setInstitution(response.data.institution);
      }
    } catch (error) {
      console.error('No se pudo cargar la configuración institucional:', error);
      applyInstitutionTheme(defaultInstitution);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadInstitution();
  }, []);

  const value = useMemo(() => ({
    institution,
    logoUrl: resolveApiAssetUrl(institution.logo || defaultInstitution.logo),
    loading,
    setInstitution,
    reloadInstitution,
  }), [institution, loading]);

  return <InstitutionContext.Provider value={value}>{children}</InstitutionContext.Provider>;
}

export function useInstitution() {
  const context = useContext(InstitutionContext);
  if (!context) throw new Error('useInstitution debe utilizarse dentro de InstitutionProvider.');
  return context;
}
