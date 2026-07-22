import { Badge } from "@/components/ui/badge";
import { ProgressDots } from "./progress-dots";
import { RankBadge } from "./rank-badge";
import type { PvpMatchPlayerState, PvpMatchState } from "@/features/pvp/domain/types";

function PlayerBadge({ player, align = "left" }: { player: PvpMatchPlayerState; align?: "left" | "right" }) {
  return (
    <div className={`flex flex-1 flex-col gap-1 ${align === "right" ? "items-end text-right" : "items-start text-left"}`}>
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${player.isConnected ? "bg-primary" : "bg-danger"}`}
          aria-hidden="true"
          title={player.isConnected ? "Conectado" : "Desconectado"}
        />
        <span className="font-semibold text-foreground">
          {player.displayName}
          {player.isMe && " (tú)"}
        </span>
      </div>
      {player.ratingBefore !== null && <RankBadge rating={player.ratingAfter ?? player.ratingBefore} />}
      <span className="text-sm text-muted">{player.totalPoints} pts</span>
    </div>
  );
}

export function PlayerVsPlayerHeader({ state }: { state: PvpMatchState }) {
  const players = [...state.players].sort((a, b) => a.seat - b.seat);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Badge variant={state.isOfficial ? "accent" : "outline"}>{state.isOfficial ? "Oficial" : "Amistosa"}</Badge>
        <ProgressDots total={state.totalGames} currentIndex={state.currentGameIndex} />
      </div>
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4">
        {players[0] && <PlayerBadge player={players[0]} />}
        <span className="text-lg font-bold text-muted">VS</span>
        {players[1] && <PlayerBadge player={players[1]} align="right" />}
      </div>
    </div>
  );
}
