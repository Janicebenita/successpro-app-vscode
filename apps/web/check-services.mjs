import mysql from "mysql2/promise";
import { createClient } from "redis";

async function check() {
  console.log("Checking Redis on 127.0.0.1:6380 with Lua...");
  try {
    const redis = createClient({ url: "redis://127.0.0.1:6380" });
    await redis.connect();
    const ping = await redis.ping();
    console.log("Redis ping:", ping);
    const luaRes = await redis.eval("return 42");
    console.log("Redis Lua execution successful! Result:", luaRes);
    await redis.disconnect();
  } catch (err) {
    console.error("Redis connection/Lua failed:", err.message);
  }

  console.log("Checking MySQL on 127.0.0.1:3307...");
  try {
    const conn = await mysql.createConnection("mysql://successpro:successpro@127.0.0.1:3307/successpro_local");
    console.log("MySQL connected successfully!");
    const [rows] = await conn.query("SHOW TABLES");
    console.log("Tables count:", rows.length);
    await conn.end();
  } catch (err) {
    console.error("MySQL connection failed:", err.message);
  }
}

check();
