export type Job = {
  name: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  orientation: "vertical" | "horizontal" | "square";
  theme: string;
  showEnglish: boolean;
};

/** 時間單位都是秒（剪輯後的時間軸） */
export type Line = {
  start: number;
  end: number;
  /** 中文；用 **關鍵字** 標示要上強調色的詞 */
  zh: string;
  en: string;
};

export type CardPosition = "top" | "middle" | "bottom";

type CardBase = {
  /** 出現時間（秒） */
  at: number;
  /** 停留秒數，預設 3.5 */
  duration?: number;
  position?: CardPosition;
  align?: "left" | "center" | "right";
};

export type Card = CardBase &
  (
    | { type: "title"; kicker?: string; title: string; en?: string }
    | { type: "point"; number?: number | string; title: string; en?: string }
    | { type: "list"; title: string; items: string[] }
    | { type: "stat"; value: string; label: string; en?: string }
    | { type: "term"; term: string; en?: string; definition: string }
    | { type: "cta"; title: string; sub?: string }
  );

export type Theme = {
  primary: string;
  dark: string;
  accent: string;
  light: string;
  highlight: string;
};

export type EditProps = {
  job: Job | null;
  lines: Line[];
  cards: Card[];
};
