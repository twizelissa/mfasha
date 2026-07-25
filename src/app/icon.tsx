import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "transparent",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#10b981"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Bottom Hand (Helper) */}
          <path d="M3 20c1.5-2 3-4 4.5-5.5" />
          <path d="M7.5 14.5c.8-1 2-1.5 3-1" />
          <path d="M9.5 12.5c1.2-1.2 3-.8 4.2.4l1.8 1.8" />
          
          {/* Top Hand (Being Lifted) */}
          <path d="M21 4c-1.5 2-3 4-4.5 5.5" />
          <path d="M16.5 9.5c-.8 1-2 1.5-3 1" />
          <path d="M14.5 11.5c-1.2 1.2-3 .8-4.2-.4l-1.8-1.8" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
