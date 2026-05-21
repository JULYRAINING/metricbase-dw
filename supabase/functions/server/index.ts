import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.ts";
import dimensions from "./dimensions.ts";
import factTables from "./fact-tables.ts";
import metrics from "./metrics.ts";
import categories from "./categories.ts";
import properties from "./properties.ts";
import analysis from "./analysis.ts";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-7b7e4046/health", (c) => {
  return c.json({ status: "ok" });
});

// 维度管理API
app.route("/dimensions", dimensions);

// 事实表管理API
app.route("/fact-tables", factTables);

// 指标管理API
app.route("/metrics", metrics);

// 分类管理API
app.route("/categories", categories);

// 字段定义API
app.route("/properties", properties);

// 多维分析API
app.route("/analysis", analysis);

Deno.serve(app.fetch);