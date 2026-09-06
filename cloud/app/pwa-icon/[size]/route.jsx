import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() {
  return ["180", "192", "512"].map((size) => ({ size }));
}

export async function GET(_request, { params }) {
  const { size: value } = await params;
  if (!["180", "192", "512"].includes(value)) return new Response("Not found", { status: 404 });
  const size = Number(value);
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", background: "#236747", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700 }}>JB</div>,
    { width: size, height: size },
  );
}
