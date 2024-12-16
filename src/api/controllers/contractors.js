import dbPools from "../db/config/index.js";
import { fitUpdateValues } from "../helpers/utils.js";

export const contractors = async (req, res) => {
  let db;

  let { userId } = req.query;
  let query = "";
  let params = [];
  let conditions = [];

  query = `SELECT tcn_contractors.*, COUNT(tcn_companies.id) AS companies FROM tcn_contractors
                 LEFT JOIN tcn_companies ON tcn_contractors.id = tcn_companies.contractorid `;

  // For avoid getting contracts of another user if not an admin
  if (!req.isAdministrator && userId !== req.userId) {
    userId = req.userId;
  }

  // Joining Tables
  if (userId) {
    query += `LEFT JOIN tcn_user_contractor ON tcn_user_contractor.contractorid = tcn_contractors.id`;
  }

  // Conditions
  if (userId) {
    conditions.push("tcn_user_contractor.userid = ?");
    params.push(userId);
  }

  if (conditions.length) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += "GROUP BY tcn_contractors.id";

  try {
    console.log("GET_CONTRACTORS");
    db = await dbPools.pool.getConnection();

    let data = await db.query(query, params);
    //Try to remove this cause not compatible
    if (data.length > 0) {
      data = data.map((contractor) => ({
        ...contractor,
        companies: parseInt(contractor?.companies || 0),
      }));
    }

    return res.json(data);
  } catch (error) {
    console.log(error);
    return res.status(400).send("Server error");
  }
};

export const getContractor = async (req, res) => {
  let db;
  const query = "SELECT * FROM tcn_contractors WHERE id=? AND userid=?";
  const id = req.params.id;

  try {
    db = await dbPools.pool.getConnection();
    const data = await db.query(query, [id, req.userId]);
    return res.json(data);
  } catch (error) {
    return res.status(404).send("Server error");
  }
};

export const postContractor = async (req, res) => {
  let db;

  const body = req.body;

  const flatValues = Object.values(body)
    .map((v) => {
      if (typeof v === "string") return `"${v}"`;
      return v;
    })
    .join(",");

  const flatKeys = Object.keys(body).join(", ");

  const query = `INSERT INTO tcn_contractors (${flatKeys}, userid) VALUES (${flatValues}, ${req.userId});`;

  try {
    db = await dbPools.pool.getConnection();
    await db.query(query);

    res.status(200).send("OK");
  } catch (error) {
    res.status(400).send("Server error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};
// PUT UPDATE
export const putContractor = async (req, res) => {
  let db;

  const body = req.body;
  const id = req.params.id;

  const updateValues = fitUpdateValues(body);

  const query = `UPDATE tcn_contractors SET ${updateValues} WHERE tcn_contractors.id=? AND tcn_contractors.userid=?`;

  try {
    db = await dbPools.pool.getConnection();
    await db.query(query, [id, req.userId]);
    return res.status(200).send("OK");
  } catch (error) {
    return res.status(400).send("Server error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export const getContractorCompanies = async (req, res) => {
  let db;
  const id = req.params.id;
  const query = `SELECT * FROM tcn_companies WHERE contractorid=?`;

  try {
    db = await dbPools.pool.getConnection();
    let data = await db.query(query, [id]);
    return res.json(data);
  } catch (error) {
    return res.status(404).end("Server error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export const deleteContractor = async (req, res) => {
  let db;
  const query = "DELETE FROM tcn_contractors WHERE id=?";
  const id = req.params.id;

  try {
    db = await dbPools.pool.getConnection();
    await db.query(query, [id]);
    return res.status(200).end();
  } catch (error) {
    return res.status(404).end("Server error");
  }
};
