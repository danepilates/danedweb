"use client";

import { useState } from "react";

export function PasswordInput({
  name,
  required,
  minLength,
}: {
  name: string;
  required?: boolean;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        name={name}
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        className="w-full rounded-lg border border-charcoal/20 px-3 py-2 pr-16 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-charcoal/50 hover:text-charcoal"
      >
        {visible ? "Ocultar" : "Ver"}
      </button>
    </div>
  );
}
