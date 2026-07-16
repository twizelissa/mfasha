export interface FormQuestion {
  id: number;
  title: string;
  entry: string;
  type: "text" | "radio" | "dropdown" | "checkbox" | "scale" | "unknown";
  choices: string[];
  isParagraph?: boolean;
}

export interface ParsedForm {
  title: string;
  description: string;
  fbzx: string;
  pageHistory: string;
  questions: FormQuestion[];
}

export async function parseGoogleForm(url: string): Promise<ParsedForm> {
  // Convert viewform URL to matching viewform if it isn't already
  let targetUrl = url;
  if (url.includes("/formResponse")) {
    targetUrl = url.replace("/formResponse", "/viewform");
  }

  const res = await fetch(targetUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch form page (status ${res.status})`);
  }

  const html = await res.text();

  // 1. Extract fbzx token
  let fbzx = "";
  const fbzxMatch = html.match(/name="fbzx"\s+value="([^"]+)"/) || html.match(/"fbzx"\s*,\s*"([^"]+)"/);
  if (fbzxMatch) {
    fbzx = fbzxMatch[1];
  }

  // 2. Extract FB_PUBLIC_LOAD_DATA_
  const loadDataMatch = html.match(/var\s+FB_PUBLIC_LOAD_DATA_\s*=\s*([\s\S]*?);\s*<\/script>/);
  if (!loadDataMatch) {
    throw new Error("Could not parse form metadata (FB_PUBLIC_LOAD_DATA_ not found). Make sure it is a public Google Form link.");
  }

  let data: any;
  try {
    data = JSON.parse(loadDataMatch[1]);
  } catch (err) {
    throw new Error("Failed to parse form JSON metadata");
  }

  const formTitle = typeof data[1][8] === "string" ? data[1][8] : "Untitled Form";
  const formDescription = typeof data[1][0] === "string" ? data[1][0] : "";
  const rawQuestions = data[1][1] || [];
  const questions: FormQuestion[] = [];

  for (const item of rawQuestions) {
    const questionId = item[0];
    const title = item[1];
    const typeId = item[3];
    
    // Ignore section headers (8) or image/video blocks
    if (typeId === 8 || !title) continue;

    // Check if we have entry details
    if (item[4] && item[4][0]) {
      const entryId = item[4][0][0];
      const entry = `entry.${entryId}`;
      
      let type: FormQuestion["type"] = "unknown";
      if (typeId === 0 || typeId === 1) type = "text";
      else if (typeId === 2) type = "radio";
      else if (typeId === 3) type = "dropdown";
      else if (typeId === 4) type = "checkbox";
      else if (typeId === 5) type = "scale";

      const choices: string[] = [];
      const rawChoices = item[4][0][1];
      if (rawChoices && Array.isArray(rawChoices)) {
        for (const choice of rawChoices) {
          if (choice && choice[0] !== undefined) {
            choices.push(String(choice[0]));
          }
        }
      }

      questions.push({
        id: questionId,
        title,
        entry,
        type,
        choices,
        isParagraph: typeId === 1
      });
    }
  }

  let pageBreaks = 0;
  for (const item of rawQuestions) {
    if (item[3] === 8) {
      pageBreaks++;
    }
  }
  const pageHistory = Array.from({ length: pageBreaks + 1 }, (_, i) => i).join(",");

  return {
    title: formTitle,
    description: formDescription,
    fbzx,
    pageHistory,
    questions
  };
}
