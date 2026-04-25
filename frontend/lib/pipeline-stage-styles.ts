import type { PipelineStage } from "@/lib/pipeline";

export const PIPELINE_STAGE_CHIP_CLASS: Record<PipelineStage, string> = {
  new: "border-chart-8/30 bg-chart-8/10 text-foreground",
  queued: "border-chart-8/35 bg-chart-8/[0.14] text-foreground",
  sent: "border-chart-1/30 bg-chart-1/12 text-foreground",
  opened: "border-chart-2/30 bg-chart-2/12 text-foreground",
  clicked: "border-chart-4/30 bg-chart-4/12 text-foreground",
  replied: "border-chart-3/30 bg-chart-3/12 text-foreground",
  bounced: "border-chart-6/30 bg-chart-6/12 text-foreground",
  unsubscribed: "border-chart-7/30 bg-chart-7/12 text-foreground",
};
