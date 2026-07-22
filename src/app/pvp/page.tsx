import { Container } from "@/components/ui/container";
import { PvpLobbyClient } from "@/features/pvp/components/lobby/pvp-lobby-client";

export default function PvpLobbyPage() {
  return (
    <Container className="flex flex-1 items-center justify-center py-12">
      <PvpLobbyClient />
    </Container>
  );
}
