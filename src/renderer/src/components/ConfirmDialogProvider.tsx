import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmDialogContext = createContext<ConfirmFn | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function settle(value: boolean): void {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      {options && (
        <div className="dialog-overlay" onClick={() => settle(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
            <div className="dialog__icon">
              <AlertTriangle size={20} />
            </div>
            <h3 className="dialog__title">{options.title}</h3>
            <p className="dialog__message">{options.message}</p>
            <div className="dialog__actions">
              <button type="button" className="btn" onClick={() => settle(false)}>
                {options.cancelLabel ?? 'Cancelar'}
              </button>
              <button type="button" className="btn btn--danger" onClick={() => settle(true)}>
                {options.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog(): ConfirmFn {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) throw new Error('useConfirmDialog must be used inside a ConfirmDialogProvider');
  return ctx;
}
