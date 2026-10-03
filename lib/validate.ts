const BIN_ID_RE = /^[a-f0-9]{32}$/;
const REQUEST_ID_RE = /^[a-f0-9]{24}$/;

export function isValidBinId(value: unknown): value is string {
  return typeof value === "string" && BIN_ID_RE.test(value);
}

export function isValidRequestId(value: unknown): value is string {
  return typeof value === "string" && REQUEST_ID_RE.test(value);
}
