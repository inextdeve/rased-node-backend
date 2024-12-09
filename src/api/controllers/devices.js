import dbPools from "../db/config/index.js";
import { TODAY } from "../helpers/constants.js";
import { date, string, z } from "zod";
import { dateTimeParamsSchema } from "../validations/zodSchemas.js";
import { countRate } from "../helpers/utils.js";

const NearbyStopsBodySchema = z.object({
  latitude: z.union([z.string(), z.number()]),
  longitude: z.union([z.string(), z.number()]),
  devices: string(),
  distance: z.union([z.string(), z.number()]),
  from: date(),
  to: date().optional(),
});

export const reportDevices = async (req, res) => {
  let db;
  // Extract parameters from the query string
  const { from, to, groupId, deviceId, ignition, geofences } = req.query;

  // Check if both 'from' and 'to' are provided
  if (!from || !to) {
    return res
      .status(400)
      .json({ error: "'from' and 'to' parameters are required." });
  }

  //Get Max And Min ID
  let minMaxId = {};
  try {
    db = await dbPools.pool.getConnection();

    const data = await db.query(`SELECT 
    MIN(id) AS smallest_id,
    MAX(id) AS greatest_id
    FROM 
        tc_positions
    WHERE 
    fixtime BETWEEN '${from}' AND '${to}'`);

    res.json(data);
  } catch (error) {
    console.log(error);
  }
  return;
  // Prepare the basic SQL query structure
  let query = `
    SELECT 
      p.deviceid,
      COUNT(*) AS total_positions,
      AVG(p.speed) AS avg_speed,
      MIN(p.fixtime) AS first_position_time,
      MAX(p.fixtime) AS last_position_time
    FROM tc_positions p
  `;
  let conditions = [];

  // Add time filter
  conditions.push(`p.fixtime BETWEEN ? AND ?`);

  // Add groupId filter if provided (allow for multiple groupId values)
  if (groupId) {
    const groupIds = Array.isArray(groupId) ? groupId : [groupId]; // If groupId is an array, use it, otherwise make it an array
    const groupConditions = groupIds
      .map(
        (id) =>
          `p.deviceid IN (SELECT deviceid FROM tc_devices WHERE groupid = ?)`
      )
      .join(" OR ");
    conditions.push(`(${groupConditions})`);
  }

  // Add deviceId filter if provided (allow for multiple deviceId values)
  if (deviceId) {
    const deviceIds = Array.isArray(deviceId) ? deviceId : [deviceId];
    const deviceCondition = deviceIds.map(() => `p.deviceid = ?`).join(" OR ");
    conditions.push(`(${deviceCondition})`);
  }

  // Add ignition filter if provided
  if (ignition) {
    conditions.push(`p.attributes LIKE '%"ignition":true%'`);
  }

  // Add geofences filter if provided
  if (geofences) {
    conditions.push(
      `p.deviceid IN (SELECT deviceid FROM tc_positions WHERE geofence_id IS NOT NULL)`
    );
  }

  // Apply conditions to the query
  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " GROUP BY p.deviceid";

  // Prepare parameters for query execution
  const params = [from, to]; // 'from' and 'to' are always added first

  // Add groupId params (if provided as an array)
  if (groupId) {
    const groupIds = Array.isArray(groupId) ? groupId : [groupId];
    groupIds.forEach((id) => params.push(id));
  }

  // Add deviceId params (if provided as an array)
  if (deviceId) {
    const deviceIds = Array.isArray(deviceId) ? deviceId : [deviceId];
    deviceIds.forEach(() => params.push("")); // Just pushing placeholders for deviceId
  }

  db = await dbPools.pool.getConnection();

  // Execute the query and return the results
  db.query(query, params, (error, results) => {
    if (error) {
      console.error("Error executing query", error);
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      res.json(results);
    }
  });
};

const summary = async (req, res) => {
  let db;
  const query = req.query;

  const dbQuery = `SELECT count(DISTINCT tc_events.deviceid) AS exited, eventtime AS eventTime from  tc_events
                  inner join tc_user_device on tc_events.deviceid = tc_user_device.deviceid
                  where tc_events.eventtime BETWEEN ${
                    query.from
                      ? `"${query.from}"`
                      : false || `"${TODAY()} 00:00"`
                  } AND ${
    query.to ? `"${query.to}"` : false || "(select current_timestamp)"
  }
                  GROUP BY DATE_FORMAT(tc_events.eventtime, '%Y-%m-%d')
                  `;
  const totalQuery = "SELECT COUNT(id) AS total from tc_devices";

  try {
    db = await dbPools.pool.getConnection();
    const [total, data] = await Promise.all([
      db.query(totalQuery),
      db.query(dbQuery),
    ]);
    const response = data.map((element) => ({
      ...element,
      exited: parseInt(element.exited),
      notExited: parseInt(total[0].total) - parseInt(element.exited),
      total: parseInt(total[0].total),
    }));

    res.json(response);
  } catch (error) {
    res.status(500).end;
  } finally {
    if (db) {
      await db.release();
    }
  }
};

const nearbyStops = async (req, res) => {
  let db;
  const { success, error } = NearbyStopsBodySchema.safeParse({
    ...req.query,
    from: new Date(req.query.from),
    to: new Date(req.query.to),
  });

  console.log(error);

  if (!success) return res.status(400).end("Entries not valid");

  const { latitude, longitude, devices, distance, to, from } = req.query;

  const dist = distance / 100000;

  const dbQuery = `SELECT * FROM tc_positions
      WHERE latitude  BETWEEN ${latitude} - ${dist} AND ${latitude} + ${dist}
      AND longitude BETWEEN ${longitude} - ${dist} AND ${longitude} + ${dist}
      AND fixtime BETWEEN "${from} 00:00" AND ${
    to ? `"${to} 23:59"` : false || "(select current_timestamp)"
  } AND deviceid IN (${devices})`;

  try {
    db = await dbPools.pool.getConnection();
    const data = await db.query(dbQuery);

    res.json(data);
  } catch (error) {
    res.status(500).end();
  } finally {
    if (db) {
      await db.release();
    }
  }
};

// export const speedSummary = async (req, res) => {
//   console.log("Speed Summary");
//   const queryParams = req.query;

//   if (!dateTimeParamsSchema.safeParse(queryParams).success) {
//     return res.status(400).send("query params error");
//   }

//   let db;
//   const query = "SELECT speed FROM tc_positions WHERE fixtime BETWEEN ? AND ?";

//   try {
//     db = await dbPools.pool.getConnection();

//     const data = await db.query(query, [queryParams.from, queryParams.to]);

//     const response = {
//       maximum: Math.max(...data.map((device) => device.speed)),
//       average: countRate(
//         data.length,
//         data.reduce((sum, device) => sum + device.speed, 0)
//       ),
//     };

//     return res.status(200).json(response);
//   } catch (error) {
//     console.log(error);
//     return res.status(404).send("Server error");
//   } finally {
//     if (db) {
//       await db.release();
//     }
//   }
// };

export { summary, nearbyStops };
