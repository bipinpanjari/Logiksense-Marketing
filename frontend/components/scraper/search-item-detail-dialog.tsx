"use client";

import { Dialog } from "@/components/ui/dialog";
import { BusinessIntelBody } from "@/components/research/business-intel-body";
import { researchModelFromSearchItem } from "@/lib/business-research-model";
import type { SearchItem } from "@/lib/scraper";

export function SearchItemDetailDialog({
  item,
  open,
  onOpenChange,
}: {
  item: SearchItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!item) return null;

  const model = researchModelFromSearchItem(item);
  const profileCollectedAt = model.profile?.collectedAt;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={item.business_name || "Business"}
      description={[item.category, [item.city, item.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || undefined}
      maxWidthClassName="w-full max-w-[min(1200px,calc(100vw-2rem))]"
    >
      <BusinessIntelBody model={model} profileCollectedAt={profileCollectedAt} />
    </Dialog>
  );
}
