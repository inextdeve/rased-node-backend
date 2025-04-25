import moment from "moment";
import dbPools from "../db/config/index.js";
import { formatHydraulicSessions } from "../helpers/utils.js";

export const sweepingSessions = async (req, res) => {
  let db;
  let { deviceId, from, to } = req.query;

  // Add query properties zod validation

  let query = `
    SELECT id, fixtime, deviceid, 
           JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.hydraulics')) AS hydraulics,
           JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.io109')) AS io109,
           latitude, longitude
    FROM tc_positions
    WHERE deviceid = ? AND fixtime >= ? AND fixtime <= ?
    ORDER BY fixtime;
  `;

  try {
    db = await dbPools.pool.getConnection();
    const data = await db.query(query, [deviceId, from, to]);
    if (!data.length) {
      return res.status(404).send("No data found");
    }

    const formattedData = data
      .map((row) => ({
        ...row,
        fixtime: moment(row.fixtime).toISOString(),
      }))
      .filter((row) => row.hydraulics);
    console.log("Formatted Data", formattedData);
    const hydraulicSessions = formatHydraulicSessions(formattedData);
    console.log("Sessions");
    res.json(hydraulicSessions);
  } catch (error) {
    res.status(400).send("Fails to fetch sweeping");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export const sweeping = async (req, res) => {
  let db;

  const { speed, groupId, from, to } = req.query;

  const params = [];

  if (!from || !to) {
    return res
      .status(400)
      .send(
        `Both "from" and "to" parameters are required when "empted" is specified.`
      );
  }

  let query = `SELECT AVG(speed) AS avg_speed, MAX(speed) AS max_speed, SUM(JSON_EXTRACT(attributes, '$.distance')/1000) AS total_distance
    FROM tc_positions`;

  if (groupId) {
    query += " WHERE deviceid IN (SELECT id FROM tc_devices WHERE ";

    if (Array.isArray(groupId)) {
      query += groupId.map(() => `groupid = ?`).join(" OR ");
      params.push(...groupId);
    } else {
      query += "groupid = ?";
      params.push(groupId);
    }
    query += ")";
  } else {
    return res.status(400).send("'groupId' params is required");
  }

  if (Number(speed)) {
    query += " AND speed < ?";
    params.push(speed);
  } else {
    return res.status(400).send("'speed' params is required");
  }

  query += " AND fixtime >= ? AND fixtime <= ?";

  params.push(from, to);

  try {
    db = await dbPools.pool.getConnection();
    const data = await db.query(query, params);
    res.json(data);
  } catch (error) {
    res.status(400).send("Fails to fetch sweeping");
  } finally {
    if (db) {
      await db.release();
    }
  }
};
