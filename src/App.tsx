// App shell — tab navigation across the config targets. All six config
// editors now run on the same staged-edit pipeline.

import { useState } from "react";
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

      <Tabs value={active} onChange={(_e, v: string) => setActive(v)}>
        {TABS.map((t) => (
          <Tab key={t.key} value={t.key} label={t.label} />
        ))}
      </Tabs>

      <Box component="main" sx={{ flexGrow: 1, overflow: "auto", minHeight: 0 }}>
        {active === "i3" && <I3Tab />}
        {active === "polybar" && <PolybarTab />}
        {active === "lock" && <LockTab />}
        {active === "rofi" && <RofiTab />}
        {active === "dunst" && <DunstTab />}
        {active === "picom" && <PicomTab />}
        {active === "greeter" && <GreeterTab />}
      </Box>
    </Box>
  );
}
