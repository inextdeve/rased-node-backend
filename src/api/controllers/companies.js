import dbPools from "../db/config/index.js";
import { fitUpdateValues } from "../helpers/utils.js";

export const companies = async (req, res) => {
  let db;

  let query = `SELECT tcn_companies.*,
                 COUNT(tcn_contracts.id) AS contracts
                 FROM tcn_companies
                 LEFT JOIN tcn_contracts  ON tcn_companies.id = tcn_contracts.companyid
                 WHERE tcn_companies.userid = ${req.userId}
                 GROUP BY tcn_companies.id`;

  try {
    db = await dbPools.pool.getConnection();
    let data = await db.query(query);
    if (data.length > 0) {
      data = data.map((company) => ({
        ...company,
        contracts: parseInt(company.contracts),
      }));
    }

    return res.json(data);
  } catch (error) {
    return res.status(404).end("Server error");
  }
};

export const getCompany = async (req, res) => {
  let db;
  const query = "SELECT * FROM tcn_companies WHERE id=? AND userid=?";
  const id = req.params.id;

  try {
    db = await dbPools.pool.getConnection();
    const data = await db.query(query, [id, req.userId]);

    return data?.[0] ? res.json(data[0]) : res.status(404).send("Not Found");
  } catch (error) {
    return res.status(400).end("Server error");
  }
};

export const postCompany = async (req, res) => {
  let db;

  const body = req.body;

  const flatValues = Object.values(body)
    .map((v) => {
      if (typeof v === "string") return `"${v}"`;
      return v;
    })
    .join(",");

  const flatKeys = Object.keys(body).join(", ");

  const query = `INSERT INTO tcn_companies (${flatKeys}, userid) VALUES (${flatValues}, ${req.userId});`;

  try {
    db = await dbPools.pool.getConnection();
    await db.query(query, [flatValues]);

    res.status(200).send("OK");
  } catch (error) {
    console.log(error);
    res.status(400).send("Server error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};
// PUT UPDATE
export const putCompany = async (req, res) => {
  let db;

  const body = req.body;
  const id = req.params.id;

  const updateValues = fitUpdateValues(body, ["contractorid", "id", "userid"]);

  const query = `UPDATE tcn_companies SET ${updateValues} WHERE tcn_companies.id=? AND tcn_companies.userid=?`;

  try {
    db = await dbPools.pool.getConnection();
    await db.query(query, [id, req.userId]);
    return res.status(200).send();
  } catch (error) {
    return res.status(400).send("Server error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export const getCompanyContracts = async (req, res) => {
  let db;
  const id = req.params.id;
  const query = `SELECT * FROM tcn_contracts WHERE companyid=?`;

  try {
    db = await dbPools.pool.getConnection();
    let data = await db.query(query, [id, req.userId]);
    return res.json(data);
  } catch (error) {
    return res.status(404).end("Server error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export const deleteCompany = async (req, res) => {
  let db;
  const query = "DELETE FROM tcn_companies WHERE id=?";
  const id = req.params.id;

  try {
    db = await dbPools.pool.getConnection();
    await db.query(query, [id]);
    return res.status(200).end();
  } catch (error) {
    return res.status(404).end("Server error");
  }
};
