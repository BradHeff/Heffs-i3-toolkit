import { Box, Typography } from "@mui/material";

const FACTS: Array<[string, string]> = [
  ["Developer", "Brad Heffernan"],
  ["Original build", "VigilOS i3wm"],
  ["Version", "0.2.0"],
];

export default function AboutTab() {
  return (
    <Box component="article" sx={{ maxWidth: 560, px: 6, py: 6 }}>
      <Box
        component="img"
        src="/vigil-i3-toolkit.svg"
        alt=""
        sx={{ width: 72, height: 72, display: "block" }}
      />
      <Typography variant="h1" sx={{ mt: 4 }}>
        Vigil-i3-Toolkit
      </Typography>
      <Box
        component="dl"
        sx={{
          m: 0,
          mt: 4,
          display: "grid",
          gridTemplateColumns: "9.5rem 1fr",
          rowGap: 1.5,
          columnGap: 2,
        }}
      >
        {FACTS.map(([term, detail]) => (
          <Box key={term} sx={{ display: "contents" }}>
            <Typography
              component="dt"
              variant="body2"
              sx={{
                m: 0,
                color: "text.secondary",
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              {term}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0 }}>
              {detail}
            </Typography>
          </Box>
        ))}
      </Box>
      <Typography
        variant="body1"
        sx={{
          mt: 4,
          pt: 4,
          maxWidth: "62ch",
          borderTop: "1px solid",
          borderColor: "divider",
          color: "text.secondary",
        }}
      >
        Visual config toolkit for i3, Polybar, i3lock-color, rofi, dunst,
        picom, and the LightDM GTK greeter. Edits stay staged until you
        preview the diff. Each write is backed up, then saved with a temp
        file and rename, so a crash cannot truncate a config.
      </Typography>
    </Box>
  );
}
