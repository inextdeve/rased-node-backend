import dbPools from "../db/config/index.js";
import { fitUpdateValues } from "../helpers/utils.js";

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
    all_companies AS (
      SELECT tcn_companies.* FROM tcn_companies
      LEFT JOIN tcn_contracts ON tcn_contracts.companyid = tcn_companies.id
      LEFT JOIN tcn_contractors ON tcn_contractors.id = tcn_companies.contractorid
      WHERE tcn_contractors.id IN (SELECT id FROM linked_contractors) OR tcn_companies.id IN (SELECT id FROM linked_companies) OR tcn_contracts.id IN (SELECT id FROM linked_contracts)
    )
    SELECT 
    all_companies.*,
    CASE 
        WHEN linked_companies.id IS NOT NULL OR linked_contractors.id IS NOT NULL THEN true
        ELSE NULL
    END AS linked
    FROM 
        all_companies
    LEFT JOIN 
    linked_companies ON all_companies.id = linked_companies.id
    LEFT JOIN
    linked_contractors ON all_companies.contractorid = linked_contractors.id
`;

export const ManagmentCompanies = async (req, res) => {
  let db;
  let { contractorId, userId, companyId } = req.query;
  let params = [];
  // For avoid getting companies of another user if not an admin
  if (!req.isAdministrator) {
    userId = req.userId;
    params = [...new Array(6).fill(userId)];
  }

  let query = CorpQuery;

  if (req.isAdministrator) {
    query = `WITH
                  all_companies AS (SELECT tcn_companies.* FROM tcn_companies)
                SELECT all_companies.*, true AS linked FROM all_companies
                `;
  }

  let conditions = [];

  if (contractorId) {
    conditions.push(`all_companies.contractorid = ?`);
    params.push(contractorId);
  }

  if (companyId) {
    conditions.push("all_companies.id = ?");
    params.push(companyId);
  }

  if (conditions.length) {
    query += "WHERE " + conditions.join(" AND ");
  }

  try {
    db = await dbPools.pool.getConnection();
    let data = await db.query(query, params);

    return res.json(data);
  } catch (error) {
    console.log(error);
    return res.status(404).end("Server error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export const companies = async (req, res) => {
  let db;
  let { contractorId, userId } = req.query;

  // For avoid getting companies of another user if not an admin
  if (!req.isAdministrator && userId !== req.userId) {
    userId = req.userId;
  }

  let params = [];
  let conditions = [];

  let query = `SELECT tcn_companies.*, COUNT(tcn_contracts.id) AS contracts FROM tcn_companies
               LEFT JOIN tcn_contracts  ON tcn_companies.id = tcn_contracts.companyid `;

  // Table Joining
  if (userId) {
    query += `LEFT JOIN tcn_user_company ON tcn_user_company.companyid = tcn_companies.id `;
  }

  // Conditions
  if (userId) {
    conditions.push(`tcn_user_company.userid = ? OR tcn_companies.userid = ? `);
    params.push(userId, userId);
  }

  if (contractorId) {
    conditions.push(`tcn_companies.contractorid = ?`);
    params.push(contractorId);
  }

  if (conditions.length) {
    query += "WHERE " + conditions.join(" AND ");
  }

  query += " GROUP BY tcn_companies.id";

  try {
    db = await dbPools.pool.getConnection();
    let data = await db.query(query, params);
    if (data.length > 0) {
      data = data.map((company) => ({
        ...company,
        contracts: parseInt(company.contracts),
      }));
    }

    return res.json(data);
  } catch (error) {
    return res.status(404).end("Server error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export const getCompany = async (req, res) => {
  let db;
  const reqQuery = req.query;

  let query = "SELECT * FROM tcn_companies WHERE id=? AND userid=?";
  const id = req.params.id;

  try {
    if (reqQuery?.get) {
      switch (reqQuery.get) {
        case "contractor":
          query = `SELECT DISTINCT tcn_contractors.* FROM tcn_contractors JOIN tcn_companies ON tcn_companies.contractorid = tcn_contractors.id WHERE tcn_companies.id=${id}`;

          db = await dbPools.pool.getConnection();
          const data = await db.query(query);
          return res.json(data[0]);

        default:
          break;
      }
    }

    db = await dbPools.pool.getConnection();
    const data = await db.query(query, [id, req.userId]);

    return data?.[0] ? res.json(data[0]) : res.status(404).send("Not Found");
  } catch (error) {
    return res.status(400).end("Server error");
  } finally {
    if (db) {
      await db.release();
    }
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

  const updateValues = fitUpdateValues(body, ["id", "userid"]);

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
  const query = `SELECT * FROM tcn_contracts WHERE companyid=? AND userid=?`;

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
  } finally {
    if (db) {
      await db.release();
    }
  }
};
