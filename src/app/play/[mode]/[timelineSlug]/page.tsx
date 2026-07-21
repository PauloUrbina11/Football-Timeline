import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlayTimelineClient } from "@/features/game-engine/components/board/play-timeline-client";
import { Container } from "@/components/ui/container";

interface TimelineRow {
  id: string;
  title: string;
}

export default async function PlayTimelinePage({
  params,
}: {
  params: Promise<{ mode: string; timelineSlug: string }>;
}) {
  const { mode, timelineSlug } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("timelines")
    .select("id, title")
    .eq("mode_id", mode)
    .eq("slug", timelineSlug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo cargar el timeline: ${error.message}`);
  }
  if (!data) {
    notFound();
  }

  const timeline = data as TimelineRow;

  return (
    <Container className="py-12">
      <h1 className="text-2xl font-bold tracking-tight">{timeline.title}</h1>
      <p className="mt-1 text-sm text-muted">Ordena las tarjetas cronológicamente y pulsa &quot;Comprobar&quot;.</p>
      <div className="mt-8">
        <PlayTimelineClient timelineId={timeline.id} timelineTitle={timeline.title} modeId={mode} />
      </div>
    </Container>
  );
}
