import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";

// serves the published contract. the yaml file is the source of truth,
// nothing about the api is described twice. the tests import `spec` from here
const specText = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "openapi.yaml"), "utf8");
export const spec = YAML.parse(specText);

const router = Router();

router.get("/openapi.yaml", (req, res) => {
  res.type("application/yaml").send(specText);
});

router.use("/docs", swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: "Lumeo Booth API" }));

export default router;
