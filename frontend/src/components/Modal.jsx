import React, { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Level 3 Backdrop: 40% blur on #0F172A40 */}
      <div
        className="fixed inset-0 bg-[#0d1c2f]/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog container */}
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
        <div
          className={`relative transform overflow-hidden rounded-xl bg-surface-container-lowest text-left shadow-[0_20px_25px_-5px_rgba(15,23,42,0.1),0_8px_10px_-6px_rgba(15,23,42,0.06)] transition-all w-full ${maxWidth} my-8 border border-surface-container-high`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-space-lg py-space-md border-b border-surface-container-high bg-surface-container-low/50">
            <h3 className="font-title-md text-[16px] text-primary">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
              aria-label="Cerrar modal"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Body */}
          <div className="p-space-lg max-h-[80vh] overflow-y-auto font-body-md text-on-surface">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = '¿Confirmar acción?',
  message = '¿Está seguro de realizar esta operación?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDestructive = false,
  loading = false,
}) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="flex flex-col gap-space-md">
        <p className="font-body-md text-on-surface-variant leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-2 pt-space-xs">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-title-md text-[13px] text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg font-title-md text-[13px] text-white transition-all shadow-sm ${
              isDestructive ? 'bg-error hover:bg-error/90' : 'bg-primary hover:bg-primary-container'
            }`}
          >
            {loading ? 'Procesando...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
