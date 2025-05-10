import dbPools from "../db/config/index.js";
import {
  fitUpdateValues,
  flatInsertKeys,
  flatInsertValues,
} from "../helpers/utils.js";

export const tags = async (req, res) => {
  let db;
  const {
    cursor,
    limit,
    get,
    count,
    contractorId,
    companyId,
    contractId,
    scanned,
    from,
    to,
    q,
  } = req.query;
  let query;
  let params = [req.userId];

  if (scanned) {
    if (!from || !to) {
      return res
        .status(400)
        .send(
          `Both "from" and "to" parameters are required when "scanned" is specified.`
        );
    }
  } else if (from || to) {
    return res
      .status(400)
      .send(
        `"from" and "to" parameters can only be used with the "scanned" query.`
      );
  }
  /* Set the selected row */
  query = `SELECT tcn_tags.*, tcn_bins.description AS binDescription FROM tcn_tags
           LEFT JOIN tcn_bins ON tcn_tags.binid = tcn_bins.id`;

  if (count) {
    query = `SELECT COUNT(tcn_tags.id) AS COUNT FROM tcn_tags 
              LEFT JOIN tcn_bins ON tcn_tags.binid = tcn_bins.id`;
  } else if (scanned) {
    query = `SELECT tcn_tags.*, tcb_rfid_history.fixtime, tc_devices.name AS deviceName, tcn_bins.description AS binDescription  FROM tcn_tags
        LEFT JOIN tcn_bins ON tcn_tags.binid = tcn_bins.id`;
  }

  /* ***************** */

  if (get === "all") {
    query = "SELECT * FROM tcn_tags WHERE userid=?";
  } else {
    if (contractId || companyId || contractorId) {
      query += ` LEFT JOIN tcn_contracts ON tcn_bins.contractid = tcn_contracts.id`;
    }

    if (companyId && !contractId) {
      query += ` 
      LEFT JOIN tcn_companies ON tcn_contracts.companyid = tcn_companies.id`;
    }

    if (contractorId && !companyId && !contractId) {
      query += ` 
                LEFT JOIN tcn_companies ON tcn_contracts.companyid = tcn_companies.id
                LEFT JOIN tcn_contractors ON tcn_companies.contractorid = tcn_contractors.id`;
    }

    if (scanned) {
      query += ` LEFT JOIN tcb_rfid_history ON tcb_rfid_history.tagid = tcn_tags.id
          LEFT JOIN tc_devices ON tcb_rfid_history.deviceid = tc_devices.id`;
    }

    query += " WHERE tcn_tags.userid=?";

    if (contractId) {
      query += " AND tcn_bins.contractid = ?";
      params.push(contractId);
    }

    if (companyId && !contractId) {
      query += " AND tcn_companies.id = ?";
      params.push(companyId);
    }

    if (contractorId && !companyId && !contractId) {
      query += " AND tcn_contractors.id = ?";
      params.push(contractorId);
    }

    if (scanned) {
      query += " AND tcb_rfid_history.fixtime BETWEEN ? AND ?";
      params.push(from, to);
    }
    if (q) {
      query +=
        " AND (tcn_tags.name LIKE ? OR tcn_bins.description LIKE ? OR tcn_tags.tag_code LIKE ?)";
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const limitValue = limit ? parseInt(limit) : 30;
    const cursorValue = cursor ? parseInt(cursor) : 0;
    query += " LIMIT ? OFFSET ?";
    params.push(limitValue, cursorValue);
  }

  try {
    db = await dbPools.pool.getConnection();
    const tags = await db.query(query, params);

    if (count) return res.json(parseInt(tags[0]["COUNT"]));

    return res.json(tags);
  } catch (error) {
    console.log(error);
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

  const updateValues = fitUpdateValues(body, ["id", "userid"]);

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
