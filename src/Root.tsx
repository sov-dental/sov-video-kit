import React from "react";
import { Video } from "@remotion/media";
import { AbsoluteFill, CalculateMetadataFunction, Composition, staticFile } from "remotion";
import { Cards } from "./Cards";
import { ensureFont, FONT_STACK } from "./font";
import { Subtitles } from "./Subtitles";
import { getTheme } from "./themes";
import type { Card, EditProps, Job, Line } from "./types";

ensureFont();

// --public-dir 指到 jobs/<名稱>，所以 job 的檔案都用 staticFile 讀
const fetchJson = async <T,>(file: string, fallback: T): Promise<T> => {
  const res = await fetch(staticFile(file), { cache: "no-store" });
  if (!res.ok) return fallback;
  return (await res.json()) as T;
};

const calculateMetadata: CalculateMetadataFunction<EditProps> = async () => {
  const job = await fetchJson<Job | null>("job.json", null);
  if (!job) {
    return { durationInFrames: 90, fps: 30, width: 1080, height: 1920, props: { job: null, lines: [], cards: [] } };
  }
  const [{ lines }, { cards }] = await Promise.all([
    fetchJson<{ lines: Line[] }>("subtitles.json", { lines: [] }),
    fetchJson<{ cards: Card[] }>("cards.json", { cards: [] }),
  ]);
  return {
    durationInFrames: job.durationInFrames,
    fps: job.fps,
    width: job.width,
    height: job.height,
    props: { job, lines, cards },
  };
};

const Edit: React.FC<EditProps> = ({ job, lines, cards }) => {
  if (!job) {
    return (
      <AbsoluteFill
        style={{ background: "#111", color: "#fff", fontFamily: FONT_STACK, fontSize: 48, padding: 80, justifyContent: "center" }}
      >
        沒有載入 job。請用 npm run studio -- &lt;job 名稱&gt; 開啟。
      </AbsoluteFill>
    );
  }
  const theme = getTheme(job.theme);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Video src={staticFile("cut.mp4")} />
      <Cards cards={cards} theme={theme} />
      <Subtitles lines={lines} theme={theme} showEnglish={job.showEnglish} />
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Edit"
    component={Edit}
    durationInFrames={90}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={{ job: null, lines: [], cards: [] } satisfies EditProps}
    calculateMetadata={calculateMetadata}
  />
);
