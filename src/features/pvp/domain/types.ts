/** Espejo de lo que devuelve `get_pvp_match_state` (jsonb) — ver supabase/migrations/0021. */

export interface PvpGameResult {
  points: number;
  stars: number | null;
  timeMs: number;
}

export type PvpMatchGameStatus = "pending" | "active" | "completed";

export interface PvpMatchGameState {
  id: string;
  gameIndex: number;
  modeId: string;
  timelineId: string;
  status: PvpMatchGameStatus;
  startedAt: string | null;
  endsAt: string | null;
  myResult: PvpGameResult | null;
  opponentResult: PvpGameResult | null;
}

export interface PvpMatchPlayerState {
  matchPlayerId: string;
  seat: 1 | 2;
  isMe: boolean;
  displayName: string;
  isGuest: boolean;
  ratingBefore: number | null;
  ratingAfter: number | null;
  ratingDelta: number | null;
  totalPoints: number;
  isConnected: boolean;
  leftAt: string | null;
}

export type PvpMatchStatus = "countdown" | "in_progress" | "completed" | "cancelled" | "abandoned";

export interface PvpMatchState {
  id: string;
  status: PvpMatchStatus;
  isOfficial: boolean;
  currentGameIndex: number;
  totalGames: number;
  timeLimitSeconds: number;
  winnerMatchPlayerId: string | null;
  mySeat: 1 | 2 | null;
  players: PvpMatchPlayerState[];
  games: PvpMatchGameState[];
}
