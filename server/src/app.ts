import express from "express";
import serverless from "serverless-http";
export const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.get("/api/health", (_req, res) =>
  res.json({
    status: "ok",
    service: "optional-express-scaffold",
    dataProvider: "supabase",
  }),
);
// Live operations use Supabase Auth/Data/Storage APIs with RLS.
// This optional Express scaffold is not used for those operations.
app.use("/api", (_req, res) =>
  res.status(501).json({
    error: {
      code: "INTEGRATION_PENDING",
      message:
        "This Express endpoint is not implemented. CivilHub uses authenticated Supabase APIs for live operations.",
    },
  }),
);
export const handler = serverless(app);
