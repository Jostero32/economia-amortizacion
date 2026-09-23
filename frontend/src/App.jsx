import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { InstitutionProvider } from './context/InstitutionContext';
import AppRouter from './routes/AppRouter';

export default function App() {
  return (
    <BrowserRouter>
      <InstitutionProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </InstitutionProvider>
    </BrowserRouter>
  );
}
