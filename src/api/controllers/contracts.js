import dbPools from "../db/config/index.js";
import { fitUpdateValues } from "../helpers/utils.js";

export const contracts = async (req, res) => {
  let db;

  const query = "SELECT * FROM tcn_contracts";

  try {
    db = await dbPools.pool.getConnection();
    const data = await db.query(query);
    return res.json(data);
  } catch (error) {
    return res.status(404).end("Server error");
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
      switch (reqQuery.get) {
        case "company":
          query = `SELECT DISTINCT tcn_companies.* FROM tcn_companies JOIN tcn_contracts ON tcn_contracts.companyid = tcn_companies.id WHERE tcn_contracts.id=${id}`;

          db = await dbPools.pool.getConnection();
          const data = await db.query(query);
          return res.json(data[0]);

        default:
          break;
      }
    }

    db = await dbPools.pool.getConnection();
    const data = await db.query(query);
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

export const putContract = async (req, res) => {
  let db;

  const body = req.body;
  const id = req.params.id;

  const updateValues = fitUpdateValues(body);

  const query = `UPDATE tcn_contracts SET ${updateValues} WHERE tcn_contracts.id=?`;

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
