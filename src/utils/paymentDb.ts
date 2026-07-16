import fs from "fs";
import path from "path";

export interface Payment {
  id: string; // Transaction ID
  payerName: string;
  amount: number;
  responseCount: number;
  formUrl: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  redeemed?: boolean;
}

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "payments.json");

// Ensure the data directory and payments.json exist
function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), "utf8");
  }
}

export function getPayments(): Payment[] {
  initDb();
  try {
    const data = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

export function savePayment(payment: Omit<Payment, "status" | "createdAt" | "redeemed">): Payment {
  initDb();
  const payments = getPayments();
  
  // Check if transaction ID already exists
  const existing = payments.find(p => p.id === payment.id);
  if (existing) {
    return existing;
  }

  const newPayment: Payment = {
    ...payment,
    status: "pending",
    createdAt: new Date().toISOString(),
    redeemed: false
  };

  payments.push(newPayment);
  fs.writeFileSync(DB_FILE, JSON.stringify(payments, null, 2), "utf8");
  return newPayment;
}

export function updatePaymentStatus(id: string, status: "approved" | "rejected"): boolean {
  initDb();
  const payments = getPayments();
  const index = payments.findIndex(p => p.id === id);
  if (index === -1) return false;

  payments[index].status = status;
  fs.writeFileSync(DB_FILE, JSON.stringify(payments, null, 2), "utf8");
  return true;
}

export function redeemPayment(id: string): boolean {
  initDb();
  const payments = getPayments();
  const index = payments.findIndex(p => p.id === id);
  if (index === -1) return false;

  payments[index].redeemed = true;
  fs.writeFileSync(DB_FILE, JSON.stringify(payments, null, 2), "utf8");
  return true;
}
