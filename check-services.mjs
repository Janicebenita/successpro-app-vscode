import mysql from "mysql2/promise";
import { createClient } from "redis";

async function check() {
  console.log("Checking Redis on 127.0.0.1:6380...");
  try {
    const redis = createClient({ url: "redis://127.0.0.1:6380" });
    await redis.connect();
    console.log("Redis connected successfully! Ping:", await redis.ping());
    await redis.disconnect();
  } catch (err) {
    console.error("Redis connection failed:", err.message);
  }

  console.log("Checking MySQL on 127.0.0.1:3307...");
  try {
    const conn = await mysql.createConnection("mysql://successpro:successpro@127.0.0.1:3307/successpro_local");
    console.log("MySQL connected successfully!");
    const [rows] = await conn.query("SHOW TABLES");
    console.log("Tables:", rows);
    await conn.end();
  } catch (err) {
    console.error("MySQL connection failed:", err.message);
  }
}

check();
