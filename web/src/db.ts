const DB_NAME = "alfa-cr-db";
const DB_VERSION = 5;

export type DbUser = {
  email: string;
  passwordHash: string;
  lastName: string;
  firstName: string;
  middleName: string;
  phone: string;
  passport: string;
  walletId: string;
  createdAt: number;
  otpChannel?: "sms" | "email";
  frozen?: boolean;
  freezeReason?: string;
};

export type DbTx = {
  id: string;
  email: string;
  name: string;
  amount: number;
  type: "expense" | "income";
  icon: string;
  category: string;
  createdAt: number;
  comment: string;
  status: "done" | "pending";
  counterparty: string;
  balanceAfter: number;
};

export type DbNote = {
  id: string;
  email: string;
  title: string;
  body: string;
  kind: "anomaly" | "transfer" | "security" | "system";
  createdAt: number;
  read: boolean;
};

export type DbContact = {
  id: string;
  email: string;
  name: string;
  phone: string;
  wallet: string;
  initials: string;
  color: string;
  favorite: boolean;
};

export type WalletLimits = {
  day: number;
  month: number;
  op: number;
  abroad: number;
  alertDay: number;
  alertMonth: number;
  alertOp: number;
  alertAbroad: number;
};

export type DbWallet = {
  email: string;
  balance: number;
  savings: { id: string; name: string; amount: number }[];
  biometric: boolean;
  pin: string;
  hideBalance: boolean;
  limits?: WalletLimits;
  usage?: { day: number; month: number; abroad: number };
};

type Mem = {
  users: Map<string, DbUser>;
  wallets: Map<string, DbWallet>;
  txs: Map<string, DbTx>;
  notes: Map<string, DbNote>;
  contacts: Map<string, DbContact>;
};

const mem: Mem = {
  users: new Map(),
  wallets: new Map(),
  txs: new Map(),
  notes: new Map(),
  contacts: new Map(),
};

let useMem = false;
let cached: IDBDatabase | null = null;
let opening: Promise<IDBDatabase | null> | null = null;

function ensureStores(database: IDBDatabase) {
  if (!database.objectStoreNames.contains("users")) database.createObjectStore("users", { keyPath: "email" });
  if (!database.objectStoreNames.contains("wallets")) database.createObjectStore("wallets", { keyPath: "email" });
  if (!database.objectStoreNames.contains("txs")) {
    const txs = database.createObjectStore("txs", { keyPath: "id" });
    txs.createIndex("byEmail", "email", { unique: false });
  }
  if (!database.objectStoreNames.contains("notes")) {
    const notes = database.createObjectStore("notes", { keyPath: "id" });
    notes.createIndex("byEmail", "email", { unique: false });
  }
  if (!database.objectStoreNames.contains("contacts")) {
    const contacts = database.createObjectStore("contacts", { keyPath: "id" });
    contacts.createIndex("byEmail", "email", { unique: false });
  }
}

function openDb(): Promise<IDBDatabase | null> {
  if (useMem) return Promise.resolve(null);
  if (cached) return Promise.resolve(cached);
  if (opening) return opening;

  opening = new Promise((resolve) => {
    let settled = false;
    const finish = (db: IDBDatabase | null) => {
      if (settled) return;
      settled = true;
      if (!db) useMem = true;
      else {
        cached = db;
        db.onversionchange = () => {
          db.close();
          cached = null;
        };
      }
      resolve(db);
    };

    const timer = window.setTimeout(() => finish(null), 1500);
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onblocked = () => {
        try { cached?.close(); } catch { /* ignore */ }
        cached = null;
      };
      req.onupgradeneeded = () => {
        try { ensureStores(req.result); } catch { /* ignore */ }
      };
      req.onsuccess = () => {
        window.clearTimeout(timer);
        const database = req.result;
        if (![...database.objectStoreNames].includes("contacts")) {
          database.close();
          finish(null);
          return;
        }
        finish(database);
      };
      req.onerror = () => {
        window.clearTimeout(timer);
        finish(null);
      };
    } catch {
      window.clearTimeout(timer);
      finish(null);
    }
  }).finally(() => {
    opening = null;
  });

  return opening;
}

function idbReq<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then((database) => {
    if (!database || !database.objectStoreNames.contains(store)) {
      throw new Error("no-store");
    }
    return new Promise<T>((resolve, reject) => {
      try {
        const t = database.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      } catch (e) {
        reject(e);
      }
    });
  });
}

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function byEmail<T extends { email: string }>(map: Map<string, T>, email: string) {
  const key = email.toLowerCase();
  return [...map.values()].filter((x) => x.email.toLowerCase() === key);
}

export const db = {
  async getUser(email: string) {
    const key = email.toLowerCase();
    try {
      return await idbReq<DbUser | undefined>("users", "readonly", (s) => s.get(key));
    } catch {
      return mem.users.get(key);
    }
  },
  async putUser(u: DbUser) {
    const row = { ...u, email: u.email.toLowerCase() };
    mem.users.set(row.email, row);
    try { await idbReq("users", "readwrite", (s) => s.put(row)); } catch { /* mem */ }
  },
  async getWallet(email: string) {
    const key = email.toLowerCase();
    try {
      return await idbReq<DbWallet | undefined>("wallets", "readonly", (s) => s.get(key));
    } catch {
      return mem.wallets.get(key);
    }
  },
  async putWallet(w: DbWallet) {
    const row = { ...w, email: w.email.toLowerCase() };
    mem.wallets.set(row.email, row);
    try { await idbReq("wallets", "readwrite", (s) => s.put(row)); } catch { /* mem */ }
  },
  async putTx(row: DbTx) {
    mem.txs.set(row.id, row);
    try { await idbReq("txs", "readwrite", (s) => s.put(row)); } catch { /* mem */ }
  },
  async putNote(row: DbNote) {
    mem.notes.set(row.id, row);
    try { await idbReq("notes", "readwrite", (s) => s.put(row)); } catch { /* mem */ }
  },
  async putContact(row: DbContact) {
    mem.contacts.set(row.id, row);
    try { await idbReq("contacts", "readwrite", (s) => s.put(row)); } catch { /* mem */ }
  },
  async deleteContact(id: string) {
    mem.contacts.delete(id);
    try { await idbReq("contacts", "readwrite", (s) => s.delete(id)); } catch { /* mem */ }
  },
  async listTxs(email: string) {
    try {
      const all = await idbReq<DbTx[]>("txs", "readonly", (s) => {
        if (s.indexNames.contains("byEmail")) return s.index("byEmail").getAll(email.toLowerCase());
        return s.getAll();
      });
      return (all || []).filter((x) => x.email.toLowerCase() === email.toLowerCase()).sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      return byEmail(mem.txs, email).sort((a, b) => b.createdAt - a.createdAt);
    }
  },
  async listNotes(email: string) {
    try {
      const all = await idbReq<DbNote[]>("notes", "readonly", (s) => {
        if (s.indexNames.contains("byEmail")) return s.index("byEmail").getAll(email.toLowerCase());
        return s.getAll();
      });
      return (all || []).filter((x) => x.email.toLowerCase() === email.toLowerCase()).sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      return byEmail(mem.notes, email).sort((a, b) => b.createdAt - a.createdAt);
    }
  },
  async listContacts(email: string) {
    try {
      const all = await idbReq<DbContact[]>("contacts", "readonly", (s) => {
        if (s.indexNames.contains("byEmail")) return s.index("byEmail").getAll(email.toLowerCase());
        return s.getAll();
      });
      return (all || [])
        .filter((x) => x.email.toLowerCase() === email.toLowerCase())
        .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, "ru"));
    } catch {
      return byEmail(mem.contacts, email).sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, "ru"));
    }
  },
};
