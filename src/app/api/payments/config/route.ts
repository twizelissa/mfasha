import { NextResponse } from "next/server";
import { getPaypackConfig } from "@/utils/paypack";

export async function GET() {
  try {
    const config = getPaypackConfig();
    return NextResponse.json({ hasPaypack: config !== null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
export const dynamic = "force-dynamic";
