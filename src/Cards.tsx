import React from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_STACK } from "./font";
import type { Card, Theme } from "./types";

const DEFAULT_DURATION = 3.5;

const useUnit = () => {
  const { width, height } = useVideoConfig();
  return { u: Math.min(width, height) / 1080, vertical: height > width, width, height };
};

/** 進場彈出、退場淡出 */
const useEnterExit = (durationInFrames: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 160, mass: 0.7 } });
  const exit = interpolate(frame, [durationInFrames - 9, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.quad),
  });
  return { enter, exit, frame, fps };
};

const Panel: React.FC<{ children: React.ReactNode; bg: string; u: number; style?: React.CSSProperties }> = ({
  children,
  bg,
  u,
  style,
}) => (
  <div
    style={{
      background: bg,
      borderRadius: 22 * u,
      padding: `${26 * u}px ${34 * u}px`,
      boxShadow: `0 ${14 * u}px ${40 * u}px rgba(0,0,0,0.28)`,
      ...style,
    }}
  >
    {children}
  </div>
);

const CardBody: React.FC<{ card: Card; theme: Theme; durationInFrames: number }> = ({ card, theme, durationInFrames }) => {
  const { u, vertical, width } = useUnit();
  const { enter, exit, frame, fps } = useEnterExit(durationInFrames);
  const fromLeft = (card.align ?? (vertical ? "center" : "left")) === "left";
  const dx = interpolate(enter, [0, 1], [fromLeft ? -60 * u : 0, 0]);
  const dy = interpolate(enter, [0, 1], [fromLeft ? 0 : 40 * u, 0]);
  const wrap: React.CSSProperties = {
    transform: `translate(${dx}px, ${dy}px) scale(${interpolate(enter, [0, 1], [0.9, 1])})`,
    opacity: Math.min(enter, exit),
    maxWidth: vertical ? width * 0.86 : width * 0.44,
    fontFamily: FONT_STACK,
    display: "flex",
    flexDirection: "column",
    alignItems: fromLeft ? "flex-start" : card.align === "right" ? "flex-end" : "center",
    gap: 14 * u,
  };

  switch (card.type) {
    case "title":
      return (
        <div style={wrap}>
          {card.kicker ? (
            <div
              style={{
                background: theme.accent,
                color: "#fff",
                fontSize: 34 * u,
                fontWeight: 700,
                padding: `${8 * u}px ${22 * u}px`,
                borderRadius: 999,
              }}
            >
              {card.kicker}
            </div>
          ) : null}
          <Panel bg={theme.primary} u={u}>
            <div style={{ color: "#fff", fontSize: (vertical ? 76 : 64) * u, fontWeight: 900, lineHeight: 1.2 }}>
              {card.title}
            </div>
            {card.en ? (
              <div style={{ color: theme.light, fontSize: 32 * u, fontWeight: 500, marginTop: 8 * u }}>{card.en}</div>
            ) : null}
          </Panel>
        </div>
      );

    case "point":
      return (
        <div style={{ ...wrap, flexDirection: "row", alignItems: "center", gap: 18 * u }}>
          {card.number !== undefined ? (
            <div
              style={{
                flexShrink: 0,
                width: 96 * u,
                height: 96 * u,
                borderRadius: 999,
                background: theme.highlight,
                color: theme.dark,
                fontSize: 54 * u,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 ${10 * u}px ${30 * u}px rgba(0,0,0,0.25)`,
              }}
            >
              {card.number}
            </div>
          ) : null}
          <Panel bg="#fff" u={u} style={{ borderLeft: `${12 * u}px solid ${theme.primary}` }}>
            <div style={{ color: theme.dark, fontSize: (vertical ? 56 : 48) * u, fontWeight: 900, lineHeight: 1.25 }}>
              {card.title}
            </div>
            {card.en ? <div style={{ color: theme.primary, fontSize: 28 * u, fontWeight: 500 }}>{card.en}</div> : null}
          </Panel>
        </div>
      );

    case "list":
      return (
        <div style={wrap}>
          <Panel bg="rgba(255,255,255,0.96)" u={u}>
            <div style={{ color: theme.primary, fontSize: (vertical ? 52 : 44) * u, fontWeight: 900, marginBottom: 14 * u }}>
              {card.title}
            </div>
            {card.items.map((item, i) => {
              const s = spring({ frame: frame - 8 - i * 6, fps, config: { damping: 18, stiffness: 170 } });
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16 * u,
                    margin: `${10 * u}px 0`,
                    opacity: s,
                    transform: `translateX(${interpolate(s, [0, 1], [30 * u, 0])}px)`,
                  }}
                >
                  <div
                    style={{
                      flexShrink: 0,
                      width: 48 * u,
                      height: 48 * u,
                      borderRadius: 999,
                      background: theme.accent,
                      color: "#fff",
                      fontSize: 30 * u,
                      fontWeight: 900,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✓
                  </div>
                  <div style={{ color: theme.dark, fontSize: (vertical ? 44 : 38) * u, fontWeight: 700, lineHeight: 1.3 }}>
                    {item}
                  </div>
                </div>
              );
            })}
          </Panel>
        </div>
      );

    case "stat":
      return (
        <div style={wrap}>
          <Panel bg="#fff" u={u} style={{ textAlign: "center" }}>
            <div style={{ color: theme.primary, fontSize: (vertical ? 120 : 104) * u, fontWeight: 900, lineHeight: 1.05 }}>
              {card.value}
            </div>
            <div style={{ color: theme.dark, fontSize: 40 * u, fontWeight: 700, marginTop: 8 * u }}>{card.label}</div>
            {card.en ? <div style={{ color: theme.accent, fontSize: 28 * u, fontWeight: 500 }}>{card.en}</div> : null}
          </Panel>
        </div>
      );

    case "term":
      return (
        <div style={wrap}>
          <Panel bg="rgba(255,255,255,0.96)" u={u} style={{ borderTop: `${10 * u}px solid ${theme.primary}` }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16 * u, flexWrap: "wrap" }}>
              <div style={{ color: theme.primary, fontSize: (vertical ? 60 : 50) * u, fontWeight: 900 }}>{card.term}</div>
              {card.en ? (
                <div style={{ color: theme.accent, fontSize: 32 * u, fontWeight: 600, fontStyle: "italic" }}>{card.en}</div>
              ) : null}
            </div>
            <div style={{ color: theme.dark, fontSize: (vertical ? 40 : 34) * u, fontWeight: 500, lineHeight: 1.45, marginTop: 10 * u }}>
              {card.definition}
            </div>
          </Panel>
        </div>
      );

    case "cta": {
      const pulse = 1 + 0.03 * Math.sin((frame / fps) * Math.PI * 2);
      return (
        <div style={wrap}>
          <Panel bg={theme.primary} u={u} style={{ textAlign: "center", transform: `scale(${pulse})` }}>
            <div style={{ color: "#fff", fontSize: (vertical ? 64 : 54) * u, fontWeight: 900 }}>{card.title}</div>
            {card.sub ? (
              <div style={{ color: theme.light, fontSize: 36 * u, fontWeight: 600, marginTop: 8 * u }}>{card.sub}</div>
            ) : null}
          </Panel>
        </div>
      );
    }
  }
};

const Placement: React.FC<{ card: Card; children: React.ReactNode }> = ({ card, children }) => {
  const { vertical, height, width } = useUnit();
  const pos = card.position ?? "top";
  const align = card.align ?? (vertical ? "center" : "left");
  return (
    <AbsoluteFill
      style={{
        justifyContent: pos === "top" ? "flex-start" : pos === "middle" ? "center" : "flex-end",
        alignItems: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
        paddingTop: height * (vertical ? 0.09 : 0.07),
        paddingBottom: height * (vertical ? 0.36 : 0.24),
        paddingLeft: width * 0.06,
        paddingRight: width * 0.06,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const Cards: React.FC<{ cards: Card[]; theme: Theme }> = ({ cards, theme }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {cards.map((card, i) => {
        const from = Math.round(card.at * fps);
        const durationInFrames = Math.max(15, Math.round((card.duration ?? DEFAULT_DURATION) * fps));
        return (
          <Sequence key={i} from={from} durationInFrames={durationInFrames} name={`${card.type}: ${"title" in card ? card.title : card.type}`}>
            <Placement card={card}>
              <CardBody card={card} theme={theme} durationInFrames={durationInFrames} />
            </Placement>
          </Sequence>
        );
      })}
    </>
  );
};
