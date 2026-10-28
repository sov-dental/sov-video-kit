import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_STACK } from "./font";
import type { Line, Theme } from "./types";

/** 畫面上的中文：句號拿掉、逗號頓號變空白 */
const tidyZh = (s: string) =>
  s
    .replace(/[。.]+$/g, "")
    .replace(/[，、,；;。]/g, "\u3000")
    .replace(/\u3000+$/g, "")
    .trim();

/** **關鍵字** → 強調色 */
const renderHighlighted = (text: string, color: string) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <span key={i} style={{ color }}>
        {part.slice(2, -2)}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );

export const Subtitles: React.FC<{ lines: Line[]; theme: Theme; showEnglish: boolean }> = ({
  lines,
  theme,
  showEnglish,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const u = Math.min(width, height) / 1080;
  const vertical = height > width;

  // 間隔很短的兩行之間不要閃一下空白
  const filled = useMemo(() => {
    const sorted = [...lines].sort((a, b) => a.start - b.start);
    return sorted.map((l, i) => {
      const next = sorted[i + 1];
      const end = next && next.start - l.end < 0.35 ? next.start : l.end;
      return { ...l, end };
    });
  }, [lines]);

  const t = frame / fps;
  const line = filled.find((l) => t >= l.start && t < l.end);
  if (!line) return null;

  const local = frame - Math.round(line.start * fps);
  const pop = interpolate(local, [0, 4], [0.94, 1], { extrapolateRight: "clamp" });
  const opacity = interpolate(local, [0, 3], [0, 1], { extrapolateRight: "clamp" });

  const zhSize = (vertical ? 66 : 58) * u;
  const enSize = (vertical ? 36 : 32) * u;
  const stroke = `${Math.max(2, 9 * u)}px ${theme.dark}`;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: vertical ? height * 0.2 : height * 0.07,
        paddingLeft: width * 0.05,
        paddingRight: width * 0.05,
        fontFamily: FONT_STACK,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10 * u,
          transform: `scale(${pop})`,
          opacity,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: zhSize,
            fontWeight: 900,
            lineHeight: 1.25,
            color: "#fff",
            WebkitTextStroke: stroke,
            paintOrder: "stroke fill",
            textShadow: `0 ${4 * u}px ${14 * u}px rgba(0,0,0,0.45)`,
            letterSpacing: 1 * u,
          }}
        >
          {renderHighlighted(tidyZh(line.zh), theme.highlight)}
        </div>
        {showEnglish && line.en ? (
          <div
            style={{
              fontSize: enSize,
              fontWeight: 600,
              lineHeight: 1.25,
              color: "#fff",
              background: `${theme.dark}cc`,
              padding: `${6 * u}px ${18 * u}px`,
              borderRadius: 10 * u,
              maxWidth: width * 0.86,
            }}
          >
            {line.en.replace(/\*\*/g, "")}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
