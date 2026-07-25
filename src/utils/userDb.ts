import { pool, initDb } from "./db";

export interface ServerUser {
  email: string;
  quotaUsed: number;
  quotaLimit: number;
}

export async function getUsers(): Promise<ServerUser[]> {
  await initDb();
  try {
    const res = await pool.query('SELECT email, quota_used AS "quotaUsed", quota_limit AS "quotaLimit" FROM users');
    return res.rows as ServerUser[];
  } catch (err) {
    console.error("Error getting users from PostgreSQL:", err);
    return [];
  }
}

export async function getOrCreateUser(email: string): Promise<ServerUser> {
  await initDb();
  const lowercaseEmail = email.toLowerCase();
  try {
    const res = await pool.query(
      'SELECT email, quota_used AS "quotaUsed", quota_limit AS "quotaLimit" FROM users WHERE LOWER(email) = $1',
      [lowercaseEmail]
    );

    if (res.rows.length > 0) {
      return res.rows[0] as ServerUser;
    } else {
      const insertRes = await pool.query(
        'INSERT INTO users (email, quota_used, quota_limit) VALUES ($1, $2, $3) RETURNING email, quota_used AS "quotaUsed", quota_limit AS "quotaLimit"',
        [lowercaseEmail, 0, 20]
      );
      return insertRes.rows[0] as ServerUser;
    }
  } catch (err) {
    console.error("Error in getOrCreateUser:", err);
    return {
      email: lowercaseEmail,
      quotaUsed: 0,
      quotaLimit: 20
    };
  }
}

export async function incrementUserQuota(email: string, amount: number): Promise<ServerUser> {
  await initDb();
  const lowercaseEmail = email.toLowerCase();
  try {
    const res = await pool.query(
      'SELECT email, quota_used AS "quotaUsed", quota_limit AS "quotaLimit" FROM users WHERE LOWER(email) = $1',
      [lowercaseEmail]
    );

    if (res.rows.length > 0) {
      const current = res.rows[0] as ServerUser;
      const newQuotaUsed = current.quotaUsed + amount;
      const updateRes = await pool.query(
        'UPDATE users SET quota_used = $1 WHERE LOWER(email) = $2 RETURNING email, quota_used AS "quotaUsed", quota_limit AS "quotaLimit"',
        [newQuotaUsed, lowercaseEmail]
      );
      return updateRes.rows[0] as ServerUser;
    } else {
      const insertRes = await pool.query(
        'INSERT INTO users (email, quota_used, quota_limit) VALUES ($1, $2, $3) RETURNING email, quota_used AS "quotaUsed", quota_limit AS "quotaLimit"',
        [lowercaseEmail, amount, 20]
      );
      return insertRes.rows[0] as ServerUser;
    }
  } catch (err) {
    console.error("Error in incrementUserQuota:", err);
    return {
      email: lowercaseEmail,
      quotaUsed: amount,
      quotaLimit: 20
    };
  }
}
