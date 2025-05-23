import dbPools from "../db/config/index.js";
import { fitUpdateValues } from "../helpers/utils.js";

const query = `
   WITH
    linked_contracts AS (
      SELECT tcn_contracts.* FROM tcn_contracts
      LEFT JOIN tcn_user_contract user_contract ON tcn_contracts.id = user_contract.contractid
      WHERE user_contract.userid = 2 OR tcn_contracts.userid = 2
      GROUP BY tcn_contracts.id
    ),
    linked_companies AS (
      SELECT tcn_companies.id FROM tcn_companies
      LEFT JOIN tcn_user_company user_company ON tcn_companies.id = user_company.companyid
      WHERE user_company.userid = 2 OR tcn_companies.userid = 2
      GROUP BY tcn_companies.id
    ),
    linked_contractors AS (
      SELECT tcn_contractors.id FROM tcn_contractors
      LEFT JOIN tcn_user_contractor user_contractor ON tcn_contractors.id = user_contractor.contractorid
      WHERE user_contractor.userid = 2 OR tcn_contractors.userid = 2
      GROUP BY tcn_contractors.id
    ),
    all_contracts AS (
      SELECT tcn_contracts.* FROM tcn_contracts
      LEFT JOIN tcn_companies ON tcn_companies.id = tcn_contracts.companyid
      LEFT JOIN tcn_contractors ON tcn_contractors.id = tcn_companies.contractorid
      WHERE tcn_contractors.id IN (SELECT id FROM linked_contractors) OR tcn_companies.id IN (SELECT id FROM linked_companies) OR tcn_contracts.id IN (SELECT id FROM linked_contracts)
    ),
    all_companies AS (
      SELECT tcn_companies.* FROM tcn_companies
      LEFT JOIN tcn_contracts ON tcn_contracts.companyid = tcn_companies.id
      LEFT JOIN tcn_contractors ON tcn_contractors.id = tcn_companies.contractorid
      WHERE tcn_contractors.id IN (SELECT id FROM linked_contractors) OR tcn_companies.id IN (SELECT id FROM linked_companies) OR tcn_contracts.id IN (SELECT id FROM linked_contracts)
    ),
    all_contractors AS (
      SELECT tcn_contractors.* FROM tcn_contractors
      LEFT JOIN tcn_companies ON tcn_contractors.id = tcn_companies.contractorid
      LEFT JOIN tcn_contracts ON tcn_companies.id = tcn_contracts.companyid
      WHERE tcn_contractors.id IN (SELECT id FROM linked_contractors) OR tcn_companies.id IN (SELECT id FROM linked_companies) OR tcn_contracts.id IN (SELECT id FROM linked_contracts)
    )
SELECT 'contract' AS type,id, name
FROM all_contracts

UNION ALL

SELECT 'company' AS type, id, name
FROM all_companies

UNION ALL

SELECT 'contractor' AS type, id, name
FROM all_contractors;
`;

let CorpQuery = `
   WITH
    linked_contracts AS (
      SELECT tcn_contracts.* FROM tcn_contracts
      LEFT JOIN tcn_user_contract user_contract ON tcn_contracts.id = user_contract.contractid
      WHERE user_contract.userid = ? OR tcn_contracts.userid = ?
      GROUP BY tcn_contracts.id
    ),
    linked_companies AS (
      SELECT tcn_companies.id FROM tcn_companies
      LEFT JOIN tcn_user_company user_company ON tcn_companies.id = user_company.companyid
      WHERE user_company.userid = ? OR tcn_companies.userid = ?
      GROUP BY tcn_companies.id
    ),
    linked_contractors AS (
      SELECT tcn_contractors.id FROM tcn_contractors
      LEFT JOIN tcn_user_contractor user_contractor ON tcn_contractors.id = user_contractor.contractorid
      WHERE user_contractor.userid = ? OR tcn_contractors.userid = ?
      GROUP BY tcn_contractors.id
    ),
    all_contractors AS (
      SELECT tcn_contractors.* FROM tcn_contractors
      LEFT JOIN tcn_companies ON tcn_contractors.id = tcn_companies.contractorid
      LEFT JOIN tcn_contracts ON tcn_companies.id = tcn_contracts.companyid
      WHERE tcn_contractors.id IN (SELECT id FROM linked_contractors) OR tcn_companies.id IN (SELECT id FROM linked_companies) OR tcn_contracts.id IN (SELECT id FROM linked_contracts)
      GROUP BY tcn_contractors.id
      )
  
  SELECT * FROM all_contractors
  
`;

// This function fetch all parent contractors for a user, for example if a user connected just with a company, and we need to fetch the contractor of that company
export const parentContractors = async (req, res) => {
  let db;

  let { userId } = req.query;
  let params = [];

  if (!req.isAdministrator) {
    userId = req.userId;
    params = Array(6).fill(userId);
  } else if (userId) {
    params = Array(6).fill(userId);
  } else {
    CorpQuery = `
      SELECT * FROM tcn_contractors
    `;
  }

  const query = CorpQuery;

  try {
    db = await dbPools.pool.getConnection();

    let data = await db.query(query, params);
    res.json(data);
  } catch (error) {
    res.status(500).send("Server Error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

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
    conditions.push(
      "tcn_user_contractor.userid = ? OR tcn_contractors.userid = ?"
    );
    params.push(userId, userId);
  }

  if (conditions.length) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " GROUP BY tcn_contractors.id";

  try {
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
    return res.status(400).send("Server error");
  } finally {
    if (db) {
      await db.release();
    }
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
  } finally {
    if (db) {
      await db.release();
    }
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
  } finally {
    if (db) {
      await db.release();
    }
  }
};
