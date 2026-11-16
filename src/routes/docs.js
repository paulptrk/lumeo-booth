import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";

// serves the published contract. the yaml file is the source of truth,
// nothing about the api is described twice
const specPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "openapi.yaml");
const specText = fs.readFileSync(specPath, "utf8");
const spec = YAML.parse(specText);

const router = Router();

router.get("/openapi.yaml", (req, res) => {
  res.type("application/yaml").send(specText);
});

router.use("/docs", swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: "Lumeo Booth API" }));

export default router;
