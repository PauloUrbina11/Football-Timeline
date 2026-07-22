import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { getPvpMatchState } from "@/features/pvp/actions/get-match-state";
import { PvpMatchClient } from "@/features/pvp/components/match/pvp-match-client";

export default async function PvpMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;

  let initialState;
  try {
    initialState = await getPvpMatchState(matchId);
  } catch {
    notFound();
  }

  return (
    <Container className="py-12">
      <PvpMatchClient matchId={matchId} initialState={initialState} />
    </Container>
  );
}
