import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getGameMode } from "@/features/game-engine/domain/modes-registry";
import { getDifficulty, type DifficultyId } from "@/features/game-engine/domain/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

interface TimelineListRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  difficulty: DifficultyId;
}

export default async function PlayModePage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  const modeDefinition = getGameMode(mode);
  if (!modeDefinition) {
    notFound();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("timelines")
    .select("id, slug, title, description, difficulty")
    .eq("mode_id", mode)
    .eq("status", "published")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`No se pudieron cargar los timelines: ${error.message}`);
  }

  const timelines = (data ?? []) as TimelineListRow[];

  return (
    <Container className="py-12">
      <p className="text-sm text-muted">
        {modeDefinition.icon} {modeDefinition.name}
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">{modeDefinition.shortDescription}</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {timelines.map((timeline) => (
          <Link key={timeline.id} href={`/play/${mode}/${timeline.slug}`}>
            <Card className="h-full transition-colors hover:bg-surface-hover">
              <CardTitle>{timeline.title}</CardTitle>
              {timeline.description && <CardDescription>{timeline.description}</CardDescription>}
              <Badge variant="outline" className="mt-3">
                {getDifficulty(timeline.difficulty).label}
              </Badge>
            </Card>
          </Link>
        ))}
        {timelines.length === 0 && <p className="text-muted">Todavía no hay timelines publicados para este modo.</p>}
      </div>
    </Container>
  );
}
