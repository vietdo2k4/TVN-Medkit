import mysql from "mysql2/promise";
import "dotenv/config";

export const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
});

pool.on("connection", (conn) => {
    conn.query("SET time_zone = '+07:00'");
});

export default pool;