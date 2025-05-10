import dbPools from "../db/config/index.js";
import { TODAY } from "../helpers/constants.js";
import { date, string, z } from "zod";

const NearbyStopsBodySchema = z.object({
  latitude: z.union([z.string(), z.number()]),
  longitude: z.union([z.string(), z.number()]),
  devices: string(),
  distance: z.union([z.string(), z.number()]),
  from: date(),
  to: date().optional(),
});

const devices = async (req, res) => {
  let db;
  const params = [];

  const { contractId, contractorId, companyId, groupId } = req.query;

  let query = `SELECT tc_devices.id, tc_devices.attributes, tc_devices.groupid as groupId, tc_devices.calendarid as calendarId, tc_devices.name, tc_devices.uniqueid as uniqueId, tc_devices.status, tc_devices.lastupdate as lastUpdate, tc_devices.positionid as positionId, tc_devices.phone, tc_devices.model, tc_devices.contact, tc_devices.category, tc_devices.disabled, tc_devices.expirationtime as expirationTime, dc.contractid, tcn_companies.id AS companyid, tcn_companies.contractorid FROM tc_devices`;

  query += ` LEFT JOIN tcn_device_contract dc ON tc_devices.id = dc.deviceid
             LEFT JOIN tcn_contracts ON dc.contractid = tcn_contracts.id
             LEFT JOIN tcn_companies ON tcn_companies.id = tcn_contracts.companyid`;

  if (companyId && !contractId) {
    query += ` LEFT JOIN tcn_contracts ON dc.contractid = tcn_contracts.id`;
  }

  if (contractorId && !companyId && !contractId) {
    query += ` LEFT JOIN tcn_contracts ON dc.contractid = tcn_contracts.id
              LEFT JOIN tcn_companies ON tcn_companies.id = tcn_contracts.companyid`;
  }

  query += `
  WHERE 1=1
`;

  // Add filtering conditions based on the query parameters
  if (contractId) {
    query += " AND dc.contractid = ?";
    params.push(contractId);
  }

  if (companyId && !contractId) {
    query += " AND tcn_contracts.companyid = ?";
    params.push(companyId);
  }

  if (contractorId && !companyId && !contractId) {
    query += " AND tcn_companies.contractorid = ?";
    params.push(contractorId);
  }

  if (groupId) {
    if (Array.isArray(groupId)) {
      query += ` AND tc_devices.groupid IN (${groupId
        .map(() => "?")
        .join(", ")})`;
      params.push(...groupId);
    } else {
      query += " AND tc_devices.groupid = ?";
      params.push([groupId]);
    }
  }

  try {
    db = await dbPools.pool.getConnection();
    const data = await db.query(query, params);
    res.json(
      data.map((device) => ({
        ...device,
        attributes: JSON.parse(device.attributes),
      }))
    );
  } catch (error) {
    console.log(error);
  }
};

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
  // let minMaxId = {};

  let minMaxId = {
    smallest_id: 13645190,
    greatest_id: 13922881,
  };

  // try {
  //   db = await dbPools.pool.getConnection();

  //   const data = await db.query(`SELECT
  //   MIN(id) AS smallest_id,
  //   MAX(id) AS greatest_id
  //   FROM
  //       tc_positions
  //   WHERE
  //   fixtime BETWEEN '${from}' AND '${to}'`);

  //   minMaxId = data[0];
  // } catch (error) {
  //   console.log(error);
  // }

  // Prepare the basic SQL query structure
  let query = `
    SELECT 
      p.deviceid
      
    FROM tc_positions p
  `;
  let conditions = [];

  // Add time filter
  conditions.push(`p.id BETWEEN ? AND ?`);

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

  query += " LIMIT 20";

  // Prepare parameters for query execution
  const params = [minMaxId.smallest_id, minMaxId.greatest_id]; // 'from' and 'to' are always added first

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

export { summary, nearbyStops, devices };
