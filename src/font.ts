import { continueRender, delayRender } from "remotion";
import fontUrl from "./assets/NotoSansTC.ttf";

export const FONT_FAMILY = "SovNotoSansTC";
export const FONT_STACK = `"${FONT_FAMILY}", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif`;

// 字型隨工具包附帶，渲染時不用連網
let loaded = false;
export const ensureFont = () => {
  if (loaded || typeof document === "undefined") return;
  loaded = true;
  const handle = delayRender("載入字型");
  const face = new FontFace(FONT_FAMILY, `url(${fontUrl}) format("truetype")`, { weight: "100 900" });
  face
    .load()
    .then((f) => {
      document.fonts.add(f);
      continueRender(handle);
    })
    .catch((err) => {
      console.error("字型載入失敗，改用系統字型", err);
      continueRender(handle);
    });
};
