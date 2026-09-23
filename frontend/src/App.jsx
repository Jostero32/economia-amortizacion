import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { InstitutionProvider } from './context/InstitutionContext';
import AppRouter from './routes/AppRouter';

const BASE_PATH = import.meta.env.VITE_BASE_PATH || '/';

export default function App() {
  return (
    <BrowserRouter basename={BASE_PATH}>
      <InstitutionProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </InstitutionProvider>
    </BrowserRouter>
  );
}