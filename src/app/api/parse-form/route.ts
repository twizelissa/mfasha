import { NextResponse } from "next/server";
import { parseGoogleForm } from "@/utils/formParser";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    
    if (!url || !url.startsWith("https://docs.google.com/forms")) {
      return NextResponse.json(
        { error: "Invalid Google Form URL. Make sure it starts with https://docs.google.com/forms" },
        { status: 400 }
      );
    }

    const parsedForm = await parseGoogleForm(url);
    return NextResponse.json(parsedForm);

  } catch (error: any) {
    console.error("Error parsing form:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse Google Form. Please verify the URL and ensure the form is public." },
      { status: 400 }
    );
  }
}
