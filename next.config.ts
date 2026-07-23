import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js bloquea por defecto las peticiones al servidor de dev que no vengan de `localhost`
  // (protección contra acceso no autorizado). Se permite también la IP de red local, útil para
  // probar drag & drop táctil desde un móvil real en la misma red durante desarrollo.
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.56.1"],
  // El indicador de ruta de Next.js (el círculo "N", solo en `next dev`, nunca en producción) se
  // renderiza fijo en bottom-left por defecto — justo donde este proyecto suele tener grillas de
  // tarjetas que crecen hacia abajo (ej. "Por colocar" en los modos "match"). En pantallas
  // angostas terminaba tapando la última tarjeta e interceptando el clic/drag ahí — reproducido
  // con Playwright contra Career Timeline (Cristiano Ronaldo) en el viewport de Pixel 7. Es
  // puramente informativo (estático/dinámico de la ruta), así que se desactiva en vez de solo
  // reposicionarlo: cualquier esquina puede volver a coincidir con contenido real según el layout.
  devIndicators: false,
};

export default nextConfig;
