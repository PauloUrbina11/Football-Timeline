import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js bloquea por defecto las peticiones al servidor de dev que no vengan de `localhost`
  // (protección contra acceso no autorizado). Se permite también la IP de red local, útil para
  // probar drag & drop táctil desde un móvil real en la misma red durante desarrollo.
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.56.1"],
};

export default nextConfig;
