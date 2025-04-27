import moment from "moment";
import dbPools from "../db/config/index.js";
import { formatHydraulicSessions } from "../helpers/utils.js";

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
      SELECT tcn_contracts.id AS contract_id, tcn_contracts.name AS project_name, tcn_contracts.companyid FROM tcn_contracts
      LEFT JOIN tcn_companies ON tcn_companies.id = tcn_contracts.companyid
      LEFT JOIN tcn_contractors ON tcn_contractors.id = tcn_companies.contractorid
      WHERE tcn_contractors.id IN (SELECT id FROM linked_contractors) OR tcn_companies.id IN (SELECT id FROM linked_companies) OR tcn_contracts.id IN (SELECT id FROM linked_contracts)
    ),
  filtered_devices AS (
  SELECT dc.deviceid, dc.contractid, c.companyid, co.contractorid
    FROM tcn_device_contract dc
    JOIN tc_devices d ON dc.deviceid = d.id
    JOIN tcn_contracts c ON dc.contractid = c.id
    JOIN tcn_companies co ON c.companyid = co.id
    WHERE dc.contractid IN (SELECT id FROM all_contracts) AND d.category = 'sweeper' 
`;

export const sweepingSessions = async (req, res) => {
  let db;
  const { deviceId, from, to } = req.query;

  const query = `
    SELECT id, fixtime, deviceid, 
           JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.Brush')) AS brush_status,
           JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.distance')) AS distance,
           latitude, longitude
    FROM tc_positions
    WHERE deviceid = ?
    AND fixtime BETWEEN ? AND ?
    ORDER BY fixtime;
  `;

  try {
    db = await dbPools.pool.getConnection();
    const data = await db.query(query, [deviceId, from, to]);

    const sessions = [];
    let coordinates = [];
    let startTime = null;
    let startId = null;
    let sessionId = 1;
    let totalDistance = 0;

    for (const row of data) {
      const brushStatus = row.brush_status?.toLowerCase() === "true";
      const distance = parseFloat(row.distance) || 0;
      const fixtime = moment(row.fixtime);

      if (brushStatus && !startTime) {
        startTime = fixtime;
        startId = row.id;
        totalDistance = distance;
        coordinates = [[row.latitude, row.longitude]];
      } else if (!brushStatus && startTime) {
        const endTime = fixtime;
        const endId = row.id;
        const duration = moment.duration(endTime.diff(startTime)).asMinutes();

        sessions.push({
          sessionId: sessionId,
          startId: startId,
          endId: endId,
          deviceId: row.deviceid,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          duration: duration, // in minutes
          totalDistance: totalDistance.toFixed(2), // in meters
          latitude: row.latitude,
          longitude: row.longitude,
          coordinates: coordinates,
        });

        startTime = null;
        startId = null;
        totalDistance = 0;
        coordinates = [];
        sessionId += 1;
      } else if (brushStatus) {
        totalDistance += distance;
        coordinates.push([row.latitude, row.longitude]);
      }
    }

    res.json(sessions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
};

export const sweepingSessionsReport = async (req, res) => {
  let db;
  const { deviceId, from, to, userId } = req.query;
  let params = [];

  let query = "";

  const max_distance_threshold = 300;

  if (!req.isAdministrator) {
    userId = req.userId;
    params = Array(6).fill(userId);
  } else if (userId) {
    params = Array(6).fill(userId);
  } else {
    query = `WITH all_devices AS (SELECT tc_devices.id, tc_devices.name FROM tc_devices 
             WHERE tc_devices.category = 'sweeper')
            `;
  }

  query += `
    SELECT  fixtime, deviceid  AS deviceId, 
           JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.Brush')) AS brush_status,
           JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.distance')) AS distance
    FROM tc_positions
    JOIN all_devices fd ON tc_positions.deviceid = fd.id
    WHERE fixtime BETWEEN ? AND ?
    ORDER BY fixtime;
  `;

  try {
    db = await dbPools.pool.getConnection();
    const data = await db.query(query, [from, to]);

    const grouped = {};

    data.forEach((entry) => {
      const { deviceId, distance } = entry;

      if (!grouped[deviceId]) {
        grouped[deviceId] = {
          deviceId,
          totalDistance: 0,
          workSessions: [],
          currentSessionStart: null,
        };
      }

      // Handle brushStatus sessions
      if (entry.brush_status === "true") {
        // Handle distance
        if (distance > max_distance_threshold) {
          grouped[deviceId].totalDistance += max_distance_threshold;
        } else {
          grouped[deviceId].totalDistance += Number(distance);
        }

        if (!grouped[deviceId].currentSessionStart) {
          grouped[deviceId].currentSessionStart = new Date(entry.fixtime);
        }
      } else {
        if (grouped[deviceId].currentSessionStart) {
          const sessionEnd = new Date(entry.fixtime);
          const sessionDuration =
            (sessionEnd - grouped[deviceId].currentSessionStart) / 60000; // ms to minutes
          grouped[deviceId].workSessions.push(sessionDuration);
          grouped[deviceId].currentSessionStart = null;
        }
      }
    });

    // Final result
    const result = Object.values(grouped).map((device) => ({
      deviceId: device.deviceId,
      totalDistance: device.totalDistance.toFixed(2),
      workTime: Math.round(
        device.workSessions.reduce((sum, time) => sum + time, 0)
      ),
    }));
    result.push({
      deviceId: "Total",
      totalDistance: result.reduce(
        (sum, device) => sum + Number(device.totalDistance),
        0
      ),
      workTime: Math.round(
        result.reduce((sum, device) => sum + device.workTime, 0)
      ),
    });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
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
