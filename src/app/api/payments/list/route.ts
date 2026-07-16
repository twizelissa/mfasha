import { NextResponse } from "next/server";
import { getPayments, updatePaymentStatus } from "@/utils/paymentDb";

export async function GET() {
  try {
    const payments = getPayments();
    // Sort by newest first
    payments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ payments });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 550 });
  }
}

export async function POST(req: Request) {
  try {
    const { id, status } = await req.json();

    if (!id || !status || (status !== "approved" && status !== "rejected")) {
      return NextResponse.json({ error: "Invalid status parameters" }, { status: 400 });
    }

    const success = updatePaymentStatus(id, status);
    if (!success) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 550 });
  }
}
