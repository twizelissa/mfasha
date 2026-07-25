import { NextResponse } from "next/server";
import { savePayment } from "@/utils/paymentDb";
import { initiatePaypackCashin, getPaypackConfig } from "@/utils/paypack";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, transactionId, payerName, amount, responseCount, formUrl } = body;

    // Check if it's the automated Paypack flow
    const paypackConfig = getPaypackConfig();
    if (phone && paypackConfig) {
      if (amount === undefined || !responseCount || !formUrl) {
        return NextResponse.json({ error: "Missing required fields for Paypack Cashin" }, { status: 400 });
      }

      // Trigger the cash-in prompt to the user's phone via Paypack
      const cashinData = await initiatePaypackCashin(phone, amount);

      // Save the pending payment transaction in the local DB
      // We use Paypack's transaction reference as the unique ID
      const payment = await savePayment({
        id: cashinData.ref,
        payerName: `MOMO (${phone})`,
        amount,
        responseCount,
        formUrl
      });

      return NextResponse.json({
        success: true,
        transactionId: cashinData.ref,
        isPaypack: true,
        payment
      });
    }

    // Backwards-compatible manual flow
    if (!transactionId || !payerName || amount === undefined || !responseCount || !formUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const payment = await savePayment({
      id: transactionId,
      payerName,
      amount,
      responseCount,
      formUrl
    });

    return NextResponse.json({ success: true, payment });
  } catch (err: any) {
    console.error("Payment submission failed:", err);
    return NextResponse.json({ error: err.message || "Payment submission failed" }, { status: 500 });
  }
}
