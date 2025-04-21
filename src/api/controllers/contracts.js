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
    all_contracts AS (
      SELECT tcn_contracts.* FROM tcn_contracts
      LEFT JOIN tcn_companies ON tcn_companies.id = tcn_contracts.companyid
      LEFT JOIN tcn_contractors ON tcn_contractors.id = tcn_companies.contractorid
      WHERE tcn_contractors.id IN (SELECT id FROM linked_contractors) OR tcn_companies.id IN (SELECT id FROM linked_companies) OR tcn_contracts.id IN (SELECT id FROM linked_contracts)
    )
  SELECT * FROM all_contracts
`;

export const ManagmentContracts = async (req, res) => {
  let db;
  let { companyId, userId } = req.query;
  let params = [];
  // For avoid getting companies of another user if not an admin
  if (!req.isAdministrator) {
    userId = req.userId;
    params = [...new Array(6).fill(userId)];
  }
  if (req.isAdministrator) {
    CorpQuery = `WITH
                  all_contracts AS (SELECT tcn_contracts.* FROM tcn_contracts)
                SELECT * FROM all_contracts
                `;
  }
  let query = CorpQuery;
  let conditions = [];
  if (companyId) {
    conditions.push(`all_contracts.companyid = ?`);
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

export const contracts = async (req, res) => {
  let db;

  let { userId, companyId } = req.query;

  let params = [];

  let conditions = [];

  let query = `SELECT tcn_contracts.*, tcn_contractors.id AS contractorId FROM tcn_contracts 
                LEFT JOIN tcn_companies ON tcn_contracts.companyid = tcn_companies.id
                LEFT JOIN tcn_contractors on tcn_companies.contractorid = tcn_contractors.id `;

  // For avoid getting contracts of another user if not an admin
  if (!req.isAdministrator && userId !== req.userId) {
    userId = req.userId;
  }

  // Join Tables
  if (userId) {
    query += `LEFT JOIN tcn_user_contract ON tcn_user_contract.contractid = tcn_contracts.id `;
  }

  // Conditions
  if (userId) {
    conditions.push("tcn_user_contract.userid = ? OR tcn_contracts.userid = ?");
    params.push(userId, userId);
  }

  if (companyId) {
    conditions.push("tcn_contracts.companyid = ? ");
    params.push(companyId);
  }

  if (conditions.length) {
    query += "WHERE " + conditions.join(" AND ");
  }

  try {
    db = await dbPools.pool.getConnection();
    const data = await db.query(query, params);
    return res.json(data);
  } catch (error) {
    console.log(error);
    return res.status(404).end("Cannot fetch contracts");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export const getContract = async (req, res) => {
  let db;

  const reqQuery = req.query;

  const id = req.params.id;

  let query = `SELECT tcn_contracts.*, tcn_companies.name AS company_name FROM tcn_contracts JOIN tcn_companies ON tcn_companies.id = tcn_contracts.companyid  WHERE tcn_contracts.id=${Number(
    id
  )}`;
  //Check if the user request just a related element to contract like if he want just the company related to it
  try {
    if (reqQuery?.get) {
      if (reqQuery.get === "company") {
        query = `SELECT DISTINCT tcn_companies.* FROM tcn_companies JOIN tcn_contracts ON tcn_contracts.companyid = tcn_companies.id WHERE tcn_contracts.id=${id}`;

        db = await dbPools.pool.getConnection();
        const data = await db.query(query);
        return res.json(data[0]);
      }

      if (reqQuery.get === "devices") {
        query = `SELECT 
                      d.name,d.id
                  FROM 
                      tcn_device_contract dc
                  JOIN 
                      tc_devices d ON dc.deviceid = d.id
                  WHERE 
                      dc.contractid = ?;`;

        db = await dbPools.pool.getConnection();
        const data = await db.query(query, [id]);
        return res.json(data);
      }
    }

    db = await dbPools.pool.getConnection();
    const data = await db.query(query);
    if (data.length) return res.json(data[0]);
    else throw new Error("Not Found");
  } catch (error) {
    return res.status(404).end(error.message || "Server Error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export const putContract = async (req, res) => {
  let db;

  const body = req.body;
  const id = req.params.id;

  let query;

  const updateKeys = Object.keys(body)
    .map((key) => `${key}=?`)
    .join(", ");

  for (let key in body) {
    if (key === "end_date" || key === "start_date") {
      body[key] = body[key]?.split(".")[0] || null;
    }
  }

  const updateValues = Object.values(body);
  updateValues.push(id);

  query = `UPDATE tcn_contracts SET ${updateKeys} WHERE tcn_contracts.id=?`;

  try {
    db = await dbPools.pool.getConnection();

    if (Array.isArray(body.devices)) {
      // Delete existing links for these devices
      const deleteQuery = `
        DELETE FROM tcn_device_contract
        WHERE contractid = ?;
      `;
      await db.query(deleteQuery, [id]);

      // Prepare bulk insert values
      const values = body.devices.map((deviceId) => [Number(id), deviceId]);

      // Insert new links
      const insertQuery = `
    INSERT INTO tcn_device_contract (contractid, deviceid)
    VALUES (?, ?);
  `;

      await db.batch(insertQuery, values);
      return res.status(200).send("OK");
    }

    await db.query(query, updateValues);

    return res.status(200).end();
  } catch (error) {
    return res.status(400).end("Server error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export const postContract = async (req, res) => {
  let db;

  const body = req.body;

  const flatValues = Object.values(body)
    .map((v) => {
      if (typeof v === "string") return `"${v}"`;
      if (typeof v === "object") return `'${JSON.stringify(v)}'`;
      return v;
    })
    .join(",");

  console.log(flatValues);

  const flatKeys = Object.keys(body).join(", ");

  const query = `INSERT INTO tcn_contracts (${flatKeys}, userid) VALUES (${flatValues}, ${req.userId});`;

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

export const deleteContract = async (req, res) => {
  let db;
  const query = "DELETE FROM tcn_contracts WHERE id=?";
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
