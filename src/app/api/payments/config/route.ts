import { NextResponse } from "next/server";
import { getPaypackConfig } from "@/utils/paypack";
import fs from "fs";
import path from "path";

export async function GET(req: Request) {
  try {
    const host = req.headers.get("host") || "";
    const DB_DIR = path.join(process.cwd(), "data");
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(DB_DIR, "last_host.txt"), host, "utf8");
    console.log("LAST ACCESS HOST LOGGED:", host);

    const config = getPaypackConfig();
    return NextResponse.json({ hasPaypack: config !== null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
export const dynamic = "force-dynamic";
