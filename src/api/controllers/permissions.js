import dbPools from "../db/config/index.js";
import {
  insertPermission,
  deletePermission,
} from "../helpers/controllersHelper.js";

export const POST_PERMISSION = async (req, res) => {
  let db;
  const { userId, contractorId, companyId, contractId } = req.body;

  if (!userId) {
    return res.status(400).send("'UserId' parameters is required");
  }

  try {
    db = await dbPools.pool.getConnection();

    if (contractorId) {
      await insertPermission(
        db,
        "tcn_user_contractor",
        ["userid", "contractorid"],
        [userId, contractorId]
      );
      return res.send("OK");
    }
    if (companyId) {
      await insertPermission(
        db,
        "tcn_user_company",
        ["userid", "companyid"],
        [userId, companyId]
      );
      return res.send("OK");
    }
    if (contractId) {
      await insertPermission(
        db,
        "tcn_user_contract",
        ["userid", "contractid"],
        [userId, contractId]
      );
      return res.send("OK");
    }

    return res.status(400).send("Unknown Error");
  } catch (error) {
    console.log(error);
    return res.status(400).end("Cannot add permission");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export const DELETE_PERMISSION = async (req, res) => {
  let db;
  const { userId, contractorId, companyId, contractId } = req.body;

  if (!userId) {
    return res.status(400).send("'UserId' parameters is required");
  }

  try {
    db = await dbPools.pool.getConnection();

    if (contractorId) {
      await deletePermission(
        db,
        "tcn_user_contractor",
        ["userid", "contractorid"],
        [userId, contractorId]
      );
      return res.send("OK");
    }
    if (companyId) {
      await deletePermission(
        db,
        "tcn_user_company",
        ["userid", "companyid"],
        [userId, companyId]
      );
      return res.send("OK");
    }
    if (contractId) {
      await deletePermission(
        db,
        "tcn_user_contract",
        ["userid", "contractid"],
        [userId, contractId]
      );
      return res.send("OK");
    }

    return res.status(400).send("Unknown Error");
  } catch (error) {
    console.log(error);
    return res.status(400).end("Cannot add permission");
  } finally {
    if (db) {
      await db.release();
    }
  }
};
