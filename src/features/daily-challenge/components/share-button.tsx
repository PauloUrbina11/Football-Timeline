"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface ShareButtonProps {
  text: string;
}

export function ShareButton({ text }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Portapapeles no disponible (permiso denegado, contexto no seguro, etc.): no rompe la UI.
    }
  }

  return (
    <Button variant="primary" onClick={handleClick}>
      {copied ? "¡Copiado! ✓" : "Compartir resultado"}
    </Button>
  );
}
