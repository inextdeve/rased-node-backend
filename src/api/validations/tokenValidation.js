import memoryCache from "memory-cache";
import dbPools from "../db/config/index.js";
/**
 * @param {String} token //Token
 * @param {Function} fn //Callback Function
 */

const tokenValidation = async (token, fn) => {
  let db;
  const tokenCache = memoryCache.get(`__TOKEN__${token}`);
  if (tokenCache) {
    return fn(true, null);
  } else {
    const dbQuery = `SELECT id FROM tc_users WHERE attributes LIKE '%"apitoken":"${token}"%'`;

    try {
      db = await dbPools.pool.getConnection();
      const checkExist = await db.query(dbQuery);

      if (checkExist.length) {
        memoryCache.put(`__TOKEN__${token}`, true, 120000);
        return fn(true, null);
      } else {
        throw new Error("Invalid Token");
      }
    } catch (error) {
      return fn(false, { error: error.message });
    } finally {
      if (db) {
        await db.release();
      }
    }
  }
};

export default tokenValidation;
