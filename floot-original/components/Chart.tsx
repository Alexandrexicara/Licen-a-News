import * as React from "react";
import {
  Legend,
  ResponsiveContainer,
  Tooltip,
  type LegendPayload,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import styles from "./Chart.module.css";

/** Maps each data key to a display label and color (exposed as `--color-<key>`). */
export type ChartConfig = Record<string, { label?: React.ReactNode; color?: string }>;

const ChartContext = React.createContext<ChartConfig | null>(null);

function useChartConfig() {
  const config = React.useContext(ChartContext);
  if (!config) throw new Error("Chart components must be used inside <ChartContainer />");
  return config;
}

type ChartContainerProps = React.ComponentProps<"div"> & {
  config: ChartConfig;
  /** A single Recharts chart element, e.g. <LineChart>. */
  children: React.ReactElement;
};

export function ChartContainer({ config, className, style, children, ...props }: ChartContainerProps) {
  // Expose config colors as CSS variables so series can use `var(--color-<key>)`.
  const colorVars = Object.fromEntries(
    Object.entries(config)
      .filter(([, item]) => item.color)
      .map(([key, item]) => [`--color-${key}`, item.color])
  ) as React.CSSProperties;

  return (
    <ChartContext.Provider value={config}>
      <div className={`${styles.container} ${className ?? ""}`} style={{ ...colorVars, ...style }} {...props}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = Tooltip;
export const ChartLegend = Legend;

/** Resolve the config entry and color for a payload item by its dataKey (or name). */
function resolveItem(config: ChartConfig, item: { dataKey?: unknown; name?: unknown; color?: string }) {
  const key = String(item.dataKey ?? item.name ?? "value");
  const entry = config[key];
  return {
    key,
    label: entry?.label ?? (item.name as React.ReactNode) ?? key,
    color: entry?.color ? `var(--color-${key})` : item.color,
  };
}

type ChartTooltipContentProps = Partial<TooltipContentProps<ValueType, NameType>> & {
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: "dot" | "line" | "dashed";
  className?: string;
};

export function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  formatter,
  hideLabel = false,
  hideIndicator = false,
  indicator = "dot",
  className,
}: ChartTooltipContentProps) {
  const config = useChartConfig();
  if (!active || !payload?.length) return null;

  const title = labelFormatter
    ? labelFormatter(label, payload)
    : (label !== undefined && config[String(label)]?.label) || label;

  return (
    <div className={`${styles.tooltip} ${className ?? ""}`}>
      {!hideLabel && title !== undefined && title !== "" && (
        <div className={styles.tooltipLabel}>{title}</div>
      )}
      <div className={styles.tooltipItems}>
        {payload.map((item, index) => {
          if (item.value == null) return null;
          const { key, label: itemLabel, color } = resolveItem(config, item);
          return (
            <div key={key} className={styles.tooltipItem}>
              {formatter ? (
                formatter(item.value, item.name ?? key, item, index, payload)
              ) : (
                <>
                  {!hideIndicator && (
                    <span
                      className={`${styles.indicator} ${styles[`indicator-${indicator}`]}`}
                      style={{ "--indicator-color": color } as React.CSSProperties}
                    />
                  )}
                  <span className={styles.tooltipItemLabel}>{itemLabel}</span>
                  <span className={styles.tooltipItemValue}>
                    {typeof item.value === "number" ? item.value.toLocaleString() : String(item.value)}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ChartLegendContentProps = {
  payload?: ReadonlyArray<LegendPayload>;
  verticalAlign?: "top" | "middle" | "bottom";
  className?: string;
};

export function ChartLegendContent({ payload, verticalAlign = "bottom", className }: ChartLegendContentProps) {
  const config = useChartConfig();
  if (!payload?.length) return null;

  return (
    <div className={`${styles.legend} ${styles[`legend-${verticalAlign}`] ?? ""} ${className ?? ""}`}>
      {payload.map((item) => {
        const { key, label, color } = resolveItem(config, { ...item, name: item.value });
        return (
          <div key={key} className={styles.legendItem}>
            <span className={styles.legendItemIcon} style={{ backgroundColor: color }} />
            {label}
          </div>
        );
      })}
    </div>
  );
}
