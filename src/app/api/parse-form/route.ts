import { NextResponse } from "next/server";
import { parseGoogleForm } from "@/utils/formParser";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    
    let resolvedUrl = url;

    // Resolve shortened links (like forms.gle) or redirects
    if (url && (url.includes("forms.gle") || !url.startsWith("https://docs.google.com/forms"))) {
      try {
        const response = await fetch(url, {
          method: "GET",
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
        resolvedUrl = response.url;
      } catch (err: any) {
        console.error("Error resolving URL redirects:", err);
      }
    }

    if (!resolvedUrl || !resolvedUrl.startsWith("https://docs.google.com/forms")) {
      return NextResponse.json(
        { error: "Invalid Google Form URL. Make sure it starts with https://docs.google.com/forms or is a valid forms.gle link." },
        { status: 400 }
      );
    }

    const parsedForm = await parseGoogleForm(resolvedUrl);
    return NextResponse.json({ ...parsedForm, url: resolvedUrl });

  } catch (error: any) {
    console.error("Error parsing form:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse Google Form. Please verify the URL and ensure the form is public." },
      { status: 400 }
    );
  }
}
