import type { Metadata } from "next";
import pkg from "../../../package.json";

export const metadata: Metadata = { title: "Strategy" };

// The Strategy module (poc/strategy, copied to public/strategy-module by scripts/sync-workbench.mjs).
// It keeps its work in this browser and hands principles, guardrails and the approved stack to the
// design workbench through the same origin's storage ("import strategy" in the canvas console).
export default function StrategyPage() {
  return (
    <iframe
      className="strategy-frame"
      src={`/strategy-module/index.html?embed&v=${pkg.version}`}
      title="NEXUS Strategy: the Chief Technology Architect's workbench"
      style={{ display: "block", width: "100%", height: "calc(100vh - 55px)", border: 0 }}
    />
  );
}
