import fs from "fs";
import path from "path";

// Load .env.local manually
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8");
  envConfig.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
}

import { getPayments } from "../src/utils/paymentDb";

async function main() {
  console.log("DATABASE_URL in env:", process.env.DATABASE_URL ? "Configured" : "Not configured");
  try {
    const payments = await getPayments();
    console.log("Payments in DB:", JSON.stringify(payments, null, 2));
  } catch (err) {
    console.error("Failed to fetch payments:", err);
  }
}

main();
