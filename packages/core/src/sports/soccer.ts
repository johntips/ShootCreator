import type { SportConfig } from "../types";

/** サッカー ゴールエリア Zone定義 (stub) */
export const soccer: SportConfig = {
  id: "soccer",
  name: "Soccer",
  icon: "soccerball",
  zones: [
    {
      id: "top-left",
      label: "Top Left",
      shortLabel: "TL",
      group: "mid-range",
      path: "",
      labelX: 0,
      labelY: 0,
    },
    {
      id: "top-center",
      label: "Top Center",
      shortLabel: "TC",
      group: "mid-range",
      path: "",
      labelX: 0,
      labelY: 0,
    },
    {
      id: "top-right",
      label: "Top Right",
      shortLabel: "TR",
      group: "mid-range",
      path: "",
      labelX: 0,
      labelY: 0,
    },
    {
      id: "bottom-left",
      label: "Bottom Left",
      shortLabel: "BL",
      group: "mid-range",
      path: "",
      labelX: 0,
      labelY: 0,
    },
    {
      id: "bottom-center",
      label: "Bottom Center",
      shortLabel: "BC",
      group: "mid-range",
      path: "",
      labelX: 0,
      labelY: 0,
    },
    {
      id: "bottom-right",
      label: "Bottom Right",
      shortLabel: "BR",
      group: "mid-range",
      path: "",
      labelX: 0,
      labelY: 0,
    },
  ],
  voiceCommands: {
    made: ["in", "goal", "yes"],
    missed: ["out", "no", "miss", "save"],
  },
};
