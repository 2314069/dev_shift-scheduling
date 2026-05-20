"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HelpTipProps {
  label: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  iconClassName?: string;
  srOnlyLabel?: string;
}

export function HelpTip({
  label,
  side = "top",
  className,
  iconClassName,
  srOnlyLabel,
}: HelpTipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={srOnlyLabel ?? "ヘルプ"}
            className={cn(
              "inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
          >
            <HelpCircle
              className={cn("h-3.5 w-3.5", iconClassName)}
              aria-hidden="true"
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
