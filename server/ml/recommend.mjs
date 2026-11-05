import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ML_DIR = path.dirname(fileURLToPath(import.meta.url));

function pythonBin() {
  return process.env.PYTHON || "python";
}

export function recommendClient(transactions, { text = true, messages = null, recommendation = "" } = {}) {
  const rows = (transactions || []).map((tx) => ({
    amount: tx.amount,
    category: tx.category || "",
    name: tx.name || "",
    createdAt: tx.createdAt,
    mcc_code: tx.mcc_code,
    mcc_description: tx.mcc_description,
    tr_datetime: tx.tr_datetime,
    day: tx.day,
    hour: tx.hour,
  }));
  return new Promise((resolve) => {
    let out = "";
    let err = "";
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    let child;
    try {
      child = spawn(pythonBin(), [path.join(ML_DIR, "recommend_infer.py")], {
        windowsHide: true,
        env: { ...process.env, PYTHONWARNINGS: "ignore" },
      });
    } catch (e) {
      finish({ error: "Рекомендация сейчас недоступна" });
      return;
    }
    const timer = setTimeout(() => {
      child.kill();
      finish({ error: "Рекомендация не успела собраться" });
    }, 90000);
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { err += chunk; });
    child.on("error", () => {
      clearTimeout(timer);
      finish({ error: "Рекомендация сейчас недоступна" });
    });
    child.on("close", () => {
      clearTimeout(timer);
      const start = out.search(/[\[{]/);
      try {
        finish(JSON.parse(start >= 0 ? out.slice(start) : out));
      } catch {
        console.warn("[ml] recommend failed:", err.slice(0, 400));
        finish({ error: "Рекомендация сейчас недоступна" });
      }
    });
    const payload = { transactions: rows, text };
    if (messages) {
      payload.messages = messages;
      payload.recommendation = recommendation || "";
      payload.text = false;
    }
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}
