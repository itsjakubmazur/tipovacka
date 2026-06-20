import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          color: "#FFD400",
          fontSize: 256,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        OG
      </div>
    ),
    { ...size }
  );
}
