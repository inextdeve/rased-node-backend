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

  const { from, to, userid, contractorid, companyid, contractid } = req.query;

  if (!from || !to || !userid)
    return res
      .status(400)
      .send(`Required parameters "from", "to" and "userid".`);

  const dbQuery = `
    WITH dates AS (
        SELECT DISTINCT DATE(history.fixtime) AS record_date
        FROM tcb_rfid_history history
        WHERE history.fixtime BETWEEN '${from}' AND '${to}'
    ),
    filtered_contracts AS (
        SELECT contracts.id AS contract_id, contracts.name AS contract_name, contracts.companyid
        FROM tcn_contracts contracts
        JOIN tcn_user_contract uc ON contracts.id = uc.contractid
        WHERE uc.userid = 1
        AND (${contractid ? `contracts.id = ${contractid}` : "1=1 "})
        AND (${companyid ? `contracts.companyid = ${companyid}` : "1=1"})
    ), 
    filtered_companies AS (
        SELECT companies.id AS company_id, companies.name AS company_name, companies.contractorid
        FROM tcn_companies companies
        JOIN tcn_user_company uc ON companies.id = uc.companyid
        WHERE uc.userid = 1
        AND (${companyid ? `companies.id = ${companyid}` : "1=1"})
    ), 
    filtered_contractors AS (
        SELECT contractors.id AS contractor_id, contractors.name AS contractor_name
        FROM tcn_contractors contractors
        JOIN tcn_user_contractor uc ON contractors.id = uc.contractorid
        WHERE uc.userid = 1
        AND (${contractid ? `contractors.id = ${contractorid}` : "1=1"})
    ), 
    filtered_tags AS (
        SELECT tags.id AS tag_id, bins.contractid, bins.typeid
        FROM tcn_tags tags
        JOIN tcn_bins bins ON tags.binid = bins.id
        WHERE bins.contractid IN (SELECT contract_id FROM filtered_contracts)
    ), 
    history_counts AS (
        SELECT history.tagid, DATE(history.fixtime) AS record_date, COUNT(DISTINCT DATE(history.fixtime)) AS total_records
        FROM tcb_rfid_history history
        WHERE history.fixtime BETWEEN '${from}' AND '${to}'
        GROUP BY history.tagid, DATE(history.fixtime)
    ), 
    summary_data AS (
        SELECT
            fc.contract_id,
            fc.contract_name,
            fco.company_name,
            fct.contractor_name,
            bt.name AS bin_type,
            COUNT(DISTINCT ft.tag_id) * (SELECT COUNT(*) FROM dates) AS total_tags_count,
            SUM(COALESCE(hc.total_records, 0)) AS unique_tags_count,
            SUM(COALESCE(hc.total_records, 0)) AS total_records_count
        FROM filtered_tags ft
        JOIN tcn_binstypes bt ON ft.typeid = bt.id
        LEFT JOIN history_counts hc ON ft.tag_id = hc.tagid
        JOIN filtered_contracts fc ON ft.contractid = fc.contract_id
        JOIN filtered_companies fco ON fc.companyid = fco.company_id
        JOIN filtered_contractors fct ON fco.contractorid = fct.contractor_id
        GROUP BY fc.contract_name, fco.company_name, fct.contractor_name, bt.name
    )
    SELECT 
        contract_name,
        company_name,
        contractor_name,
        bin_type,
        total_tags_count,
        unique_tags_count,
        total_records_count,
        IFNULL((unique_tags_count / NULLIF(total_tags_count, 0)) * 100, 0) AS uniqueness_percentage
    FROM summary_data

    UNION ALL

    SELECT 
        'total' AS contract_name,
        '---' AS company_name,
        '---' AS contractor_name,
        '---' AS bin_type,
        SUM(total_tags_count),
        SUM(unique_tags_count),
        SUM(total_records_count),
        IFNULL((SUM(unique_tags_count) / NULLIF(SUM(total_tags_count), 0)) * 100, 0) AS uniqueness_percentage
    FROM summary_data
    ORDER BY contract_name, total_records_count DESC;
  `;

  try {
    db = await dbPools.pool.getConnection();
    const data = await db.query(dbQuery, [from, to]);

    res.json(data);
  } catch (error) {
    console.log(error);
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
