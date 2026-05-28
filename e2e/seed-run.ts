// CLI entry: seeds the e2e SQLite DB before `next build` runs (build-time
// page-data collection imports auth -> db and needs the file to exist).
import { seedE2eDatabase } from "./seed";

seedE2eDatabase()
  .then(() => {
    console.log("[e2e] database seeded");
  })
  .catch((err) => {
    console.error("[e2e] seed failed", err);
    process.exit(1);
  });
