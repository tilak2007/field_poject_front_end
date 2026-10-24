// Minimal placeholder server so the preview stays healthy.
// This project is backend-only; the FieldAssist frontend lives elsewhere.
Bun.serve({
  port: Number(process.env.PORT ?? 8080),
  hostname: "0.0.0.0",
  fetch() {
    return new Response("FieldAssist backend — no frontend in this project.", {
      headers: { "content-type": "text/plain" },
    });
  },
});
