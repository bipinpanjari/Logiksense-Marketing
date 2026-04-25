import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const calloutVariants = cva("rounded-lg border px-3 py-3 text-sm leading-relaxed", {
  variants: {
    variant: {
      success: "border-positive-border bg-positive-bg text-positive-fg",
      warning: "border-caution-border bg-caution-bg text-caution-fg",
      info: "border-info-border bg-info-bg text-info-fg",
      destructive: "border-destructive/35 bg-destructive/10 text-destructive",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

export interface CalloutProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof calloutVariants> {}

export function Callout({ className, variant, ...props }: CalloutProps) {
  return <div role="status" className={cn(calloutVariants({ variant }), className)} {...props} />;
}
