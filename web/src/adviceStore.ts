const PREFIX = "alfa-recommendation";

export function adviceStorageKey(email: string) {
  return `${PREFIX}:${email}`;
}

export function chatStorageKey(email: string) {
  return `${PREFIX}-chat:${email}`;
}

export function clearAdviceStorage() {
  const drop: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key === PREFIX || key === `${PREFIX}-chat` || (key && key.startsWith(`${PREFIX}:`)) || (key && key.startsWith(`${PREFIX}-chat:`))) {
      drop.push(key);
    }
  }
  for (const key of drop) sessionStorage.removeItem(key);
}
