"use client";

import { useRef, useState } from "react";

export function ConfirmSubmitButton({
  confirmMessage,
  className,
  children,
}: {
  confirmMessage: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={className}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-5 text-sm text-charcoal">{confirmMessage}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-10 rounded-full border border-charcoal/20 px-4 text-sm text-charcoal hover:bg-charcoal/5"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  buttonRef.current?.form?.requestSubmit();
                }}
                className="min-h-10 rounded-full bg-charcoal px-4 text-sm text-white hover:bg-gold hover:text-charcoal"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
