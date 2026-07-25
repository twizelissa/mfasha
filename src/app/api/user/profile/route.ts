import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/utils/userDb";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const deviceId = searchParams.get("deviceId") || undefined;

    if (!email) {
      return NextResponse.json({ error: "Missing email parameter" }, { status: 400 });
    }

    const user = await getOrCreateUser(email, deviceId);
    return NextResponse.json({ user });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
