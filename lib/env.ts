export interface AppConfig {
  mongodbUri: string;
  mongodbDb: string;
  bodyLimitBytes: number;
  storeLimitBytes: number;
  rateLimitPerMin: number;
  retentionDays: number;
  maxRequestsPerBin: number;
  bodyReadTimeoutMs: number;
  binTtlDays: number;
}

const DEFAULTS: AppConfig = {
  mongodbUri: "mongodb://localhost:27017",
  mongodbDb: "webhook_logger",
  bodyLimitBytes: 1_048_576,
  storeLimitBytes: 262_144,
  rateLimitPerMin: 120,
  retentionDays: 7,
  maxRequestsPerBin: 1000,
  bodyReadTimeoutMs: 10_000,
  binTtlDays: 30,
};

function num(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function readConfig(
  source: Record<string, string | undefined> = process.env
): AppConfig {
  return {
    mongodbUri: source.MONGODB_URI || DEFAULTS.mongodbUri,
    mongodbDb: source.MONGODB_DB || DEFAULTS.mongodbDb,
    bodyLimitBytes: num(source.BODY_LIMIT_BYTES, DEFAULTS.bodyLimitBytes),
    storeLimitBytes: num(source.STORE_LIMIT_BYTES, DEFAULTS.storeLimitBytes),
    rateLimitPerMin: num(source.RATE_LIMIT_PER_MIN, DEFAULTS.rateLimitPerMin),
    retentionDays: num(source.RETENTION_DAYS, DEFAULTS.retentionDays),
    maxRequestsPerBin: num(
      source.MAX_REQUESTS_PER_BIN,
      DEFAULTS.maxRequestsPerBin
    ),
    bodyReadTimeoutMs: num(
      source.BODY_READ_TIMEOUT_MS,
      DEFAULTS.bodyReadTimeoutMs
    ),
    binTtlDays: num(source.BIN_TTL_DAYS, DEFAULTS.binTtlDays),
  };
}

export const config = readConfig();
