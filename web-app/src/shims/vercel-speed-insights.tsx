import type { PropsWithChildren } from "react";
import { useEffect } from "react";

export type SpeedInsightsProps = PropsWithChildren<Record<string, unknown>>;

export const SpeedInsights = (_props: SpeedInsightsProps) => {
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.info("@vercel/speed-insights/react not installed – using no-op shim.");
    }
  }, []);

  return null;
};

export default SpeedInsights;

