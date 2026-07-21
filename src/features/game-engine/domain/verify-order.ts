export interface VerifyOrderResult {
  correctPositions: boolean[];
  correctCount: number;
  isFullyCorrect: boolean;
}

/**
 * Compara el orden enviado contra el orden correcto y devuelve, posición por posición,
 * si es correcta o no — nunca el orden correcto en sí. Esta función se ejecuta exclusivamente
 * en el servidor (dentro del RPC `submit_attempt`); el cliente nunca debe tener acceso a `correctOrder`.
 */
export function verifyOrder(submittedOrder: readonly string[], correctOrder: readonly string[]): VerifyOrderResult {
  if (submittedOrder.length !== correctOrder.length) {
    throw new Error("El orden enviado no tiene la misma cantidad de eventos que el orden correcto.");
  }

  const correctPositions = submittedOrder.map((eventId, index) => eventId === correctOrder[index]);
  const correctCount = correctPositions.filter(Boolean).length;

  return {
    correctPositions,
    correctCount,
    isFullyCorrect: correctCount === correctOrder.length,
  };
}
