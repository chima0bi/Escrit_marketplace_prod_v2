import mongoose from "mongoose";
import { env } from "./env.js";
import { User } from "../models/User.js";

export async function connectDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongodbUri);
  console.log("[db] connected");
  await migrateUserIndexes();
}

// One-time, idempotent: replace the old sparse googleId_1 index (which rejects a
// second email/password user because it indexes null) with the partial unique index.
async function migrateUserIndexes() {
  try {
    const indexes = await User.collection.indexes().catch(() => []);
    if (indexes.some((index) => index.name === "googleId_1")) {
      await User.collection.dropIndex("googleId_1");
      console.log("[db] dropped legacy googleId_1 index");
    }
    await User.createIndexes();
  } catch (err) {
    console.error("[db] user index migration failed", err);
  }
}
