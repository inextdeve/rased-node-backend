import dbPools from "../db/config/index.js";
import {
  fitUpdateValues,
  flatInsertKeys,
  flatInsertValues,
} from "../helpers/utils.js";

export const tags = async (req, res) => {
  let db;
  const query = "SELECT * FROM tcn_tags WHERE userid=?";
  try {
    db = await dbPools.pool.getConnection();
    const tags = await db.query(query, [req.userId]);
    return res.json(tags);
  } catch (error) {
    return res.status(404).end("Server error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export const getTag = async (req, res) => {
  let db;
  const id = parseInt(req.params.id);
  const reqQuery = req.query;

  console.log(req.userId);

  let query = "SELECT * FROM tcn_tags WHERE id=? AND userid=?";

  try {
    if (reqQuery?.get) {
      switch (reqQuery.get) {
        case "bin":
          query = `SELECT DISTINCT tcn_bins.* FROM tcn_bins JOIN tcn_tags ON tcn_tags.binid = tcn_bins.id WHERE tcn_tags.id=${id}`;
          break;
        default:
          break;
      }
    }

    db = await dbPools.pool.getConnection();
    const data = await db.query(query, [id, req.userId]);
    return res.json(data?.[0] || {});
  } catch (error) {
    console.log(error);

    return res.status(404).end("Server error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export const postRfidTag = async (req, res) => {
  let db;

  const body = req.body;

  const query = `INSERT INTO tcn_tags (${flatInsertKeys(body, [
    "binid",
  ])}, userid) VALUES (${flatInsertValues(body, ["binid"])}, ${req.userId});`;

  try {
    db = await dbPools.pool.getConnection();
    let data = await db.query(query);

    if (body.binid) {
      await db.query("CALL UpdateBinTagRelationship(?, ?)", [
        parseInt(data.insertId),
        body.binid,
      ]);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.log(error);
    res.status(400).end("Server error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

//Update tag
export const putTag = async (req, res) => {
  let db;

  const body = req.body;
  const id = req.params?.id;
  console.log(body);
  const updateValues = fitUpdateValues(body, ["id", "userid"]);

  console.log(updateValues);

  const query = `UPDATE tcn_tags SET ${updateValues} WHERE tcn_tags.id=?`;

  try {
    db = await dbPools.pool.getConnection();
    await db.query(query, [id]);
    return res.status(200).end();
  } catch (error) {
    console.log(error);
    return res.status(400).end("Server error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};
// DELETE TAG
export const deleteTag = async (req, res) => {
  let db;

  const id = parseInt(req.params.id);

  const query = `DELETE FROM tcn_tags WHERE tcn_tags.id=? AND tcn_tags.userid=?`;

  try {
    db = await dbPools.pool.getConnection();
    await db.query(query, [id, req.userId]);
    return res.status(200).end();
  } catch (error) {
    return res.status(400).end("Server error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};
