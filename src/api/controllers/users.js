import dbPools from "../db/config/index.js";

export const getUser = async (req, res) => {
  let db;

  //GET TODAY STATUS
  const id = parseInt(req.params.id) || "0";

  let query = `SELECT * FROM tc_users WHERE tc_users.id = ${id}`;
  let data;
  try {
    db = await dbPools.pool.getConnection();
    data = await db.query(query);
    if (data.length) {
      return res.json(data[0]);
    }
    return res.status(404).json({});
  } catch (error) {
    return res.status(400).end();
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export const isTokenUnique = async (req, res) => {
  let db;
  const token = req.query?.token;
  const userId = req.query?.userId;

  if (!token) return res.status(400).send("No token is given");
  const dbQuery = `SELECT id FROM tc_users WHERE attributes LIKE '%"apitoken":"${token}"%' AND id != ${userId}`;

  try {
    db = await dbPools.pool.getConnection();
    const data = await db.query(dbQuery);

    if (data.length && data[0].id !== Number(userId)) {
      throw new Error("Already Exist");
    }
    res.status(200).send("OK");
  } catch (error) {
    console.log(error);
    res.status(403).send("Already Exist");
  } finally {
    if (db) {
      await db.release();
    }
  }
};
