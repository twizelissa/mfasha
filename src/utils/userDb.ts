import { pool, initDb } from "./db";
import fs from "fs";
import path from "path";

export interface ServerUser {
  email: string;
  quotaUsed: number;
  quotaLimit: number;
  deviceId?: string;
}

const USERS_JSON_PATH = path.join(process.cwd(), "data", "users.json");

function readUsersJson(): ServerUser[] {
  try {
    if (fs.existsSync(USERS_JSON_PATH)) {
      const data = fs.readFileSync(USERS_JSON_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading users JSON file:", err);
  }
  return [];
}

function writeUsersJson(users: ServerUser[]): void {
  try {
    fs.writeFileSync(USERS_JSON_PATH, JSON.stringify(users, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing users JSON file:", err);
  }
}

export async function getUsers(): Promise<ServerUser[]> {
  if (!process.env.DATABASE_URL) {
    return readUsersJson();
  }
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
  const lowercaseEmail = email.toLowerCase();
  if (lowercaseEmail === "twizelissa@gmail.com") {
    return {
      email: "twizelissa@gmail.com",
      quotaUsed: 0,
      quotaLimit: 999999999,
    };
  }

  if (!process.env.DATABASE_URL) {
    const users = readUsersJson();
    const existing = users.find((u) => u.email.toLowerCase() === lowercaseEmail);
    if (existing) {
      if (!existing.deviceId && deviceId) {
        existing.deviceId = deviceId;
        writeUsersJson(users);
      }
      return existing;
    }

    let quotaLimit = 20;
    if (deviceId) {
      const deviceRes = users.find(
        (u) => u.deviceId === deviceId && u.email.toLowerCase() !== lowercaseEmail
      );
      if (deviceRes) {
        quotaLimit = 0;
        console.warn(`Device fingerprint ${deviceId} already used by ${deviceRes.email}. Setting quota_limit for ${lowercaseEmail} to 0.`);
      }
    }

    const newUser: ServerUser = {
      email: lowercaseEmail,
      quotaUsed: 0,
      quotaLimit,
      deviceId,
    };
    users.push(newUser);
    writeUsersJson(users);
    return newUser;
  }

  await initDb();
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
  const lowercaseEmail = email.toLowerCase();
  if (lowercaseEmail === "twizelissa@gmail.com") {
    return {
      email: "twizelissa@gmail.com",
      quotaUsed: 0,
      quotaLimit: 999999999,
    };
  }

  if (!process.env.DATABASE_URL) {
    const users = readUsersJson();
    const existing = users.find((u) => u.email.toLowerCase() === lowercaseEmail);
    if (existing) {
      existing.quotaUsed += amount;
      writeUsersJson(users);
      return existing;
    }

    const newUser: ServerUser = {
      email: lowercaseEmail,
      quotaUsed: amount,
      quotaLimit: 20,
    };
    users.push(newUser);
    writeUsersJson(users);
    return newUser;
  }

  await initDb();
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
