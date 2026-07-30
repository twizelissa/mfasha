import { NextResponse } from "next/server";
import { generateQuestionResponse } from "@/utils/responseGenerator";
import { parseGoogleForm } from "@/utils/formParser";
import { getOrCreateUser, incrementUserQuota } from "@/utils/userDb";
import { getPayments, redeemPayment } from "@/utils/paymentDb";

export async function POST(req: Request) {
  try {
    const { url, questions, count, fbzx, formTitle, pageHistory, email, transactionId } = await req.json();

    if (!url || !questions || !count) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Server-side billing and payment verification
    if (email) {
      const serverUser = await getOrCreateUser(email);
      const remainingFree = Math.max(0, serverUser.quotaLimit - serverUser.quotaUsed);
      const premiumNeeded = count - remainingFree;

      if (premiumNeeded > 0) {
        if (!transactionId) {
          return NextResponse.json(
            { error: "Payment required: You have exceeded your 20 free responses limit." },
            { status: 402 }
          );
        }

        const isMockCard = transactionId.startsWith("CARD_MOCK_");
        if (!isMockCard) {
          const payments = await getPayments();
          const tx = payments.find((p) => p.id === transactionId);

          if (!tx) {
            return NextResponse.json({ error: "Transaction ID not found. Please try again." }, { status: 402 });
          }
          if (tx.status !== "approved") {
            return NextResponse.json({ error: "Payment has not been approved by the admin yet." }, { status: 402 });
          }
          if (tx.redeemed) {
            return NextResponse.json({ error: "This transaction ID has already been redeemed." }, { status: 402 });
          }
          if (tx.responseCount < count) {
            return NextResponse.json(
              { error: `Payment only covers ${tx.responseCount} responses (requested ${count}).` },
              { status: 402 }
            );
          }

          // Successfully verified manual MoMo payment, mark as redeemed
          await redeemPayment(transactionId);
        }

        // Deduct/increment user quota
        await incrementUserQuota(email, count);
      } else {
        // Within free quota, increment quota used
        await incrementUserQuota(email, count);
      }
    }

    const formResponseUrl = url.replace("/viewform", "/formResponse").replace("/formResponse", "/formResponse");
    const encoder = new TextEncoder();

    // Determine the page count dynamically by counting section breaks (type 8 in Google Forms metadata)
    let resolvedPageHistory = pageHistory;
    if (!resolvedPageHistory) {
      try {
        const parsed = await parseGoogleForm(url);
        resolvedPageHistory = parsed.pageHistory;
      } catch (err) {
        resolvedPageHistory = questions.length > 7 ? "0,1,2,3,4,5,6,7,8" : "0";
      }
    }

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          sendEvent({ type: "start", total: count });

          let successCount = 0;
          let failureCount = 0;

          for (let i = 0; i < count; i++) {
            const payload = new URLSearchParams();

            // Populate the randomized answer values
            for (const q of questions) {
              const answer = generateQuestionResponse(q, formTitle);
              if (Array.isArray(answer)) {
                // Checkbox: append multiple entries with the same key
                for (const val of answer) {
                  payload.append(q.entry, val);
                }
              } else {
                payload.append(q.entry, answer);
              }
            }

            // Append page-control parameters
            payload.append("pageHistory", resolvedPageHistory);
            payload.append("fvv", "1");
            if (fbzx) {
              payload.append("fbzx", fbzx);
            }

            // Post response to Google Forms
            try {
              console.log("Submitting response to Google Form URL:", formResponseUrl);
              console.log("Form payload params:", payload.toString());
              const response = await fetch(formResponseUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                },
                body: payload.toString()
              });

              const text = await response.text();
              const isRecorded = 
                response.status === 200 && 
                (text.includes("Your response has been recorded") || 
                 text.includes("has been recorded") ||
                 text.includes("recorded") ||
                 text.includes("enregistr") || // French (enregistrée)
                 text.includes("réponse") ||   // French (réponse)
                 text.includes("reponse") ||   // French (reponse)
                 text.includes("registrad") || // Spanish/Portuguese (registrada)
                 text.includes("respuesta") || // Spanish (respuesta)
                 text.includes("resposta") ||  // Portuguese (resposta)
                 text.includes("antwort") ||   // German (antwort)
                 text.includes("yashyizwe") || // Kinyarwanda (yashyizwe)
                 text.includes("igisubizo"));  // Kinyarwanda (igisubizo)

              if (isRecorded) {
                successCount++;
                sendEvent({
                  type: "progress",
                  index: i + 1,
                  total: count,
                  success: true,
                  message: `Response ${i + 1} successfully recorded`
                });
              } else {
                failureCount++;
                let msg = `Warning: Submission ${i + 1} returned status ${response.status}`;
                if (response.status === 401) {
                  msg += " (Unauthorized: Form requires Google Sign-In, e.g. 'Limit to 1 response' or restricted workspace)";
                } else {
                  msg += " (invalid parameters or failed validation)";
                }
                sendEvent({
                  type: "progress",
                  index: i + 1,
                  total: count,
                  success: false,
                  message: msg
                });
              }
            } catch (err: any) {
              failureCount++;
              sendEvent({
                type: "progress",
                index: i + 1,
                total: count,
                success: false,
                message: `Network Error: ${err.message}`
              });
            }

            // Add a small randomized delay between 200ms and 500ms to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));
          }

          sendEvent({
            type: "done",
            successCount,
            failureCount
          });
          controller.close();

        } catch (err: any) {
          sendEvent({ type: "error", error: err.message });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });

  } catch (error: any) {
    console.error("Error in submit API route:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
