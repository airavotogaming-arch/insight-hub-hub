import { createFileRoute } from "@tanstack/react-router";
import ShootingGallery from "@/components/ShootingGallery";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Toy Blitz Carnival — 3D Shooting Gallery Game" },
      {
        name: "description",
        content:
          "Play Toy Blitz Carnival, a 3D shooting gallery: aim a toy blaster, knock down plush toys, hit golden gifts for jackpots and win tickets.",
      },
      { property: "og:title", content: "Toy Blitz Carnival — 3D Shooting Gallery Game" },
      {
        property: "og:description",
        content:
          "First-person fairground blaster game with moving toy targets, combos, tickets and prize unlocks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main>
      <h1 className="sr-only">Toy Blitz Carnival — 3D Shooting Gallery Arcade Game</h1>
      <ShootingGallery />
    </main>
  );
}
