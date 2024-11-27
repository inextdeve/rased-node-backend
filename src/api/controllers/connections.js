import dbPools from "../db/config/index.js";

export const binTagConnection = async (req, res) => {
  let db;

  let { binid, tagid } = req.body;
  try {
    if (binid === undefined || tagid === undefined)
      throw new Error("Bad Request");

    db = await dbPools.pool.getConnection();

    if (binid === null) {
      const getBinId = await db.query("SELECT id FROM tcn_bins WHERE tagid=?", [
        tagid,
      ]);

      binid = getBinId[0]?.id;

      tagid = null;

      if (!binid) {
        return res.status(200).send("OK");
      } else {
        await db.query("UPDATE tcn_bins SET tagid=? WHERE id", [null, binid]);
        return res.status(200).send("OK");
      }
    }

    console.log("Update connections ", { binid, tagid });

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
