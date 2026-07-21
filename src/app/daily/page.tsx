import { DailyChallengeClient } from "@/features/daily-challenge/components/daily-challenge-client";
import { Container } from "@/components/ui/container";

export default function DailyChallengePage() {
  return (
    <Container className="py-12">
      <h1 className="text-2xl font-bold tracking-tight">Reto diario</h1>
      <p className="mt-1 text-sm text-muted">
        El mismo timeline para todos hoy. Ordena las tarjetas y comparte tu resultado sin espóilers.
      </p>
      <div className="mt-8">
        <DailyChallengeClient />
      </div>
    </Container>
  );
}
