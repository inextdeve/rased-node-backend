import dbPools from "../db/config/index.js";

export const binTagConnection = async (req, res) => {
  let db;

  let { binid, tagid } = req.body;
  try {
    if (binid === undefined || tagid === undefined)
      throw new Error("Bad Request");
    db = await dbPools.pool.getConnection();
    if (binid === null) {
      const getBinId = await db.query("SELECT binid FROM tcn_tags WHERE id=?", [
        tagid,
      ]);

      binid = getBinId[0]?.binid;

      tagid = null;
      if (binid === null) {
        return res.status(200).send("OK");
      }
    }

    await db.query("CALL UpdateBinTagRelationship(?, ?)", [tagid, binid]);
    return res.status(200).send("OK");
  } catch (error) {
    return res.status(400).send("Server Error");
  } finally {
    if (db) {
      db.release();
    }
  }
};
