import { pool, initDb } from "./db";
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

const PAYMENTS_JSON_PATH = path.join(process.cwd(), "data", "payments.json");

function readPaymentsJson(): Payment[] {
  try {
    if (fs.existsSync(PAYMENTS_JSON_PATH)) {
      const data = fs.readFileSync(PAYMENTS_JSON_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading payments JSON file:", err);
  }
  return [];
}

function writePaymentsJson(payments: Payment[]): void {
  try {
    fs.writeFileSync(PAYMENTS_JSON_PATH, JSON.stringify(payments, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing payments JSON file:", err);
  }
}

export async function getPayments(): Promise<Payment[]> {
  if (!process.env.DATABASE_URL) {
    return readPaymentsJson();
  }
  await initDb();
  try {
    const res = await pool.query(
      'SELECT id, payer_name AS "payerName", amount, response_count AS "responseCount", form_url AS "formUrl", status, created_at AS "createdAt", redeemed FROM payments'
    );
    return res.rows.map(row => ({
      ...row,
      amount: Number(row.amount),
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : ""
    })) as Payment[];
  } catch (err) {
    console.error("Error getting payments from PostgreSQL:", err);
    return [];
  }
}

export async function savePayment(payment: Omit<Payment, "status" | "createdAt" | "redeemed">): Promise<Payment> {
  if (!process.env.DATABASE_URL) {
    const payments = readPaymentsJson();
    const existing = payments.find((p) => p.id === payment.id);
    if (existing) {
      return existing;
    }
    const newPayment: Payment = {
      ...payment,
      status: "pending",
      createdAt: new Date().toISOString(),
      redeemed: false,
    };
    payments.push(newPayment);
    writePaymentsJson(payments);
    return newPayment;
  }
  await initDb();
  try {
    const existing = await pool.query(
      'SELECT id, payer_name AS "payerName", amount, response_count AS "responseCount", form_url AS "formUrl", status, created_at AS "createdAt", redeemed FROM payments WHERE id = $1',
      [payment.id]
    );
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      return {
        ...row,
        amount: Number(row.amount),
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : ""
      } as Payment;
    }

    const createdAt = new Date().toISOString();
    const insertRes = await pool.query(
      'INSERT INTO payments (id, payer_name, amount, response_count, form_url, status, created_at, redeemed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, payer_name AS "payerName", amount, response_count AS "responseCount", form_url AS "formUrl", status, created_at AS "createdAt", redeemed',
      [payment.id, payment.payerName, payment.amount, payment.responseCount, payment.formUrl, "pending", createdAt, false]
    );

    const row = insertRes.rows[0];
    return {
      ...row,
      amount: Number(row.amount),
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : ""
    } as Payment;
  } catch (err) {
    console.error("Error saving payment to PostgreSQL:", err);
    return {
      ...payment,
      status: "pending",
      createdAt: new Date().toISOString(),
      redeemed: false
    };
  }
}

export async function updatePaymentStatus(id: string, status: "approved" | "rejected"): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    const payments = readPaymentsJson();
    const idx = payments.findIndex((p) => p.id === id);
    if (idx !== -1) {
      payments[idx].status = status;
      writePaymentsJson(payments);
      return true;
    }
    return false;
  }
  await initDb();
  try {
    const res = await pool.query("UPDATE payments SET status = $1 WHERE id = $2", [status, id]);
    return (res.rowCount ?? 0) > 0;
  } catch (err) {
    console.error("Error updating payment status in PostgreSQL:", err);
    return false;
  }
}

export async function redeemPayment(id: string): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    const payments = readPaymentsJson();
    const idx = payments.findIndex((p) => p.id === id);
    if (idx !== -1) {
      payments[idx].redeemed = true;
      writePaymentsJson(payments);
      return true;
    }
    return false;
  }
  await initDb();
  try {
    const res = await pool.query("UPDATE payments SET redeemed = TRUE WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  } catch (err) {
    console.error("Error redeeming payment in PostgreSQL:", err);
    return false;
  }
}
