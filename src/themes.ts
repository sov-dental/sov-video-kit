import type { Theme } from "./types";

// 顏色取自各品牌官網（2026-10）
export const themes: Record<string, Theme> = {
  // sov.dental
  sov: {
    primary: "#5b004e",
    dark: "#27111e",
    accent: "#bf6bae",
    light: "#f4d6e7",
    highlight: "#ffd84d",
  },
  // sunlight.dentist
  sunlight: {
    primary: "#364c8b",
    dark: "#1c2647",
    accent: "#4f70cc",
    light: "#b0c4ff",
    highlight: "#ffd84d",
  },
  neutral: {
    primary: "#1f2937",
    dark: "#0b0f17",
    accent: "#3b82f6",
    light: "#e5e7eb",
    highlight: "#facc15",
  },
};

export const getTheme = (name: string | undefined): Theme => themes[name ?? ""] ?? themes.sov;
