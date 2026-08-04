import crypto from "crypto";

let cachedToken: string | null = null;
let tokenExpiresAt: number | null = null;

export interface PaypackConfig {
  clientId: string;
  clientSecret: string;
}

export function getPaypackConfig(): PaypackConfig | null {
  const clientId = process.env.PAYPACK_CLIENT_ID;
  const clientSecret = process.env.PAYPACK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}

export async function getPaypackToken(): Promise<string> {
  const config = getPaypackConfig();
  if (!config) {
    throw new Error("Paypack credentials not configured in environment variables.");
  }

  // Check if token is cached and not expiring within the next 60 seconds
  if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const response = await fetch("https://payments.paypack.rw/api/auth/agents/authorize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Paypack authentication failed (status ${response.status}): ${errorText}`);
  }

  const data = await response.json();
  
  cachedToken = data.access;
  const expiresIn = data.expires_in || 3600; // Default to 1 hour
  tokenExpiresAt = Date.now() + expiresIn * 1000;

  return cachedToken!;
}

interface CashinResponse {
  ref: string;
  status: string;
  amount: number;
  kind: string;
  created_at: string;
}

export async function initiatePaypackCashin(
  phoneNumber: string,
  amount: number
): Promise<CashinResponse> {
  const token = await getPaypackToken();
  const idempotencyKey = crypto.randomUUID();

  // Normalize phone number to Rwandan format: should start with 078, 079, 072, 073, or 25078, etc.
  // Standard format expected by Paypack is usually starting with "07..." (10 digits)
  let normalizedNumber = phoneNumber.trim().replace(/\s+/g, "");
  if (normalizedNumber.startsWith("+250")) {
    normalizedNumber = "0" + normalizedNumber.slice(4);
  } else if (normalizedNumber.startsWith("250")) {
    normalizedNumber = "0" + normalizedNumber.slice(3);
  }

  const response = await fetch("https://payments.paypack.rw/api/transactions/cashin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      amount: Number(amount),
      number: normalizedNumber,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Paypack Cashin failed: ${errorText}`);
  }

  return response.json();
}

export interface PaypackEvent {
  event_id: string;
  event_kind: "transaction:created" | "transaction:processed";
  created_at: string;
  data: {
    ref: string;
    kind: "CASHIN" | "CASHOUT";
    fee: number;
    merchant: string;
    client: string;
    amount: number;
    status: "pending" | "successful" | "failed";
    created_at: string;
    processed_at?: string;
  };
}

export async function checkPaypackStatus(
  ref: string
): Promise<"pending" | "successful" | "failed"> {
  const token = await getPaypackToken();

  const response = await fetch(
    `https://payments.paypack.rw/api/events/transactions?ref=${encodeURIComponent(ref)}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    // If the event lookup fails, fallback to pending so we can try again
    console.error(`Failed to fetch Paypack event for ref ${ref}: status ${response.status}`);
    return "pending";
  }

  const data = await response.json();
  const transactions: PaypackEvent[] = data.transactions || [];

  // Check if there is a processed event
  const processedEvent = transactions.find(
    (tx) => tx.event_kind === "transaction:processed" && tx.data.ref === ref
  );

  if (processedEvent) {
    return processedEvent.data.status; // "successful" | "failed"
  }

  // Check if there is a created event, meaning it's still pending
  const createdEvent = transactions.find(
    (tx) => tx.event_kind === "transaction:created" && tx.data.ref === ref
  );

  if (createdEvent) {
    return "pending";
  }

  // Default fallback if no event is found in the logs yet
  return "pending";
}
