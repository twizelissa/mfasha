import { NextResponse } from "next/server";
import { getPayments, updatePaymentStatus } from "@/utils/paymentDb";
import { verifyUserToken } from "@/utils/authVerify";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.split("Bearer ")[1];
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const email = await verifyUserToken(token);
    if (!email || email !== "twizelissa@gmail.com") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payments = await getPayments();
    // Sort by newest first
    payments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ payments });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.split("Bearer ")[1];
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const email = await verifyUserToken(token);
    if (!email || email !== "twizelissa@gmail.com") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, status } = await req.json();

    if (!id || status === undefined || (status !== "approved" && status !== "rejected")) {
      return NextResponse.json({ error: "Invalid status parameters" }, { status: 400 });
    }

    const success = await updatePaymentStatus(id, status);
    if (!success) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 550 });
  }
}
