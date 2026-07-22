import Link from "next/link";
import { Container } from "@/components/ui/container";
import { getPvpWorldLeaderboard, getPvpHistoricalLeaderboard } from "@/features/pvp/actions/get-leaderboards";
import { PvpRankingsTable } from "@/features/pvp/components/rankings/pvp-rankings-table";

export default async function PvpRankingsPage() {
  const [world, historical] = await Promise.all([getPvpWorldLeaderboard(20), getPvpHistoricalLeaderboard(undefined, 20)]);

  return (
    <Container className="flex flex-col gap-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Rankings PvP</h1>
        <Link href="/pvp" className="text-sm text-primary hover:underline">
          Volver al lobby
        </Link>
      </div>
      <p className="text-sm text-muted">
        Solo cuentan las partidas Oficiales (ambos jugadores registrados). El ranking por país y el semanal/mensual
        llegan en un próximo checkpoint.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <PvpRankingsTable
          title="Mundial"
          rows={world.map((row) => ({ userId: row.userId, displayName: row.displayName, rating: row.currentRating }))}
        />
        <PvpRankingsTable title="Histórico (temporada vigente)" rows={historical} />
      </div>
    </Container>
  );
}
