const items = new Map();

export function fillVault(data) {
  items.clear();
  if (!data || typeof data !== 'object') return;
  for (const [name, value] of Object.entries(data)) items.set(name, value);
}

export const vaultItem = (name) => items.get(name) ?? null;
