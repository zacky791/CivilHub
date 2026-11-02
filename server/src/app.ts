import express from "express";
import serverless from "serverless-http";
export const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", mode: "demo", databaseConnected: false }),
);
// Deliberately fail closed until Supabase JWT verification and a real service are connected.
// The demo client uses client/src/services/repository.ts and never calls these routes.
app.use("/api", (_req, res) =>
  res
    .status(501)
    .json({
      error: {
        code: "INTEGRATION_PENDING",
        message: "The backend is not connected. Use the browser-local demo.",
      },
    }),
);
export const handler = serverless(app);
