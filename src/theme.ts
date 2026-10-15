import { createTheme } from "@mui/material/styles";

// Light-blue accent ramp (primary). Cool signal blue, WCAG AA against the
// charcoal ramp below.
const blue = {
  50: "#EBF4FC",
  100: "#CDE6F8",
  200: "#A6D3F2",
  300: "#7FBDEB",
  400: "#5AA7E0",
  500: "#3E8FD0",
  600: "#2E74B4",
  700: "#245C93",
  800: "#1D4A76",
  900: "#173C5F",
};

// Charcoal neutrals: dark grey with a faint cool cast, no pure black.
const grey = {
  50: "#E8EAED",
  100: "#CDD1D7",
  200: "#B0B6BF",
  300: "#8E96A1",
  400: "#6E7682",
  500: "#535B66",
  600: "#3E454F",
  700: "#2F353E",
  800: "#23282F",
  900: "#171B20",
};

// Charcoal surface ramp, near-black, layered greys not ink-blue.
const charcoal = {
  base: "#14171B",
  low: "#191D22",
  mid: "#1F242A",
  high: "#262C33",
  line: "#343B44",
};

// Ember amber: warning / unsaved-changes accent (kept, unchanged role).
const ember = {
  main: "#E8A33D",
  dark: "#B87A1E",
  dim: "#6B4A15",
};

export const surfaces = charcoal;

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: blue[400], light: blue[200], dark: blue[600] },
    secondary: { main: ember.main, light: "#F2C274", dark: ember.dark },
    error: { main: "#E5534B" },
    success: { main: blue[300] },
    warning: { main: ember.main },
    info: { main: blue[300] },
    background: { default: charcoal.base, paper: charcoal.low },
    divider: charcoal.line,
    text: { primary: grey[50], secondary: grey[300], disabled: grey[600] },
    grey,
  },
  typography: {
    fontFamily: '"Space Grotesk", "Segoe UI", sans-serif',
    h1: { fontSize: "1.75rem", fontWeight: 600, letterSpacing: "-0.01em" },
    h2: { fontSize: "1.375rem", fontWeight: 600, letterSpacing: "-0.01em" },
    h3: { fontSize: "1.125rem", fontWeight: 600 },
    h4: { fontSize: "1rem", fontWeight: 600 },
    body1: { fontSize: "0.875rem", lineHeight: 1.55 },
    body2: { fontSize: "0.8125rem", lineHeight: 1.5 },
    caption: { fontSize: "0.6875rem" },
    button: {
      textTransform: "none" as const,
      fontWeight: 500,
      fontSize: "0.8125rem",
    },
  },
  shape: { borderRadius: 2 },
  spacing: 4,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: charcoal.base },
        "::selection": { background: blue[800], color: grey[50] },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: `1px solid ${charcoal.line}`,
        },
        outlined: { borderColor: charcoal.line },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: charcoal.low,
          borderRadius: 8,
          border: `1px solid ${charcoal.line}`,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true, size: "small" },
      styleOverrides: {
        root: { borderRadius: 2, paddingInline: 14 },
        containedPrimary: {
          "&:hover": { backgroundColor: blue[500] },
        },
        outlined: {
          borderColor: charcoal.line,
          "&:hover": { borderColor: grey[600], backgroundColor: charcoal.mid },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "0.6875rem",
          height: 22,
          letterSpacing: "0.04em",
        },
        outlined: { borderColor: charcoal.line },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small" },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          backgroundColor: charcoal.base,
          "& fieldset": { borderColor: charcoal.line },
          "&:hover fieldset": { borderColor: grey[600] },
          "&.Mui-focused fieldset": { borderColor: blue[400] },
        },
        input: { padding: "7px 10px" },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { fontSize: "0.8125rem", "&.Mui-focused": { color: blue[300] } },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 40, borderBottom: `1px solid ${charcoal.line}` },
        indicator: { backgroundColor: blue[400], height: 2 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 40,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "0.75rem",
          textTransform: "none",
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: charcoal.high,
          border: `1px solid ${charcoal.line}`,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "0.6875rem",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: charcoal.low,
          border: `1px solid ${charcoal.line}`,
          // Shadows reserved for floating elements only.
          boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
        },
      },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          backgroundColor: charcoal.high,
          border: `1px solid ${charcoal.line}`,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "0.75rem",
        },
      },
    },
    // Switch: explicit geometry so the thumb sits dead-center in the track.
    // root carries the full size with zero padding; the base uses symmetric
    // padding (24 - 16) / 2 = 4 so thumb center == track center.
    MuiSwitch: {
      styleOverrides: {
        root: { width: 40, height: 24, padding: 0 },
        // Base uses symmetric padding (24 - 16) / 2 = 4 so the thumb sits
        // dead-center; checked pushes it right by the same 16px gap.
        switchBase: {
          padding: 4,
          "&.Mui-checked": { transform: "translateX(16px)" },
        },
        thumb: { width: 16, height: 16 },
        track: {
          height: 24,
          borderRadius: 12,
          opacity: 1,
          backgroundColor: grey[700],
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: charcoal.line,
          fontSize: "0.8125rem",
          padding: "6px 10px",
        },
        head: {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "0.6875rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: grey[400],
          fontWeight: 500,
        },
      },
    },
  },
});

export default theme;
export { blue, ember, grey, charcoal };
