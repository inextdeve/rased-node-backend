import dbPools from "../db/config/index.js";

export const binTagConnection = async (req, res) => {
  let db;
  console.log(req.body);
  const { binid, tagid } = req.body;
  try {
    if (binid === undefined || tagid === undefined)
      throw new Error("Bad Request");
    db = await dbPools.pool.getConnection();
    await db.query("CALL UpdateBinTagRelationship(?, ?)", [tagid, binid]);
    return res.status(200).send("OK");
  } catch (error) {
    console.log(error);
    return res.status(400).send("Server Error");
  } finally {
    if (db) {
      db.release();
    }
  }
};
