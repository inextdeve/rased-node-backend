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
    return fn(true, tokenCache, null);
  } else {
    const dbQuery = `SELECT id, administrator FROM tc_users WHERE attributes LIKE '%"apitoken":"${token}"%'`;

    try {
      db = await dbPools.pool.getConnection();
      const checkExistUser = await db.query(dbQuery);

      if (checkExistUser.length) {
        memoryCache.put(`__TOKEN__${token}`, checkExistUser[0].id, 120000);
        return fn(true, checkExistUser[0], null);
      } else {
        throw new Error("Invalid Token");
      }
    } catch (error) {
      return fn(false, null, { error: error.message });
    } finally {
      if (db) {
        await db.release();
      }
    }
  }
};

export default tokenValidation;
