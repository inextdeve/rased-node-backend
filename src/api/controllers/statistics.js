import dbPools from "../db/config/index.js";
import { countRate } from "../helpers/utils.js";

const kpi = async (req, res) => {
  let db;
  const { query } = req;

  //Empted bins today
  const emptedBins = `SELECT COUNT(id) AS completed FROM tcn_poi_schedule
                      WHERE serv_time BETWEEN "${query.from}" AND "${
    query.from.split("T")[0] + " 23:59"
  }"`;

  //Washed bins today
  const washedBins = `SELECT COUNT(id) AS completed FROM tcn_posi_washing
                      WHERE serv_time BETWEEN "${query.from}" AND "${
    query.from.split("T")[0] + " 23:59"
  }"`;

  //Vehicle status
  const exitedVehicle = `SELECT count(DISTINCT tc_events.deviceid) AS completed from  tc_events
                          inner join tc_user_device on tc_events.deviceid = tc_user_device.deviceid
                          where tc_events.eventtime BETWEEN "${
                            query.from
                          }" AND "${
    query.from.split("T")[0] + " 23:59"
  }" and tc_events.type="geofenceExit"
                          `;

  //Sweeper Status
  const exitedSweepers = `SELECT SUM(JSON_EXTRACT(attributes, '$.distance')/1000) AS completed FROM tc_positions 
                          WHERE deviceid IN (SELECT id FROM tc_devices WHERE groupid = 5)
                          AND speed < 15
                          AND DATE(fixtime) ='${query.from.split("T")[0]}'`;

  //Count All Bins
  const countBins = `SELECT COUNT(id) AS count FROM tc_geofences WHERE attributes LIKE '%"bins": "yes"%' AND JSON_EXTRACT(tc_geofences.attributes, "$.cartoon") IS NULL`;

  //Count All Vehicle
  const countVehicle = `SELECT COUNT(id) AS count FROM tc_devices`;

  //Count All Sweepers
  const countSweepers = `SELECT  COUNT(id) AS count from  tc_devices WHERE tc_devices.groupid='5' or tc_devices.name like '%14'`;

  // Cartoons Query
  const completedCartoonsQuery = `SELECT COUNT(*) AS completed FROM tcn_poi_schedule AS schedule JOIN tc_geofences AS geofence ON schedule.geoid = geofence.id WHERE JSON_CONTAINS (geofence.attributes, '{"cartoon": "yes"}', '$') AND DATE(schedule.serv_time) = '${
    query.from.split("T")[0]
  }'`;
  // All Cartoons query
  const countCartoons = `SELECT COUNT(*) AS count FROM tc_geofences where JSON_CONTAINS(tc_geofences.attributes, '{"cartoon": "yes"}', '$')`;
  try {
    db = await dbPools.pool.getConnection();
    const [
      emptedStatus,
      washingStatus,
      vehicleStatus,
      sweepersStatus,
      allBins,
      allVehicle,
      allSweepers,
      completedCartoons,
      allCartoons,
    ] = (
      await Promise.all([
        db.query(emptedBins),
        db.query(washedBins),
        db.query(exitedVehicle),
        db.query(exitedSweepers),
        db.query(countBins),
        db.query(countVehicle),
        db.query(countSweepers),
        db.query(completedCartoonsQuery),
        db.query(countCartoons),
      ])
    ).map((ele) => {
      if (ele[0].hasOwnProperty("completed")) {
        return { completed: parseInt(ele[0].completed) };
      }
      return { count: parseInt(ele[0].count) };
    });

    const response = [
      {
        name: "Cartoons",
        total: allCartoons.count,
        completed: completedCartoons.completed,
        uncompleted: allCartoons.count - completedCartoons.completed,
      },
      {
        name: "Bins",
        total: allBins.count,
        completed: emptedStatus.completed,
        uncompleted: allBins.count - emptedStatus.completed,
      },
      {
        name: "Washing",
        total: Math.round(allBins.count / 30),
        completed: washingStatus.completed,
        uncompleted: Math.round(allBins.count / 30) - washingStatus.completed,
      },
      {
        name: "Vehicle",
        total: allVehicle.count,
        completed: vehicleStatus.completed,
        uncompleted: allVehicle.count - vehicleStatus.completed,
      },
      {
        name: "Sweepers",
        total: 826,
        completed: sweepersStatus.completed,
        uncompleted: 826 - sweepersStatus.completed,
      },
    ];

    res.json(
      response.map((item) => ({
        ...item,
        rate: countRate(item.total, item.completed).toFixed(2) + "%",
      }))
    );
  } catch (error) {
    res.sendStatus(500);
  } finally {
    if (db) {
      await db.release();
    }
  }
};

const summary = async (req, res) => {
  let db;

  const dbQueryReports = `SELECT 
  COUNT(*) AS total_rows,
  SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS Open,
  SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS Closed
  FROM tcn_g_reprots
  WHERE time >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;

  const dbQuerySweepers = `SELECT AVG(speed) AS avg_speed, MAX(speed) AS max_speed, SUM(JSON_EXTRACT(attributes, '$.distance')/1000) AS total_distance, 826 * 7 AS total_routs, (SUM(JSON_EXTRACT(attributes, '$.distance')/1000)/(826 * 7))*100 AS rate_percentage
  FROM tc_positions
  WHERE deviceid IN (SELECT id FROM tc_devices WHERE groupid = 5)
  AND speed < 15
  AND fixtime >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;

  try {
    db = await dbPools.pool.getConnection();
    const [reports, sweepers] = await Promise.all([
      db.query(dbQueryReports),
      db.query(dbQuerySweepers),
    ]);

    const response = [
      {
        name: "Reports",
        total: 100,
        done: parseInt(reports[0].Closed),
        rate: parseInt(
          countRate(
            parseInt(reports[0].total_rows),
            parseInt(reports[0].Closed)
          )
        ),
        totalItems: parseInt(reports[0].Open) + parseInt(reports[0].Closed),
      },
      {
        name: "Sweepers",
        total: 100,
        done: parseInt(sweepers[0].total_distance),
        rate: parseInt(sweepers[0].rate_percentage),
        totalItems: parseInt(sweepers[0].total_distance),
      },
    ];

    res.json(response);
  } catch (error) {
    res.json({ status: 500, message: "Internal server error" });
  } finally {
    if (db) {
      await db.release();
    }
  }
};

const vehicle = async (req, res) => {
  let db;

  const query = req.query;
  const totalDistanceQuery = `SELECT SUM(JSON_EXTRACT(attributes, '$.distance'))/1000 AS totalDistance
  FROM tc_positions
  WHERE deviceid IN (
    SELECT id
    FROM tc_devices
  )
  AND fixtime >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;

  const totalHoursQuery = `SELECT 
  SUM(hours_difference) AS totalHours
  FROM (
    SELECT 
      d.id AS device_id,
      (MAX(JSON_EXTRACT(p.attributes, '$.hours')) - MIN(JSON_EXTRACT(p.attributes, '$.hours'))) / (60*60*1000) AS hours_difference
    FROM 
      tc_devices d
      INNER JOIN tc_positions p ON d.id = p.deviceid
    WHERE 
      DATE(p.fixtime) BETWEEN DATE_SUB(NOW(), INTERVAL 7 DAY) AND NOW()
    GROUP BY 
      d.id
  ) AS temp`;

  const totalVehicleQuery = `SELECT COUNT(id) AS totalVehicle FROM tc_devices`;

  const onlineDevicesFetch = fetch("http://s1.rcj.care/api/devices", {
    headers: {
      Authorization: "basic " + "YWRtaW46YWRtaW4=",
    },
  }).then((r) => r.json());

  //   const exitedVehiclesFetch = fetch(`http://38.54.114.166:3003/api/devices/summary?from=${new Date(moment().format("YYYY-MM-DD")).toISOString()}&to=${new Date().toISOString()}`, {
  //   "headers": {
  //     "authorization": "Bearer fb1329817e3ca2132d39134dd6d894b3"
  //   }
  // }).then(r=>r.json());

  const exitedDevicesQuery = `SELECT count(DISTINCT tc_events.deviceid) AS completed from  tc_events
    inner join tc_user_device on tc_events.deviceid = tc_user_device.deviceid
    where tc_events.eventtime BETWEEN "${query.from}" AND "${
    query.from.split("T")[0] + " 23:59"
  }" and tc_events.type="geofenceExit"
`;

  try {
    db = await dbPools.pool.getConnection();
    const [
      totalDistance,
      totalHours,
      totalVehicle,
      onlineDevices,
      exitedVehicles,
    ] = await Promise.all([
      db.query(totalDistanceQuery),
      db.query(totalHoursQuery),
      db.query(totalVehicleQuery),
      onlineDevicesFetch,
      db.query(exitedDevicesQuery),
    ]);

    const response = {
      totalDistance: Math.round(parseInt(totalDistance[0].totalDistance)),
      totalHours: Math.round(parseInt(totalHours[0].totalHours)),
      totalVehicle: Math.round(parseInt(totalVehicle[0].totalVehicle)),
      onlineDevices: onlineDevices.filter(
        (device) => device.status === "online"
      ).length,
      exitedVehicles: parseInt(exitedVehicles[0].completed),
    };

    res.json(response);
  } catch (error) {
    res.json({ status: 500, message: "Internal server error" });
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export { kpi, summary, vehicle };
