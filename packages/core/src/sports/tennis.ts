import type { SportConfig } from "../types";

/** テニス サービスエリア Zone定義 (stub) */
export const tennis: SportConfig = {
  id: "tennis",
  name: "Tennis",
  icon: "tennisball",
  zones: [
    {
      id: "deuce-wide",
      label: "Deuce Wide",
      shortLabel: "DW",
      group: "mid-range",
      path: "",
      labelX: 0,
      labelY: 0,
    },
    {
      id: "deuce-body",
      label: "Deuce Body",
      shortLabel: "DB",
      group: "mid-range",
      path: "",
      labelX: 0,
      labelY: 0,
    },
    {
      id: "deuce-t",
      label: "Deuce T",
      shortLabel: "DT",
      group: "mid-range",
      path: "",
      labelX: 0,
      labelY: 0,
    },
    {
      id: "ad-wide",
      label: "Ad Wide",
      shortLabel: "AW",
      group: "mid-range",
      path: "",
      labelX: 0,
      labelY: 0,
    },
    {
      id: "ad-body",
      label: "Ad Body",
      shortLabel: "AB",
      group: "mid-range",
      path: "",
      labelX: 0,
      labelY: 0,
    },
    {
      id: "ad-t",
      label: "Ad T",
      shortLabel: "AT",
      group: "mid-range",
      path: "",
      labelX: 0,
      labelY: 0,
    },
  ],
  voiceCommands: {
    made: ["in", "yes", "ace"],
    missed: ["out", "no", "fault"],
  },
};
