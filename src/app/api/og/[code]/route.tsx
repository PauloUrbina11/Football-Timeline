import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

interface SharedResultRow {
  result_grid: string;
  points: number;
  stars: number;
}

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("shared_results_public")
    .select("result_grid, points, stars")
    .eq("share_code", code)
    .maybeSingle();

  const result = data as SharedResultRow | null;
  const grid = result?.result_grid ?? "⬜⬜⬜⬜⬜⬜";
  const points = result?.points ?? 0;
  const stars = result?.stars ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a120e",
          color: "#f2f7f4",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 24 }}>⚽ Football Timeline</div>
        <div style={{ fontSize: 72, letterSpacing: 12 }}>{grid}</div>
        <div style={{ fontSize: 48, marginTop: 24, color: "#f5c451" }}>{"⭐".repeat(stars)}</div>
        <div style={{ fontSize: 30, marginTop: 12, color: "#8fa69d" }}>{`${points} puntos`}</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
