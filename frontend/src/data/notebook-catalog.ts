import type { NotebookCatalogEntry } from "@/lib/notebook-types";

export const NOTEBOOK_CATALOG: NotebookCatalogEntry[] = [
  {
    id: "bb84",
    title: "BB84 Quantum Key Distribution",
    filename: "bb84.ipynb",
    subtitle: "Detect eavesdroppers using quantum mechanics.",
    description:
      "Learn how quantum states can be used to exchange secret keys and why measuring a quantum message leaves detectable traces. Explore ideal transmission, interception attacks, and the resulting error rates.",
    tags: ["Cryptography", "Key Exchange", "Eavesdropping"],
  },
  {
    id: "chsh",
    title: "CHSH Bell Game",
    filename: "chsh.ipynb",
    subtitle: "See quantum correlations beat classical limits.",
    description:
      "Compare classical and entangled strategies in the CHSH game and observe how quantum systems achieve stronger correlations than classical physics allows. Visualize where the quantum advantage comes from.",
    tags: ["Entanglement", "Bell Test", "Quantum Advantage"],
  },
  {
    id: "grover",
    title: "Grover Search: Graph Coloring",
    filename: "grover.ipynb",
    subtitle: "Speed up search with amplitude amplification.",
    description:
      "Use Grover's algorithm to search for valid graph colorings and watch marked solutions become increasingly likely to appear. Explore how quantum search reduces the work needed for constraint-satisfaction problems.",
    tags: ["Graph Coloring", "Quantum Search", "Amplification"],
  },
];
