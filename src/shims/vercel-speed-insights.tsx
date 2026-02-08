import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { logger } from "../utils/logger";

export type SpeedInsightsProps = PropsWithChildren<Record<string, unknown>>;

export const SpeedInsights = (_props: SpeedInsightsProps) => {
  useEffect(() => {
    if (import.meta.env.DEV) {
      logger.info("@vercel/speed-insights/react not installed – using no-op shim.");
    }
  }, []);

  return null;
};

export default SpeedInsights;
