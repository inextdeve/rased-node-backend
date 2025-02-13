import mariadb from "mariadb";
import dotenv from "dotenv";

dotenv.config();

export default Object.freeze({
  pool: mariadb.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    connectionLimit: 250,
    queueLimit: 0,
  }),
});
