import { MongoClient, type Db } from "mongodb";
import { config } from "./env";

const globalForMongo = globalThis as unknown as {
  _mongoClientPromise?: Promise<MongoClient>;
  _mongoIndexesPromise?: Promise<void>;
};

function getClient(): Promise<MongoClient> {
  if (!globalForMongo._mongoClientPromise) {
    globalForMongo._mongoClientPromise = new MongoClient(
      config.mongodbUri
    )
      .connect()
      .catch((err) => {
        // A cached rejection would permanently brick the process.
        delete globalForMongo._mongoClientPromise;
        throw err;
      });
  }
  return globalForMongo._mongoClientPromise;
}

function ensureIndexes(db: Db): Promise<void> {
  if (!globalForMongo._mongoIndexesPromise) {
    globalForMongo._mongoIndexesPromise = (async () => {
      const bins = db.collection("bins");
      await bins.createIndex({ token: 1 }, { unique: true });
      await bins.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: config.binTtlDays * 86_400 }
      );
      const requests = db.collection("requests");
      await requests.createIndex({ binId: 1, receivedAt: -1 });
      await requests.createIndex(
        { receivedAt: 1 },
        { expireAfterSeconds: config.retentionDays * 86_400 }
      );
    })().catch((err) => {
      delete globalForMongo._mongoIndexesPromise;
      throw err;
    });
  }
  return globalForMongo._mongoIndexesPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  const db = client.db(config.mongodbDb);
  await ensureIndexes(db);
  return db;
}
