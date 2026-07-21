import Link from "next/link";
import { GAME_MODES } from "@/features/game-engine/domain/modes-registry";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <Container className="flex h-16 items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">⚽ Football Timeline</span>
          <Badge variant="outline">Fase 3 · en construcción</Badge>
        </Container>
      </header>

      <main className="flex-1">
        <section className="border-b border-border bg-gradient-to-b from-surface to-background py-16 sm:py-24">
          <Container className="flex flex-col items-center text-center">
            <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
              Ordena la historia del fútbol, un evento a la vez.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted">
              Cada partida dura menos de 2 minutos. Arrastra las tarjetas hasta dejarlas en el orden cronológico
              correcto y consigue tus 5 estrellas.
            </p>
            <div className="mt-8">
              <Link href="/daily">
                <Card className="inline-flex items-center gap-4 bg-surface-hover transition-colors hover:bg-surface">
                  <span className="text-2xl" aria-hidden="true">
                    🗓️
                  </span>
                  <div className="text-left">
                    <p className="font-semibold">Reto diario</p>
                    <p className="text-sm text-muted">Un timeline nuevo cada día, igual para todos.</p>
                  </div>
                  <Badge variant="default">Jugar</Badge>
                </Card>
              </Link>
            </div>
          </Container>
        </section>

        <section className="py-16">
          <Container>
            <h2 className="text-2xl font-semibold tracking-tight">Modos de juego</h2>
            <p className="mt-2 text-muted">Elige un modo para empezar.</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {GAME_MODES.map((mode) => (
                <Link key={mode.id} href={`/play/${mode.id}`}>
                  <Card className="flex h-full flex-col gap-3 transition-colors hover:bg-surface-hover">
                    <div className="flex items-center justify-between">
                      <span className="text-3xl" aria-hidden="true">
                        {mode.icon}
                      </span>
                      <Badge variant="default">Jugar</Badge>
                    </div>
                    <CardTitle>{mode.name}</CardTitle>
                    <CardDescription>{mode.shortDescription}</CardDescription>
                  </Card>
                </Link>
              ))}
            </div>
          </Container>
        </section>
      </main>

      <footer className="border-t border-border py-6">
        <Container className="text-center text-sm text-muted">Football Timeline — UrbinaTech.</Container>
      </footer>
    </div>
  );
}
