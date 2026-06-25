export interface ThemeVars {
  // Background layers
  bgBase: string;        // outermost container
  bgSurface: string;     // toolbar, panels, status bar
  bgElevated: string;    // hover states, dropdowns, popover inputs
  bgCanvas: string;      // the Konva stage area

  // Borders
  border: string;        // panel borders, dividers
  borderSubtle: string;  // subtle separators inside panels

  // Text
  textPrimary: string;   // main content text
  textSecondary: string; // labels, hints, secondary info
  textMuted: string;     // disabled, placeholders

  // Brand/interaction colors
  accent: string;        // active tool highlight, selection rings, in-progress drawing
  accentHover: string;   // accent on hover
  danger: string;        // delete buttons and destructive actions
  success: string;       // polygon close-vertex indicator

  // Annotation-specific
  handleFill: string;    // resize/vertex handle fill color
  selection: string;     // selection row overlay in the label panel (should be semi-transparent)

  // Layout dimensions (px)
  toolbarWidth: number;
  panelWidth: number;
  statusBarHeight: number;
}

export const DEFAULT_THEME: ThemeVars = {
  bgBase: "#141414",
  bgSurface: "#1e1e1e",
  bgElevated: "#2a2a2a",
  bgCanvas: "#0f0f0f",
  border: "#333333",
  borderSubtle: "#2a2a2a",
  textPrimary: "#e8e8e8",
  textSecondary: "#8a8a8a",
  textMuted: "#555555",
  accent: "#2563eb",
  accentHover: "#1d4ed8",
  danger: "#ef4444",
  success: "#22c55e",
  handleFill: "#ffffff",
  selection: "rgba(37,99,235,0.15)",
  toolbarWidth: 48,
  panelWidth: 260,
  statusBarHeight: 28,
};

export function resolveTheme(overrides?: Partial<ThemeVars>): ThemeVars {
  return { ...DEFAULT_THEME, ...overrides };
}

// Returns a style-compatible map of CSS custom properties.
// Cast to React.CSSProperties at the call site.
export function themeToCssVars(t: ThemeVars): Record<string, string | number> {
  return {
    "--ae-bg-base": t.bgBase,
    "--ae-bg-surface": t.bgSurface,
    "--ae-bg-elevated": t.bgElevated,
    "--ae-bg-canvas": t.bgCanvas,
    "--ae-border": t.border,
    "--ae-border-subtle": t.borderSubtle,
    "--ae-text-primary": t.textPrimary,
    "--ae-text-secondary": t.textSecondary,
    "--ae-text-muted": t.textMuted,
    "--ae-accent": t.accent,
    "--ae-accent-hover": t.accentHover,
    "--ae-danger": t.danger,
    "--ae-success": t.success,
    "--ae-handle-fill": t.handleFill,
    "--ae-selection": t.selection,
  };
}
