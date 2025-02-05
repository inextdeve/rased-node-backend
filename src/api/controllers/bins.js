import moment from "moment";
import dbPools from "../db/config/index.js";
import { LAST7DAYS, LASTWEEK } from "../helpers/constants.js";
import { fitUpdateValues } from "../helpers/utils.js";

export const Oldbins = async (req, res) => {
  let db;
  const params = [];
  const {
    contractId,
    contractorId,
    companyId,
    routeid,
    typeid,
    tagid,
    binId,
    by,
    empted,
    from,
    to,
    groupId,
    deviceId,
  } = req.query;

  let { userId } = req.query;

  // For avoid getting bins of another user if not an admin
  if (!req.isAdministrator && userId !== req.userId) {
    userId = req.userId;
  }

  // Validation for required parameters
  if (empted) {
    if (!from || !to) {
      return res
        .status(400)
        .send(
          `Both "from" and "to" parameters are required when "empted" is specified.`
        );
    }
  } else if (from || to) {
    return res
      .status(400)
      .send(
        `"from" and "to" parameters can only be used with the "empted" query.`
      );
  }

  // Start building the base query
  let query = `
    SELECT
      b.*,
      c.name AS contract_name,
      r.route_code AS route_name,
      t.name AS type_name,
      tg.name AS tag_name,
      ctr.id AS centerid,
      ctr.name AS center_name
      ${
        empted
          ? ", h.fixtime as empted_time, h.deviceid, dv.name AS device_name, dv.category AS deviceCategory"
          : ""
      }
  `;

  query += `
    FROM tcn_bins b
    LEFT JOIN tcn_contracts c ON b.contractid = c.id
    LEFT JOIN tcn_routes r ON b.routeid = r.id
    LEFT JOIN tcn_binstypes t ON b.typeid = t.id
    LEFT JOIN tcn_tags tg ON b.tagid = tg.id
    LEFT JOIN tcn_centers ctr ON r.center_id = ctr.id
  `;

  if (companyId && !contractId) {
    query += ` LEFT JOIN tcn_companies ON c.companyid = tcn_companies.id`;
  }

  if (contractorId && !companyId && !contractId) {
    query += ` LEFT JOIN tcn_companies ON c.companyid = tcn_companies.id
              LEFT JOIN tcn_contractors ON tcn_companies.contractorid = tcn_contractors.id`;
  }

  if (userId) {
    query += `LEFT JOIN tcn_contracts ON b.contractid = tcn_contracts.id
              LEFT JOIN tcn_user_contract ON tcn_contracts.id = tcn_user_contract.contractid`;
  }

  if (empted || from || to) {
    query += `
      LEFT JOIN tcb_rfid_history h ON tg.tag_code = h.rfidtag AND h.fixtime >= ? AND h.fixtime <= ?
      LEFT JOIN tc_devices dv ON h.deviceid = dv.id
    `;
    params.push(from, to);
  }

  query += `
    WHERE 1=1
  `;

  // Add filtering conditions based on the query parameters
  if (contractId) {
    query += " AND b.contractid = ?";
    params.push(contractId);
  }

  if (companyId && !contractId) {
    query += " AND tcn_companies.id = ?";
    params.push(companyId);
  }

  if (contractorId && !companyId && !contractId) {
    query += " AND tcn_contractors.id = ?";
    params.push(contractorId);
  }

  if (routeid) {
    query += " AND b.routeid = ?";
    params.push(routeid);
  }
  if (typeid) {
    query += " AND b.typeid = ?";
    params.push(typeid);
  }
  if (tagid) {
    query += " AND b.tagid = ?";
    params.push(tagid);
  }

  if (userId) {
    query += " AND tcn_user_contract.userid = ?";
    params.push(userId);
  }

  if (binId) {
    query += " AND b.id = ?";
    params.push(binId);
  }

  if (groupId && empted) {
    if (Array.isArray(groupId)) {
      query += ` AND dv.groupid IN (?)`;
      params.push(groupId);
    } else {
      query += ` AND dv.groupid = ?`;
      params.push(groupId);
    }
  }

  if (deviceId && empted) {
    if (Array.isArray(deviceId)) {
      query += ` AND dv.id IN (?)`;
      params.push(deviceId);
    } else {
      query += ` AND dv.id = ?`;
      params.push(deviceId);
    }
  }

  // Add filtering for "empted"
  if (empted) {
    if (empted === "true") {
      query += " AND h.rfidtag IS NOT NULL";
    } else if (empted === "false") {
      query += " AND h.rfidtag IS NULL";
    } else if (empted !== "all") {
      return res.status(400).send(`Invalid "empted" parameter: ${empted}`);
    }
  }

  try {
    // Execute the query
    db = await dbPools.pool.getConnection();
    const data = await db.query(query, params);
    // Add grouping if "by" is specified
    if (by) {
      switch (by) {
        // case "contracts":
        //   query += " GROUP BY b.contractid, c.name";
        //   query += " ORDER BY c.name";
        //   break;
        // case "routes":
        //   query += " GROUP BY b.routeid, r.name";
        //   query += " ORDER BY r.name";
        //   break;
        case "types":
          const groupedByType = data.reduce((acc, bin) => {
            if (!acc[bin.typeid]) {
              acc[bin.typeid] = [];
            }
            acc[bin.typeid].push(bin);
            return acc;
          }, {});

          return res.status(200).json(groupedByType);
        // case "tags":
        //   query += " GROUP BY b.tagid, tg.name";
        //   query += " ORDER BY tg.name";
        //   break;
        default:
          return res.status(400).send(`Invalid "by" parameter: ${by}`);
      }
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Database query failed:", error);
    res.status(500).send("An error occurred while fetching bins");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export const bins = async (req, res) => {
  let db;
  const params = [];
  const {
    contractId,
    contractorId,
    companyId,
    routeid,
    typeid,
    tagid,
    binId,
    by,
    empted,
    from,
    to,
    groupId,
    deviceId,
  } = req.query;

  let { userId } = req.query;

  if (!req.isAdministrator && userId !== req.userId) {
    userId = req.userId;
  }

  if (empted) {
    if (!from || !to) {
      return res
        .status(400)
        .send(
          `Both "from" and "to" parameters are required when "empted" is specified.`
        );
    }
  } else if (from || to) {
    return res
      .status(400)
      .send(
        `"from" and "to" parameters can only be used with the "empted" query.`
      );
  }

  // Base query (excluding tcb_rfid_history)
  let query = `
    SELECT 
      b.*, 
      c.name AS contract_name, 
      r.route_code AS route_name, 
      t.name AS type_name,
      tg.tag_code AS rfidtag,
      ctr.id AS centerid,
      ctr.name AS center_name
    FROM tcn_bins b
    LEFT JOIN tcn_contracts c ON b.contractid = c.id
    LEFT JOIN tcn_routes r ON b.routeid = r.id
    LEFT JOIN tcn_binstypes t ON b.typeid = t.id
    LEFT JOIN tcn_tags tg ON b.tagid = tg.id
    LEFT JOIN tcn_centers ctr ON r.center_id = ctr.id
  `;

  if (companyId && !contractId) {
    query += ` LEFT JOIN tcn_companies ON c.companyid = tcn_companies.id`;
  }

  if (contractorId && !companyId && !contractId) {
    query += ` LEFT JOIN tcn_companies ON c.companyid = tcn_companies.id
              LEFT JOIN tcn_contractors ON tcn_companies.contractorid = tcn_contractors.id`;
  }

  if (userId) {
    query += `LEFT JOIN tcn_contracts ON b.contractid = tcn_contracts.id
              LEFT JOIN tcn_user_contract ON tcn_contracts.id = tcn_user_contract.contractid`;
  }

  query += `
    WHERE 1=1
  `;

  if (contractId) {
    query += " AND b.contractid = ?";
    params.push(contractId);
  }

  if (companyId && !contractId) {
    query += " AND tcn_companies.id = ?";
    params.push(companyId);
  }

  if (contractorId && !companyId && !contractId) {
    query += " AND tcn_contractors.id = ?";
    params.push(contractorId);
  }

  if (routeid) {
    query += " AND b.routeid = ?";
    params.push(routeid);
  }
  if (typeid) {
    query += " AND b.typeid = ?";
    params.push(typeid);
  }
  if (tagid) {
    query += " AND b.tagid = ?";
    params.push(tagid);
  }

  if (userId) {
    query += " AND tcn_user_contract.userid = ?";
    params.push(userId);
  }

  if (binId) {
    query += " AND b.id = ?";
    params.push(binId);
  }

  try {
    // Execute the main query
    db = await dbPools.pool.getConnection();
    const binsData = await db.query(query, params);

    if (!empted) {
      return res.json(binsData);
    }
    // Extract tag codes for querying tcb_rfid_history
    const tagCodes = binsData.map((bin) => bin.rfidtag).filter((tag) => tag); // Ensure tag_code exists
    let historyData = [];

    if (tagCodes.length > 0) {
      const historyParams = [from, to, ...tagCodes];
      const historyQuery = `
        SELECT h.fixtime as empted_time, h.rfidtag, h.deviceid, dv.category AS deviceCategory
        FROM tcb_rfid_history h
        LEFT JOIN tc_devices dv ON h.deviceid = dv.id
        WHERE h.fixtime >= ? AND h.fixtime <= ?
        AND h.rfidtag IN (${tagCodes.map(() => "?").join(", ")});
      `;
      historyData = await db.query(historyQuery, historyParams);
    }

    const dataWithHistory = historyData
      .map((binHistory) => {
        const bin = binsData.find(
          (bin) =>
            bin.rfidtag.toLowerCase() === binHistory.rfidtag.toLowerCase()
        );
        if (!bin) return null;
        return {
          ...bin,
          empted_time: binHistory.empted_time,
          ...binHistory,
        };
      })
      .filter(Boolean);

    // Grouping logic (if "by" is specified)
    if (by) {
      switch (by) {
        case "types":
          const groupedByType = dataWithHistory.reduce((acc, bin) => {
            if (!acc[bin.typeid]) {
              acc[bin.typeid] = [];
            }
            acc[bin.typeid].push(bin);
            return acc;
          }, {});

          return res.status(200).json(groupedByType);
        default:
          return res.status(400).send(`Invalid "by" parameter: ${by}`);
      }
    }

    res.status(200).json(dataWithHistory);
  } catch (error) {
    console.error("Database query failed:", error);
    res.status(500).send("An error occurred while fetching bins");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

const binById = async (req, res) => {
  let db;

  //GET TODAY STATUS
  const id = parseInt(req.params.id) || "0";
  const reqQuery = req.query;

  let query = `SELECT * FROM tcn_bins WHERE tcn_bins.id = ${id}`;
  let data;
  try {
    if (reqQuery?.get) {
      switch (reqQuery.get) {
        case "tag":
          query = `SELECT DISTINCT tcn_tags.* FROM tcn_tags JOIN tcn_bins ON tcn_bins.tagid = tcn_tags.id WHERE tcn_bins.id=${id}`;

          db = await dbPools.pool.getConnection();
          data = await db.query(query);
          return res.json(data[0]);
        case "contract":
          query = `SELECT DISTINCT tcn_contracts.* FROM tcn_contracts JOIN tcn_bins ON tcn_bins.contractid = tcn_contracts.id WHERE tcn_bins.id=${id}`;

          db = await dbPools.pool.getConnection();
          data = await db.query(query);
          return res.json(data[0]);
        default:
          break;
      }
    }

    db = await dbPools.pool.getConnection();
    data = await db.query(query);
    if (data.length) {
      return res.json(data[0]);
    }
    return res.json({});
  } catch (error) {
    return res.status(400).end("Server Error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

const binReports = async (req, res) => {
  let db;

  const query = req.query;

  let dbQuery = `SELECT tcn_g_reprots.id,tcn_g_reprots.phone, tcn_g_reprots.username, tcn_g_reprots.description, tcn_g_reprots.idbin AS id_bin, tcn_g_reprots.time, tcn_g_reprots.img, tcn_g_reprots.imgafter, tcn_g_reprots.type, tcn_g_reprots.status, tc_geofences.area, tc_geofences.description AS description_bin, tcn_centers.center_name FROM tcn_g_reprots
  JOIN tc_geofences ON tcn_g_reprots.idbin = tc_geofences.id
  JOIN tcn_centers ON tc_geofences.centerid=tcn_centers.id
  WHERE time BETWEEN "${query.from}" AND ${
    query.to ? `"${query.to}"` : false || "(select current_timestamp)"
  }`;

  try {
    db = await dbPools.pool.getConnection();
    const data = (await db.query(dbQuery)).map((item) => {
      return {
        ...item,
        img: item.img
          ? `https://bins.rcj.care/${JSON.parse(item.img)[0]}`
          : null,
        imgafter: item.imgafter
          ? `https://bins.rcj.care/${JSON.parse(item.imgafter)[0]}`
          : null,
        type: JSON.parse(item.type)[0],
        latitude: item.area.split(" ")[0].split("(")[1],
        longitude: item.area.split(" ")[1].split("(")[0].split(",")[0],
      };
    });

    res.json(data);
  } catch (error) {
    res.json({ error: error.message });
  } finally {
    if (db) {
      await db.release();
    }
  }
};

const binCategorized = async (req, res) => {
  let db;

  const query = req.query;
  const category = req.params.category;

  //Query for empted bins only
  const dbQuery = `SELECT tcn_poi_schedule.geoid, tcn_poi_schedule.bydevice, tc_geofences.description FROM tcn_poi_schedule
                  RIGHT JOIN tc_geofences ON tcn_poi_schedule.geoid=tc_geofences.id
                  WHERE tcn_poi_schedule.serv_time BETWEEN "${
                    query.from
                  }" AND ${
    query.to ? `"${query.to}"` : false || "(select current_timestamp)"
  }`;
  //Query for all bins
  const queryAllBins = `SELECT tc_geofences.id, tc_geofences.description, tc_geofences.area AS position,tcn_centers.center_name, tcn_centers.id AS centerId, tcn_routs.rout_code, tcn_routs.id AS routeId,tc_drivers.name AS driverName, tc_drivers.phone, tcn_bin_type.bintype, tcn_bin_type.id AS binTypeId FROM tc_geofences
                        JOIN tcn_centers ON tc_geofences.centerid=tcn_centers.id
                        JOIN tcn_routs ON tc_geofences.routid=tcn_routs.id
                        JOIN tc_drivers ON tcn_routs.driverid=tc_drivers.id
                        JOIN tcn_bin_type ON tc_geofences.bintypeid=tcn_bin_type.id 
                        WHERE tc_geofences.attributes LIKE '%"bins": "yes"%' AND JSON_EXTRACT(tc_geofences.attributes, "$.cartoon") IS NULL
                        ${
                          query.id
                            ? category === "bintype"
                              ? `AND tcn_bin_type.id = ${query.id}`
                              : category === "center"
                              ? `AND tcn_centers.id = ${query.id}`
                              : category === "route"
                              ? `AND tcn_routs.id = ${query.id}`
                              : ""
                            : ""
                        }`;

  const groupedBy = (data, category) => {
    const byGroup = new Object();

    data.forEach((item) => {
      if (byGroup[item[category]]) {
        byGroup[item[category]].total += 1;
        byGroup[item[category]].empty_bin += Number(item.empty_bin);
        byGroup[item[category]].un_empty_bin += Number(!item.empty_bin);
        return;
      }
      byGroup[item[category]] = {
        [req.params.category]: item[category],
        total: 1,
        empty_bin: Number(item.empty_bin),
        un_empty_bin: Number(!item.empty_bin),
      };

      if (category === "rout_code") {
        byGroup[item[category]].phone = `${parseInt(item.phone)}`;
        byGroup[item[category]].shift = "morning";
        byGroup[item[category]].routeId = item.routeId;
        byGroup[item[category]].driver = item.driverName;
      }

      if (category === "bintype") {
        byGroup[item[category]].binTypeId = item.binTypeId;
      }

      if (category === "center_name") {
        byGroup[item[category]].centerId = item.centerId;
      }
    });
    const byGroupList = new Array();
    for (let key in byGroup) {
      byGroupList.push(byGroup[key]);
    }

    res.json(byGroupList);
  };

  try {
    db = await dbPools.pool.getConnection();

    const allBins = await db.query(queryAllBins);

    const data = await db.query(dbQuery);

    const dataObject = new Object();

    data.forEach((element) => {
      dataObject[element.geoid] = element;
    });

    let response = new Array();

    response = allBins.map((bin) => {
      if (dataObject[bin.id]) {
        return {
          ...bin,
          empty_bin: true,
        };
      } else {
        return {
          ...bin,
          empty_bin: false,
        };
      }
    });

    switch (req.params.category) {
      case "bintype":
        groupedBy(response, "bintype");
        break;
      case "center":
        groupedBy(response, "center_name");
        break;
      case "route":
        groupedBy(response, "rout_code");
        break;
      default:
        res.status(204).end();
        break;
    }
  } catch (e) {
    res.status(500).end();
  } finally {
    if (db) {
      await db.release();
    }
  }
};

const summary = async (req, res) => {
  let db;

  const query = req.query;
  //Query for last 7 days bins status
  const dbQuery = `SELECT tcn_poi_schedule.geoid, tcn_poi_schedule.serv_time FROM tcn_poi_schedule
                    WHERE tcn_poi_schedule.serv_time BETWEEN "${
                      query.from
                    }" AND ${
    query.to ? `"${query.to}"` : false || "(select current_timestamp)"
  }`;
  //Query for all bins
  const queryAllBins = `SELECT COUNT(tc_geofences.id) AS counter FROM tc_geofences
                        WHERE tc_geofences.attributes LIKE '%"bins": "yes"%' AND JSON_EXTRACT(tc_geofences.attributes, "$.cartoon") IS NULL`;

  try {
    db = await dbPools.pool.getConnection();
    const [allBins, data] = await Promise.all([
      db.query(queryAllBins),
      db.query(dbQuery),
    ]);

    const groupedByDate = new Object();

    data.forEach((item) => {
      const date = item.serv_time.toISOString().split("T")[0];
      if (groupedByDate[date]) {
        groupedByDate[date] += 1;
        return;
      }
      groupedByDate[date] = 1;
    });

    const response = new Array();

    for (let key in groupedByDate) {
      //Skip the first day because is not full
      // if (key === query.from.split("T")[0]) {
      //   continue;
      // }
      response.push({
        date: key,
        total: parseInt(allBins[0].counter),
        empty_bin: groupedByDate[key],
        un_empty_bin: parseInt(allBins[0].counter) - groupedByDate[key],
      });
    }
    res.json(response);
  } catch (error) {
    res.status(500).end();
  } finally {
    if (db) {
      await db.release();
    }
  }
};

// Patch Controllers
const updateBin = () => {};
export const putBin = async (req, res) => {
  let db;

  const body = req.body;
  const id = req.params.id;

  const updateValues = fitUpdateValues(body);

  const query = `UPDATE tcn_bins SET ${updateValues} WHERE tcn_bins.id=?`;

  // Check if the target id is exist
  try {
    db = await dbPools.pool.getConnection();
    await db.query(query, [id]);
    return res.status(200).end();
  } catch (e) {
    console.log(e);
    res.status(400).end("Server Error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

// Post Controller

const addBin = async (req, res) => {
  let db;

  const body = req.body;

  const flatValues = Object.values(body)
    .map((value) => {
      if (typeof value === "string") {
        return "'" + value + "'";
      }
      if (typeof value === "object") {
        return "'" + JSON.stringify(value, null, 1) + "'";
      }
      return value;
    })
    .join(", ");

  try {
    db = await dbPools.pool.getConnection();
    const addQuery = `INSERT INTO tcn_bins (${Object.keys(body).join(
      ", "
    )}, userid) VALUES (${flatValues}, ${req.userId});`;

    await db.query(addQuery);

    return res.status(200).end();
  } catch (e) {
    return res.status(400).end("Server Error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

const deleteBin = async (req, res) => {
  let db;

  const id = req.params.id;
  try {
    db = await dbPools.pool.getConnection();

    const addQuery = `DELETE FROM tcn_bins WHERE tcn_bins.id = ${id}`;

    await db.query(addQuery);

    res.status(200).end("DELETED");
  } catch (error) {
    console.log(error);
    res.status(400).end("Server Error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

// Set a bin status [empted]

const updateBinStatus = async (req, res) => {
  let db;

  const { description } = req.body;

  if (!description)
    return res
      .status(404)
      .json({ success: false, message: "request without description" });

  const targetBinQuery = `SELECT tc_geofences.id, tc_devices.name FROM tc_geofences
                          JOIN tcn_routs ON tc_geofences.routid = tcn_routs.id
                          JOIN tc_devices ON tc_devices.id = tcn_routs.deviceid
                          WHERE tc_geofences.description="${description}" LIMIT 1`;

  try {
    db = await dbPools.pool.getConnection();
    // Check if the target bin is exist
    const targetBin = await db.query(targetBinQuery);
    if (!targetBin || !targetBin?.length)
      return res
        .status(404)
        .json({ success: false, message: "Bin not found !" });

    // Check if the target is already empted

    const isEmptedQuery = `SELECT id from tcn_poi_schedule WHERE serv_time BETWEEN "${req.query.from}" AND (select current_timestamp) AND geoid="${targetBin[0].id}"`;

    const isEmpted = await db.query(isEmptedQuery);

    if (isEmpted?.length)
      return res
        .status(409)
        .json({ success: false, message: "Conflict! already empted bin" });

    // Add bin to empted, query

    const addBinToEmptedQuery = `INSERT INTO tcn_poi_schedule (serv_time, geoid, codeserv, VehicleID) VALUES (current_timestamp, ${
      targetBin[0].id
    }, ${moment().format("YYYYMMDD") + targetBin[0].id}, "${
      targetBin[0].name
    }")`;

    await db.query(addBinToEmptedQuery);

    res.sendStatus(202);
  } catch (error) {
    // console.log(error);
    if (error?.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ success: false, message: "Conflict! already empted bin" });
    }
    res.status(500).json({ success: false, message: "Internal Server Error" });
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export {
  binById,
  binReports,
  binCategorized,
  summary,
  updateBin,
  addBin,
  deleteBin,
  updateBinStatus,
};
