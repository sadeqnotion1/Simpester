import type { CSSProperties } from "react";

type IconProps = {
  name: string;
  className?: string;
  filled?: boolean;
  style?: CSSProperties;
};

/**
 * Thin wrapper around Google Material Symbols (loaded via the font link in
 * index.html). Pass the symbol name, e.g. <Icon name="dashboard" />.
 */
export function Icon({
  name,
  className = "",
  filled = false,
  style,
}: IconProps) {
  const variation: CSSProperties = {
    fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
    ...style,
  };
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined select-none ${className}`}
      style={variation}
    >
      {name}
    </span>
  );
}
