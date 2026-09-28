import React, { useEffect, useState } from 'react';
import { identityService } from '../../services/api';

/** Imagen de una verificación de identidad, pedida con la sesión (no es un archivo público). */
export default function AuthImage({ verificationId, tipo, alt, className = '' }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = null;
    setUrl(null);
    setFailed(false);
    identityService.getFileBlob(verificationId, tipo)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [verificationId, tipo]);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 text-[12px] text-gray-400 ${className}`}>
        Imagen no disponible
      </div>
    );
  }
  if (!url) return <div className={`bg-gray-100 animate-pulse ${className}`} />;
  return <img src={url} alt={alt} className={`object-contain bg-gray-50 ${className}`} />;
}
