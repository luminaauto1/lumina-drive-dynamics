import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Main heading text. */
  title: React.ReactNode;
  /** Optional muted subtitle / context line under the title. */
  subtitle?: React.ReactNode;
  /** Optional leading icon (e.g. a lucide icon element). */
  icon?: React.ReactNode;
  /** Right-aligned actions slot (buttons, etc.). */
  actions?: React.ReactNode;
  /** Optional extra classes for the wrapper. */
  className?: string;
}

/**
 * Compact, reusable admin page header.
 *
 * Sticky-ish bar (~h-12/14): a small leading icon, a `text-lg/xl` semibold title
 * with an optional `text-xs` muted subtitle, and a right-aligned actions slot.
 * No heading glow (admin density theme handles the rest).
 */
const PageHeader = ({ title, subtitle, icon, actions, className }: PageHeaderProps) => (
  <div
    className={cn(
      "flex flex-col gap-3 border-b border-border/60 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
      className,
    )}
  >
    <div className="flex min-w-0 items-center gap-2.5">
      {icon && (
        <span className="flex shrink-0 items-center text-muted-foreground [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold leading-tight sm:text-xl">{title}</h1>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
    {actions && (
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
    )}
  </div>
);

export default PageHeader;
