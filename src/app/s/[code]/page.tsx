import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env";
import { Card, CardTitle } from "@/components/ui/card";
import { StarRating } from "@/components/ui/star-rating";
import { Container } from "@/components/ui/container";
import { ShareGrid } from "@/features/daily-challenge/components/share-grid";
import { formatElapsed } from "@/features/game-engine/domain/format-elapsed";
import type { Stars } from "@/features/game-engine/domain/scoring";

interface SharedResultRow {
  share_code: string;
  result_grid: string;
  points: number;
  stars: Stars;
  time_ms: number;
  attempts: number;
}

type PageParams = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { code } = await params;
  const siteUrl = getPublicEnv().NEXT_PUBLIC_SITE_URL;
  return {
    title: "Resultado del reto diario — Football Timeline",
    description: "Un resultado del reto diario de Football Timeline. Sin espóilers.",
    openGraph: {
      images: [`${siteUrl}/api/og/${code}`],
    },
  };
}

/** Página pública: solo lee de `shared_results_public` (sin user_id/anon_id, sin contenido real del timeline). */
export default async function SharedResultPage({ params }: PageParams) {
  const { code } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("shared_results_public")
    .select("share_code, result_grid, points, stars, time_ms, attempts")
    .eq("share_code", code)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo cargar el resultado: ${error.message}`);
  }
  if (!data) {
    notFound();
  }

  const result = data as SharedResultRow;

  return (
    <Container className="flex flex-1 flex-col items-center justify-center py-16">
      <Card className="flex flex-col items-center gap-4 py-10 text-center">
        <CardTitle>⚽ Football Timeline — Reto diario</CardTitle>
        <StarRating stars={result.stars} className="text-2xl" />
        <p className="text-muted">{result.points} puntos</p>
        <ShareGrid grid={result.result_grid} />
        <dl className="mt-2 grid grid-cols-2 gap-8 text-sm text-muted">
          <div>
            <dt>Tiempo</dt>
            <dd className="text-base font-medium text-foreground">{formatElapsed(result.time_ms)}</dd>
          </div>
          <div>
            <dt>Intentos</dt>
            <dd className="text-base font-medium text-foreground">{result.attempts}</dd>
          </div>
        </dl>
      </Card>
    </Container>
  );
}
