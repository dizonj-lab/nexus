// Simulated OpenAI-compatible model server for testing NEXUS without a real model.
// Usage: node poc/tests/mock-llm.mjs [port]   (default 18080). Answers are labelled "simulated".
// The model name picks the behaviour:
//   sim-stream     streams a second opinion token by token (about 4 s), then stops
//   sim-runaway    streams the answer, then keeps sending whitespace forever (a known local-model failure in JSON mode)
//   sim-hang       accepts the request and never answers (tests the time limit and Stop)
//   sim-plain      answers without streaming
import http from "node:http";
const port = +process.argv[2] || 18080;
const answer = JSON.stringify({
  opinion: "agree with conditions",
  summary: "Simulated review: the design is sound; add a read replica before launch.",
  rationale: "Simulated. Uses only the facts given.",
  confidence: "medium",
  alternative: { title: "Add a read replica (simulated)", ops: [{ op: "update_node", id: "DB1", set: { readReplicas: 1 } }] },
  pros: [{ text: "Multi-zone database standby", pillar: "reliability" }],
  cons: [{ text: "One more replica to pay for", pillar: "cost" }],
});
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
http.createServer((req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  if (req.url.endsWith("/models")) { res.writeHead(200, { ...cors, "Content-Type": "application/json" }); return res.end(JSON.stringify({ data: ["sim-stream", "sim-runaway", "sim-hang", "sim-plain"].map(id => ({ id })) })); }
  let body = ""; req.on("data", c => body += c); req.on("end", () => {
    let j = {}; try { j = JSON.parse(body); } catch {}
    const model = j.model || "sim-stream";
    console.log(new Date().toISOString(), model, "stream=" + !!j.stream, "max_tokens=" + j.max_tokens, "prompt bytes=" + body.length);
    if (model === "sim-hang") return; // never answers
    if (model === "sim-plain" || !j.stream) { res.writeHead(200, { ...cors, "Content-Type": "application/json" }); return res.end(JSON.stringify({ choices: [{ message: { content: answer } }] })); }
    res.writeHead(200, { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    const toks = answer.match(/.{1,6}/g); let i = 0, closed = false; res.on("close", () => closed = true);
    const send = t => res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`);
    const tick = setInterval(() => {
      if (closed) return clearInterval(tick);
      if (i < toks.length) { send(toks[i++]); return; }
      if (model === "sim-runaway") { send("\n "); return; }
      clearInterval(tick); res.write("data: [DONE]\n\n"); res.end();
    }, 4000 / toks.length);
  });
}).listen(port, () => console.log(`simulated model server on :${port}`));
