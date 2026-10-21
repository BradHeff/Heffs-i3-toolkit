// App shell — tab navigation across the config targets. All six config
// editors now run on the same staged-edit pipeline.

import React, { useState } from "react";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import I3Tab from "./components/I3Tab";
import PolybarTab from "./components/PolybarTab";
import LockTab from "./components/LockTab";
import RofiTab from "./components/RofiTab";
import DunstTab from "./components/DunstTab";
import PicomTab from "./components/PicomTab";
import GreeterTab from "./components/GreeterTab";
import { isDemoMode } from "./ipc";

interface TabSpec {
  key: string;
  label: string;
}

const TABS: TabSpec[] = [
  { key: "i3", label: "i3" },
  { key: "polybar", label: "Polybar" },
  { key: "lock", label: "i3lock" },
  { key: "rofi", label: "rofi" },
  { key: "dunst", label: "dunst" },
  { key: "picom", label: "picom" },
  { key: "greeter", label: "Greeter" },
];

// Tabs stay mounted (hidden, not unmounted) so staged edits survive
// switching tabs. Elements are created once at module level: mounting
// real children (never calling components as functions) keeps each
// tab's hooks on its own component instance.
const TAB_ELEMENTS: Record<string, React.ReactElement> = {
  i3: <I3Tab />,
  polybar: <PolybarTab />,
  lock: <LockTab />,
  rofi: <RofiTab />,
  dunst: <DunstTab />,
  picom: <PicomTab />,
  greeter: <GreeterTab />,
};

export default function App() {
  const [active, setActive] = useState("i3");

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Box
        component="header"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2,
          py: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Box
          component="img"
          src="/heffs-i3-toolkit.svg"
          alt="Heffs i3 toolkit logo"
          sx={{ width: 22, height: 22 }}
        />
        <Typography variant="h2" sx={{ fontSize: "1rem" }}>
          Heffs i3 toolkit
        </Typography>
        {isDemoMode && (
          <Typography
            variant="caption"
            sx={{
              ml: "auto",
              fontFamily: '"JetBrains Mono", monospace',
              color: "warning.main",
            }}
          >
            demo mode (no backend)
          </Typography>
        )}
      </Box>

      <Tabs
        value={active}
        onChange={(_e, v: string) => setActive(v)}
        aria-label="Config target"
      >
        {TABS.map((t) => (
          <Tab
            key={t.key}
            value={t.key}
            label={t.label}
            id={`config-tab-${t.key}`}
            aria-controls={`config-tabpanel-${t.key}`}
          />
        ))}
      </Tabs>

      <Box component="main" sx={{ flexGrow: 1, overflow: "auto", minHeight: 0 }}>
        {TABS.map((t) => (
          <Box
            key={t.key}
            role="tabpanel"
            id={`config-tabpanel-${t.key}`}
            aria-labelledby={`config-tab-${t.key}`}
            hidden={active !== t.key}
            {...(active !== t.key ? { inert: true } : {})}
            sx={{ height: "100%", overflow: "auto" }}
          >
            {TAB_ELEMENTS[t.key]}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
