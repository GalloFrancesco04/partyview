const PV_TAG = "PartyView";

export function pvLog(...args) {
  try {
    console.log(PV_TAG, "|", ...args);
  } catch {}
}

export function pvDebug(...args) {
  try {
    const enabled = globalThis.game?.settings?.get?.(
      "partyview",
      "debugLogging",
    );
    if (enabled) console.log(PV_TAG, "|", ...args);
  } catch {}
}

export function pvWarn(...args) {
  try {
    console.warn(PV_TAG, "|", ...args);
  } catch {}
}

export function pvError(...args) {
  try {
    console.error(PV_TAG, "|", ...args);
  } catch {}
}

export function getProp(obj, path) {
  try {
    return path.split(".").reduce((o, k) => o?.[k], obj);
  } catch {
    return undefined;
  }
}

export function formatAbbrev(n) {
  const val = Number(n ?? 0);
  if (val < 1000) return String(val);
  const useDecimal = val < 10000;
  const str = (val / 1000).toFixed(useDecimal ? 1 : 0);
  return `${str.replace(/\.0$/, "")}k`;
}
