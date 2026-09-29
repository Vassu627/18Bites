import { refreshRecommendationCache } from "../services/recommendationService";
import { logger } from "../lib/logger";

async function main() {
  const count = await refreshRecommendationCache();
  logger.info({ count }, "Recommendation cache refreshed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
