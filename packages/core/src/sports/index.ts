import type { SportConfig } from "../types";
import { basketball } from "./basketball";
import { soccer } from "./soccer";
import { tennis } from "./tennis";

export const sports: Record<string, SportConfig> = {
  basketball,
  tennis,
  soccer,
};

export function getSport(id: string): SportConfig | undefined {
  return sports[id];
}

export function getAllSports(): SportConfig[] {
  return Object.values(sports);
}

export { basketball, tennis, soccer };
