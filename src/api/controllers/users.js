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
  }
};
