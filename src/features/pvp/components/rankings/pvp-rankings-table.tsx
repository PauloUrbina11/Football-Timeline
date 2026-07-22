import { Card, CardTitle } from "@/components/ui/card";
import { RankBadge } from "@/features/pvp/components/match/rank-badge";

export interface PvpRankingRow {
  userId: string;
  displayName: string;
  rating: number;
}

export function PvpRankingsTable({ title, rows }: { title: string; rows: PvpRankingRow[] }) {
  return (
    <Card className="flex flex-col gap-4">
      <CardTitle>{title}</CardTitle>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Todavía no hay partidas oficiales registradas.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <li key={row.userId} className="flex items-center justify-between rounded-lg border border-border px-4 py-2">
              <span className="flex items-center gap-3">
                <span className="w-6 text-sm font-semibold text-muted">#{index + 1}</span>
                <span className="font-medium text-foreground">{row.displayName}</span>
              </span>
              <RankBadge rating={row.rating} />
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
