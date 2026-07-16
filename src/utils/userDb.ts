import fs from "fs";
import path from "path";

export interface ServerUser {
  email: string;
  quotaUsed: number;
  quotaLimit: number;
}

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "users.json");

function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), "utf8");
  }
}

export function getUsers(): ServerUser[] {
  initDb();
  try {
    const data = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

export function getOrCreateUser(email: string): ServerUser {
  initDb();
  const users = getUsers();
  let user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    user = {
      email: email.toLowerCase(),
      quotaUsed: 0,
      quotaLimit: 20
    };
    users.push(user);
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2), "utf8");
  }
  return user;
}

export function incrementUserQuota(email: string, amount: number): ServerUser {
  initDb();
  const users = getUsers();
  const index = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

  if (index === -1) {
    const newUser = {
      email: email.toLowerCase(),
      quotaUsed: amount,
      quotaLimit: 20
    };
    users.push(newUser);
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2), "utf8");
    return newUser;
  }

  users[index].quotaUsed += amount;
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2), "utf8");
  return users[index];
}
