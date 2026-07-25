import { NextResponse } from "next/server";
import { getPayments, updatePaymentStatus } from "@/utils/paymentDb";
import { checkPaypackStatus, getPaypackConfig } from "@/utils/paypack";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing transaction ID" }, { status: 400 });
    }

    const payments = await getPayments();
    const payment = payments.find(p => p.id === id);

    if (!payment) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // If payment is pending and was initiated via Paypack, check the live status
    if (payment.status === "pending" && getPaypackConfig()) {
      // Paypack refs are standard UUID v4 format. We also check if payerName starts with "MOMO ("
      const isPaypackTx = 
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
        (payment.payerName && payment.payerName.startsWith("MOMO ("));

      if (isPaypackTx) {
        try {
          const liveStatus = await checkPaypackStatus(id);
          
          if (liveStatus === "successful") {
            await updatePaymentStatus(id, "approved");
            payment.status = "approved";
          } else if (liveStatus === "failed") {
            await updatePaymentStatus(id, "rejected");
            payment.status = "rejected";
          }
        } catch (err) {
          console.error(`Failed to update status for Paypack transaction ${id}:`, err);
        }
      }
    }

    return NextResponse.json({ status: payment.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 550 });
  }
}
