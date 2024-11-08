import dbPools from "../db/config/index.js";
import { fitUpdateValues } from "../helpers/utils.js";

export const companies = async (req, res) => {
  let db;

  let query = `SELECT tcn_companies.*,
                 COUNT(tcn_contracts.id) AS contracts
                 FROM tcn_companies
                 LEFT JOIN tcn_contracts  ON tcn_companies.id = tcn_contracts.companyid
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
    console.log("Ther is error", "error");
    return res.status(404).end("Server error");
  }
};

export const getCompany = async (req, res) => {
  let db;
  const query = "SELECT * FROM tcn_companies WHERE id=";
  const id = req.params.id;

  try {
    db = await dbPools.pool.getConnection();
    const data = await db.query(query, [id]);
    return res.json(data);
  } catch (error) {
    return res.status(404).end("Server error");
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

  const query = `INSERT INTO tcn_companies (${flatKeys}) VALUES (${flatValues});`;

  try {
    db = await dbPools.pool.getConnection();
    await db.query(query, [flatValues]);

    res.status(200).json({
      sccuess: true,
      message: "Entries added successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(400).end("Server error");
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

  console.log(id);
  console.log(body);
  const updateValues = fitUpdateValues(body);

  const query = `UPDATE tcn_companies SET ${updateValues} WHERE tcn_companies.id=?`;
  console.log(query);
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

export const getCompanyContracts = async (req, res) => {
  console.log("GET COMPANY CONTRACTS");
  let db;
  const id = req.params.id;
  const query = `SELECT * FROM tcn_contracts WHERE companyid=?`;

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
