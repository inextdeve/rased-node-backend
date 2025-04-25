import moment from "moment";
import dbPools from "../db/config/index.js";
import { formatHydraulicSessions } from "../helpers/utils.js";

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
          "Session ID": sessionId,
          "Start ID": startId,
          "End ID": endId,
          "Device ID": row.deviceid,
          "Start Time": startTime.toISOString(),
          "End Time": endTime.toISOString(),
          "Duration (min)": duration,
          "Total Distance (m)": totalDistance,
          Latitude: row.latitude,
          Longitude: row.longitude,
          Coordinates: coordinates,
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
