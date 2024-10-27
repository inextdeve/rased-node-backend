// Controllers for centers
import dbPools from "../db/config/index.js";
import { flatArray } from "../helpers/utils.js";

export const centers = async (req, res) => {
  let db;
  const query =
    "SELECT tcn_centers.id, tcn_centers.center_name FROM tcn_centers";
  try {
    db = await dbPools.pool.getConnection();
    const dbQuery = await db.query(query);
    res.json(dbQuery);
  } catch (error) {
    res.status(400).end();
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export const editCenter = async (req, res) => {
  let db;

  const body = req.body;

  try {
    db = await dbPools.pool.getConnection();
    const query = `SELECT tcn_centers.id FROM tcn_centers WHERE tcn_centers.id='${body.id}'`;
    const targetExist = await db.query(query);

    if (!targetExist?.length) {
      throw new Error("You try to modify a none exist element");
    }

    let keyValue = "";

    Object.keys(body).forEach((key, index, array) => {
      // Skip the id_bin
      if (key === "id") return;

      keyValue += `${key}='${body[key]}'`;

      if (index === array.length - 1) return;

      keyValue += ",";
    });

    const updateQuery = `UPDATE tcn_centers SET ${keyValue} WHERE tcn_centers.id='${body.id}'`;

    await db.query(updateQuery);

    res
      .status(204)
      .json({ success: true, message: "Item updated successfully" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export const addCenter = async (req, res) => {
  let db;
  const body = req.body;
  delete body.id;

  try {
    db = await dbPools.pool.getConnection();
    const values = flatArray(Object.values(body));
    const keys = Object.keys(body).join(", ");

    const query = `INSERT INTO tcn_centers (${keys}) VALUES (${values})`;

    await db.query(query);

    res.json({ sccuess: true, message: "Entries added successfully" });
  } catch (error) {
    res.status(400).json({ success: false, message: "Cannot add entries" });
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export const deleteCenter = async (req, res) => {
  const body = req.body;

  let db;
  // body.selected contains ids of bins you want to delete

  // Create query

  try {
    db = await dbPools.pool.getConnection();
    if (body.selected.length > 10) {
      throw new Error(
        "You cannot delete more than 10 items for security reasons"
      );
    }

    // throw new Error("This operation is currently blocked for security reasons");
    const targetIds = Object.values(body.selected).join(", ");

    const query = `DELETE FROM tcn_centers WHERE tcn_centers.id IN (${targetIds});`;

    await db.query(query);

    res.status(200).json({
      success: true,
      message: "Entries deleted successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  } finally {
    if (db) {
      await db.release();
    }
  }
};
