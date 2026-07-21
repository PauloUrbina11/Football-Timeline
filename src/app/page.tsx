"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { GAME_MODES } from "@/features/game-engine/domain/modes-registry";
import { ACCENT_CLASSES } from "@/features/game-engine/domain/accent-classes";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

const cardsContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const cardItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

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
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl"
            >
              Ordena la historia del fútbol, un evento a la vez.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mt-4 max-w-xl text-lg text-muted"
            >
              Cada partida dura menos de 2 minutos. Arrastra las tarjetas hasta dejarlas en el orden cronológico
              correcto y consigue tus 5 estrellas.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="mt-8"
            >
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
            </motion.div>
          </Container>
        </section>

        <section className="py-16">
          <Container>
            <h2 className="text-2xl font-semibold tracking-tight">Modos de juego</h2>
            <p className="mt-2 text-muted">Elige un modo para empezar.</p>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={cardsContainer}
              className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {GAME_MODES.map((mode) => {
                const accentClasses = ACCENT_CLASSES[mode.accent];
                return (
                  <motion.div key={mode.id} variants={cardItem}>
                    <Link href={`/play/${mode.id}`}>
                      <Card className="flex h-full flex-col gap-3 transition-colors hover:bg-surface-hover">
                        <div className="flex items-center justify-between">
                          <span
                            className={`flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-2xl ${accentClasses.text}`}
                            aria-hidden="true"
                          >
                            {mode.icon}
                          </span>
                          <Badge variant="default">Jugar</Badge>
                        </div>
                        <CardTitle>{mode.name}</CardTitle>
                        <CardDescription>{mode.shortDescription}</CardDescription>
                      </Card>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          </Container>
        </section>
      </main>

      <footer className="border-t border-border py-6">
        <Container className="text-center text-sm text-muted">Football Timeline — UrbinaTech.</Container>
      </footer>
    </div>
  );
}
