import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

// fail at startup, not at the first login, if the auth settings are missing
loadConfig();

const port = process.env.PORT || 3000;

createApp().listen(port, () => {
  console.log(`lumeo-booth running on http://localhost:${port}`);
});
