import type { PropsWithChildren } from "react";
import { useEffect } from "react";

export type AnalyticsProps = PropsWithChildren<Record<string, unknown>>;

export const Analytics = (_props: AnalyticsProps) => {
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.info("@vercel/analytics/react not installed – using no-op shim.");
    }
  }, []);

  return null;
};

export default Analytics;

