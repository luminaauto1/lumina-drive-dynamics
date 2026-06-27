import * as React from "react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  /** Uppercase micro-label (e.g. "Net Profit"). */
  label: React.ReactNode;
  /** Primary value — rendered in a mono, tabular-nums face. */
  value: React.ReactNode;
  /** Optional delta line, e.g. { value: "+12%", dir: "up" }. */
  delta?: { value: string; dir: "up" | "down" };
  /** Optional leading icon (e.g. a lucide icon element). */
  icon?: React.ReactNode;
  /** Optional muted hint line under the value. */
  hint?: React.ReactNode;
  /** Optional extra classes for the wrapper (e.g. to tint the value colour). */
  className?: string;
  /** Optional click handler — when set the tile becomes a button. */
  onClick?: () => void;
}

/**
 * Compact KPI tile for admin dashboards.
 *
 * `text-[11px]` uppercase muted label, `text-lg/xl` font-mono tabular-nums value,
 * optional delta + hint lines. `p-3 rounded-md` card surface.
 */
const StatTile = ({ label, value, delta, icon, hint, className, onClick }: StatTileProps) => {
  const Wrapper: React.ElementType = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "rounded-md border bg-card p-3 text-left text-card-foreground",
        onClick && "transition-colors hover:bg-secondary/40",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon && <span className="shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>}
        <span className="truncate text-[11px] font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="mt-1 font-mono text-lg font-semibold leading-none tabular-nums sm:text-xl">
        {value}
      </p>
      {delta && (
        <p
          className={cn(
            "mt-1 text-[11px] tabular-nums",
            delta.dir === "up" ? "text-emerald-400" : "text-red-400",
          )}
        >
          {delta.dir === "up" ? "▲" : "▼"} {delta.value}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Wrapper>
  );
};

export default StatTile;
