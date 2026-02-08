import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { logger } from "../utils/logger";

export type AnalyticsProps = PropsWithChildren<Record<string, unknown>>;

export const Analytics = (_props: AnalyticsProps) => {
  useEffect(() => {
    if (import.meta.env.DEV) {
      logger.info("@vercel/analytics/react not installed – using no-op shim.");
    }
  }, []);

  return null;
};

export default Analytics;
