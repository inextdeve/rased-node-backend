import dbPools from "../db/config/index.js";

export const userOwner = async (req, res) => {
  let db;
  const reqQuery = req.query;
  console.log(reqQuery);
  return res.end("Yes");
  const query = "SELECT * FROM tcn_bins";

  try {
    db = await dbPools.pool.getConnection();
    const data = await db.query(query);
  } catch (error) {}
};
