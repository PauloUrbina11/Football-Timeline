import { Badge } from "@/components/ui/badge";
import { getRankForRating } from "@/features/pvp/domain/ranks";

export function RankBadge({ rating }: { rating: number }) {
  const rank = getRankForRating(rating);
  return (
    <Badge variant="accent" className="gap-1">
      <span aria-hidden="true">{rank.icon}</span>
      {rank.label} · {rating}
    </Badge>
  );
}
