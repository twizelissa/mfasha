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

export async function getOrCreateUser(email: string, deviceId?: string): Promise<ServerUser> {
  await initDb();
  const lowercaseEmail = email.toLowerCase();
  try {
    const res = await pool.query(
      'SELECT email, quota_used AS "quotaUsed", quota_limit AS "quotaLimit", device_id AS "deviceId" FROM users WHERE LOWER(email) = $1',
      [lowercaseEmail]
    );

    if (res.rows.length > 0) {
      const user = res.rows[0];
      // If user exists but device_id is not recorded yet, update it
      if (!user.deviceId && deviceId) {
        await pool.query(
          'UPDATE users SET device_id = $1 WHERE LOWER(email) = $2',
          [deviceId, lowercaseEmail]
        );
      }
      return {
        email: user.email,
        quotaUsed: user.quotaUsed,
        quotaLimit: user.quotaLimit,
      };
    } else {
      // Check if deviceId has already been used by another user
      let quotaLimit = 20;
      if (deviceId) {
        const deviceRes = await pool.query(
          'SELECT email FROM users WHERE device_id = $1 AND LOWER(email) != $2 LIMIT 1',
          [deviceId, lowercaseEmail]
        );
        if (deviceRes.rows.length > 0) {
          // Device has already been used to claim the free trial!
          quotaLimit = 0;
          console.warn(`Device fingerprint ${deviceId} already used by ${deviceRes.rows[0].email}. Setting quota_limit for ${lowercaseEmail} to 0.`);
        }
      }

      const insertRes = await pool.query(
        'INSERT INTO users (email, quota_used, quota_limit, device_id) VALUES ($1, $2, $3, $4) RETURNING email, quota_used AS "quotaUsed", quota_limit AS "quotaLimit"',
        [lowercaseEmail, 0, quotaLimit, deviceId || null]
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
