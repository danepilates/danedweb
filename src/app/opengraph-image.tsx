import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const alt = "DANED Studio — Pilates y Asistencia Nutricional";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logoBuffer = await readFile(join(process.cwd(), "public", "logoDaned.png"));
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
          backgroundImage:
            "radial-gradient(circle at 50% 20%, rgba(224,171,32,0.16), transparent 60%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={220} height={176} alt="" />
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 28 }}>
          <div style={{ fontSize: 68, fontWeight: 600, color: "#373737" }}>DANED Studio</div>
          <div style={{ width: 14, height: 14, borderRadius: 999, backgroundColor: "#E0AB20" }} />
        </div>
        <div style={{ fontSize: 30, color: "rgba(55,55,55,0.6)", marginTop: 14 }}>
          Pilates y Asistencia Nutricional
        </div>
      </div>
    ),
    { ...size },
  );
}
