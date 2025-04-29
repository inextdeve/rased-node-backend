import moment from "moment";
import dbPools from "../db/config/index.js";
import {
  arrayToObjectByKey,
  countRate,
  fitUpdateValues,
  getDaysBetweenDates,
  pickKeysFromObjects,
} from "../helpers/utils.js";
import { binsSchema, formatZodError } from "../validations/zodSchemas.js";

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
      SELECT tcn_contracts.id FROM tcn_contracts
      LEFT JOIN tcn_companies ON tcn_companies.id = tcn_contracts.companyid
      LEFT JOIN tcn_contractors ON tcn_contractors.id = tcn_companies.contractorid
      WHERE tcn_contractors.id IN (SELECT id FROM linked_contractors) OR tcn_companies.id IN (SELECT id FROM linked_companies) OR tcn_contracts.id IN (SELECT id FROM linked_contracts)
    ),
  all_bins AS (
  SELECT tcn_bins.* FROM tcn_bins 
  RIGHT JOIN all_contracts ON tcn_bins.contractid = all_contracts.id
`;

export const categorizedBins = async (req, res) => {
  let db;

  let {
    from,
    to,
    userId,
    empted,
    washed,
    by,
    contractId,
    companyId,
    contractorId,
  } = req.query;

  // const queryValidation = binsCategorizedSchama.safeParse(req.query);

  // if (!queryValidation.success) {
  //   return res.status(400).send(formatZodError(queryValidation.error));
  // }

  let params = [];

  let query = CorpQuery;
  let filteredContractsQuery = "";

  if (!req.isAdministrator) {
    userId = req.userId;

    params = Array(6).fill(userId);
    filteredContractsQuery =
      "  WHERE tcn_bins.contractid IN (SELECT id FROM all_contracts)";
  } else if (userId) {
    params = Array(6).fill(userId);
    filteredContractsQuery =
      "  WHERE tcn_bins.contractid IN (SELECT id FROM all_contracts)";
  } else {
    query = `WITH all_bins AS (SELECT tcn_bins.* FROM tcn_bins 
             LEFT JOIN tcn_contracts ON tcn_bins.contractid = tcn_contracts.id
            `;
  }

  if (companyId && !contractId) {
    query += ` LEFT JOIN tcn_companies ON tcn_contracts.companyid = tcn_companies.id`;
  }

  if (contractorId && !companyId && !contractId) {
    query += ` LEFT JOIN tcn_companies ON tcn_contracts.companyid = tcn_companies.id
              LEFT JOIN tcn_contractors ON tcn_companies.contractorid = tcn_contractors.id`;
  }
  if (req.isAdministrator && !userId) {
    query += " WHERE 1=1";
  }

  if (contractId) {
    query += " AND tcn_bins.contractid = ?";
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

  let washingGroup, compactorsGroup;

  const { dashboard } = JSON.parse(req.user.attributes);

  if (dashboard?.compactors?.length) {
    compactorsGroup = dashboard.compactors.map((c) => `'${c}'`).join(",");
  }

  if (dashboard?.washing?.length) {
    washingGroup = dashboard.washing.map((w) => `'${w}'`).join(",");
  }

  if (by === "type") {
    query += `), filtered_bins AS (SELECT all_bins.tagid, tcn_binstypes.name AS ${by}, tcn_binstypes.id AS ${by}id FROM all_bins
				LEFT JOIN tcn_binstypes ON all_bins.typeid = tcn_binstypes.id)`;
  }

  if (by === "route") {
    query += `), filtered_bins AS (SELECT all_bins.tagid, tcn_routes.route_code AS ${by}, tcn_routes.id AS ${by}id FROM all_bins
    LEFT JOIN tcn_routes ON all_bins.routeid = tcn_routes.id)`;
  }

  if (by === "center") {
    query += `), filtered_bins AS (SELECT all_bins.tagid, tcn_centers.name AS ${by}, tcn_centers.id AS ${by}id FROM all_bins
    LEFT JOIN tcn_routes ON all_bins.routeid = tcn_routes.id
    LEFT JOIN tcn_centers ON tcn_routes.center_id = tcn_centers.id)`;
  }

  if (empted) {
    const numOfDays = getDaysBetweenDates(from, to);

    query += `, tags_history AS (SELECT tagid FROM tcb_rfid_history
                  LEFT JOIN tc_devices ON tcb_rfid_history.deviceid = tc_devices.id
                  WHERE fixtime BETWEEN '${from}' AND '${to}'
                  AND ${
                    compactorsGroup
                      ? `tc_devices.category IN (${compactorsGroup})`
                      : "1=1"
                  }
                  GROUP BY  tagid, Date(fixtime)),
                  grouped_tags_history AS (SELECT  *, COUNT(tagid)  AS total_records FROM tags_history
                  GROUP BY tagid)

                  SELECT filtered_bins.${by},
                  filtered_bins.${by}id,
                  SUM(CASE WHEN total_records IS NOT NULL THEN total_records ELSE 0 END) AS total_done,
                  (COUNT(filtered_bins.${by}) * ${numOfDays}) - SUM(CASE WHEN total_records IS NOT NULL THEN total_records ELSE 0 END) AS total_undone,
                  CAST(COUNT(filtered_bins.${by}) * ${numOfDays} AS CHAR) AS total
                  FROM filtered_bins
                  left JOIN grouped_tags_history h ON h.tagid = filtered_bins.tagid
                  GROUP BY filtered_bins.${by}
                  `;
    params.push(from, to);
  } else if (washed) {
    const numOfDays = getDaysBetweenDates(from, to);

    query += `, tags_history AS (SELECT tagid FROM tcb_rfid_history
                  LEFT JOIN tc_devices ON tcb_rfid_history.deviceid = tc_devices.id
                  WHERE fixtime BETWEEN '${from}' AND '${to}'
                  AND ${
                    washingGroup
                      ? `tc_devices.category IN (${washingGroup})`
                      : "1=1"
                  }
                  GROUP BY  tagid, Date(fixtime)),
                  grouped_tags_history AS (SELECT  *, COUNT(tagid)  AS total_records FROM tags_history
                  GROUP BY tagid)

                  SELECT filtered_bins.${by},
                  SUM(CASE WHEN total_records IS NOT NULL THEN total_records ELSE 0 END) AS total_done,
                  (COUNT(filtered_bins.${by}) * ${numOfDays}) - SUM(CASE WHEN total_records IS NOT NULL THEN total_records ELSE 0 END) AS total_undone,
                  CAST(COUNT(filtered_bins.${by}) * ${numOfDays} AS CHAR) AS total
                  FROM filtered_bins
                  left JOIN grouped_tags_history h ON h.tagid = filtered_bins.tagid
                  GROUP BY filtered_bins.${by}
                  `;
    params.push(from, to);
  } else {
    // Add query for directly return bins by types count
  }

  try {
    // Execute the main query
    db = await dbPools.pool.getConnection();
    let data = await db.query(query, params);

    data = data.map((item) => ({
      ...item,
      rate: countRate(item.total, item.total_done).toFixed(2) + " %",
    }));

    data.push({
      [by]: "Total",
      total_done: data.reduce(
        (acc, item) => acc + parseInt(item.total_done),
        0
      ),
      total_undone: data.reduce(
        (acc, item) => acc + parseInt(item.total_undone),
        0
      ),
      total: data.reduce((acc, item) => acc + parseInt(item.total), 0),
      rate:
        countRate(
          data.reduce((acc, item) => acc + parseInt(item.total), 0),
          data.reduce((acc, item) => acc + parseInt(item.total_done), 0)
        ).toFixed(2) + " %",
    });

    res.json(data);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export const summary = async (req, res) => {
  let db;

  let { from, to, empted, washed, userId } = req.query;

  if (!from || !to) {
    return res
      .status(400)
      .send(`Both "from" and "to" parameters are required.`);
  }

  let params = [];

  let query = CorpQuery;

  if (!req.isAdministrator) {
    userId = req.userId;
    params = Array(6).fill(userId);
  } else if (userId) {
    params = Array(6).fill(userId);
  } else {
    query = `WITH all_bins AS (SELECT * FROM tcn_bins)
            `;
  }

  let washingGroup, compactorsGroup;

  const { dashboard } = JSON.parse(req.user.attributes);

  if (dashboard?.compactors?.length) {
    compactorsGroup = dashboard.compactors.map((c) => `'${c}'`).join(",");
  }

  if (dashboard?.washing?.length) {
    washingGroup = dashboard.washing.map((w) => `'${w}'`).join(",");
  }

  if (empted) {
    query += `, tags_history AS
    (SELECT tagid, DATE(fixtime) AS record_date FROM tcb_rfid_history
    LEFT JOIN tc_devices ON tcb_rfid_history.deviceid = tc_devices.id
    WHERE fixtime BETWEEN ? AND ?
    AND ${
      compactorsGroup ? `tc_devices.category IN (${compactorsGroup})` : "1=1"
    }
    GROUP BY tagid, record_date),

    grouped_tags_history AS (SELECT record_date, COUNT(tagid) AS total_records, (SELECT COUNT(id) FROM all_bins) AS total FROM tags_history
    GROUP BY record_date)

    SELECT CAST(total_records AS CHAR) AS total_done, CAST(total AS CHAR) AS total, record_date AS summary_date FROM grouped_tags_history
                      `;
  } else if (washed) {
    query += `, tags_history AS
    (SELECT tagid, DATE(fixtime) AS record_date FROM tcb_rfid_history
    LEFT JOIN tc_devices ON tcb_rfid_history.deviceid = tc_devices.id
    WHERE fixtime BETWEEN ? AND ?
    AND ${washingGroup ? `tc_devices.category IN (${washingGroup})` : "1=1"}
    GROUP BY tagid, record_date),

    grouped_tags_history AS (SELECT record_date, COUNT(tagid) AS total_records, (SELECT COUNT(id) FROM all_bins) AS total FROM tags_history
    GROUP BY record_date)

    SELECT CAST(total_records AS CHAR) AS total_done, CAST(total AS CHAR) AS total, record_date AS summary_date FROM grouped_tags_history
                      `;
  }

  params.push(from, to);

  try {
    // Execute the main query
    db = await dbPools.pool.getConnection();
    let data = await db.query(query, params);
    data = data.map((item) => ({
      ...item,
      summary_date: moment(item.summary_date).format("YYYY-MM-DD"),
      total_undone: parseInt(item.total) - parseInt(item.total_done),
      rate: countRate(item.total, item.total_done).toFixed(2) + " %",
    }));

    // General status TOTAL

    const total_rate = countRate(
      data.reduce((acc, item) => acc + parseInt(item.total), 0),
      data.reduce((acc, item) => acc + parseInt(item.total_done), 0)
    ).toFixed(2);

    data.push({
      total_done: data.reduce(
        (acc, item) => acc + parseInt(item.total_done),
        0
      ),
      total: data.reduce((acc, item) => acc + parseInt(item.total), 0),
      total_undone: data.reduce(
        (acc, item) => acc + parseInt(item.total_undone),
        0
      ),
      rate: isNaN(total_rate) ? "0 %" : total_rate + " %",
      summary_date: "total",
    });

    res.json(data);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

// Move this var to constant file
const binsGet = {
  id: "b.id",
  longitude: "b.longitude",
  latitude: "b.latitude",
};

const binsHandler = async (req = {}) => {
  let {
    q,
    count,
    limit,
    cursor,
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
    get,
    userId,
  } = req.query;

  const queryValidation = binsSchema.safeParse(req.query);

  if (!queryValidation.success) {
    throw new Error(formatZodError(queryValidation.error));
  }

  let params = [];

  let query = CorpQuery;

  // For avoid getting companies of another user if not an admin
  if (!req.isAdministrator) {
    userId = req.userId;
    params = Array(6).fill(userId);
  } else if (userId) {
    params = Array(6).fill(userId);
  } else {
    query = `
      WITH all_bins AS (
        SELECT tcn_bins.*
        FROM tcn_bins
      )
    `;
  }

  let selectedColumns =
    count && !empted
      ? "COUNT(b.id) AS COUNT "
      : `b.*,
        c.name AS contract_name,
        r.route_code AS route_name,
        t.name AS type_name,
        tg.tag_code AS rfidtag,
        tg.name AS tagName,
        ctr.id AS centerid,
        ctr.name AS center_name`;

  if (get && !count) {
    if (Array.isArray(get)) {
      selectedColumns = get.map((item) => binsGet[item]);
      if (empted) {
        selectedColumns.push("tg.tag_code AS rfidtag");
      }
      selectedColumns = selectedColumns.join(", ");
    } else {
      selectedColumns = binsGet[get];
      if (empted) {
        selectedColumns += ", tg.tag_code AS rfidtag";
      }
    }
  }

  // Base query (excluding tcb_rfid_history)
  // i use not empted for using the count just in bins query that not require empted bins
  query += `
    SELECT
      ${selectedColumns}
    FROM all_bins b
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

  if (binId) {
    query += " AND b.id = ?";
    params.push(binId);
  }

  if (q) {
    query += " AND b.description LIKE ?";
    params.push(`%${q}%`);
  }

  const limitValue = limit ? parseInt(limit) : 0;
  const cursorValue = cursor ? parseInt(cursor) : 0;

  if (limitValue) {
    query += " LIMIT ? OFFSET ? ";
    params.push(limitValue, cursorValue);
  }

  try {
    // Execute the main query
    db = await dbPools.pool.getConnection();
    const binsData = await db.query(query, params);

    if (!empted) {
      if (count) return parseInt(binsData[0]["COUNT"]);
      return binsData;
    }
    // Extract tag codes for querying tcb_rfid_history
    const tagCodes = binsData.map((bin) => bin.rfidtag).filter((tag) => tag); // Ensure tag_code exists
    let historyData = [];

    if (tagCodes.length > 0) {
      const historyParams = [from, to, ...tagCodes];
      let historyQuery = `
        SELECT h.fixtime as empted_time, h.rfidtag, h.deviceid, dv.category AS deviceCategory
        FROM tcb_rfid_history h
        LEFT JOIN tc_devices dv ON h.deviceid = dv.id
        WHERE h.fixtime >= ? AND h.fixtime <= ?
        AND h.rfidtag IN (${tagCodes.map(() => "?").join(", ")})
      `;

      if (deviceId) {
        if (Array.isArray(deviceId)) {
          historyQuery += ` AND h.deviceid IN (${deviceId
            .map(() => "?")
            .join(", ")}) `;
          historyParams.push(...deviceId);
        } else {
          historyQuery += " AND h.deviceid = ? ";
          historyParams.push(deviceId);
        }
      }

      historyData = await db.query(historyQuery, historyParams);
    }

    const dataWithHistory = historyData
      .map((binHistory) => {
        const bin = binsData.find(
          (bin) =>
            bin.rfidtag?.toLowerCase() === binHistory.rfidtag?.toLowerCase()
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

          return groupedByType;
        default:
          return dataWithHistory;
      }
    }

    return dataWithHistory;
  } catch (error) {
    throw new Error(error);
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export const bins = async (req, res) => {
  let db;

  let {
    q,
    count,
    limit,
    cursor,
    contractId,
    contractorId,
    companyId,
    routeid,
    typeid,
    tagid,
    binId,
    empted,
    from,
    to,
    groupId,
    deviceId,
    get,
    userId,
  } = req.query;

  const queryValidation = binsSchema.safeParse(req.query);

  if (!queryValidation.success) {
    return res.status(400).send(formatZodError(queryValidation.error));
  }

  let params = [];

  let query = CorpQuery;

  // For avoid getting companies of another user if not an admin
  if (!req.isAdministrator) {
    userId = req.userId;
    params = Array(6).fill(userId);
  } else if (userId) {
    params = Array(6).fill(userId);
  } else {
    query = `
      WITH all_bins AS (
        SELECT tcn_bins.*
        FROM tcn_bins
      )
    `;
  }

  let selectedColumns =
    count && !empted
      ? "COUNT(b.id) AS COUNT "
      : `b.*,
        c.name AS contract_name,
        r.route_code AS route_name,
        t.name AS type_name,
        tg.tag_code AS rfidtag,
        tg.name AS tagName,
        ctr.id AS centerid,
        ctr.name AS center_name`;

  if (get && !count) {
    if (Array.isArray(get)) {
      selectedColumns = get.map((item) => binsGet[item]).filter(Boolean);

      if (empted) {
        selectedColumns.push("LOWER(tg.tag_code) AS rfidtag");
      }
      selectedColumns = selectedColumns.join(", ");
    } else {
      selectedColumns = binsGet[get] ? binsGet[get] + "," : "";
      if (empted) {
        selectedColumns += " tg.tag_code AS rfidtag";
      }
    }
  }

  // Base query (excluding tcb_rfid_history)
  // i use not empted for using the count just in bins query that not require empted bins
  query += `
    ) SELECT
      ${selectedColumns}
    FROM all_bins b
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

  if (binId) {
    query += " AND b.id = ?";
    params.push(binId);
  }

  if (q) {
    query += " AND b.description LIKE ?";
    params.push(`%${q}%`);
  }

  const limitValue = limit ? parseInt(limit) : 0;
  const cursorValue = cursor ? parseInt(cursor) : 0;

  if (limitValue) {
    query += " LIMIT ? OFFSET ? ";
    params.push(limitValue, cursorValue);
  }

  try {
    // Execute the main query
    db = await dbPools.pool.getConnection();
    const binsData = await db.query(query, params);

    if (!empted) {
      if (count) return res.json(parseInt(binsData[0]["COUNT"]));
      return res.json(binsData);
    }
    // Extract tag codes for querying tcb_rfid_history

    let historyData = [];

    const historyParams = [from, to];
    let historyQuery = `
        SELECT h.fixtime as empted_time, LOWER(h.rfidtag) AS rfidtag, h.deviceid, dv.category AS deviceCategory
        FROM tcb_rfid_history h
        LEFT JOIN tc_devices dv ON h.deviceid = dv.id
        WHERE h.fixtime >= ? AND h.fixtime <= ?
      `;

    if (deviceId) {
      if (Array.isArray(deviceId)) {
        historyQuery += ` AND h.deviceid IN (${deviceId
          .map(() => "?")
          .join(", ")}) `;
        historyParams.push(...deviceId);
      } else {
        historyQuery += " AND h.deviceid = ? ";
        historyParams.push(deviceId);
      }
    }

    historyData = await db.query(historyQuery, historyParams);

    const binObj = arrayToObjectByKey("rfidtag", binsData);

    historyData.forEach((item) => {
      if (!binObj[item.rfidtag]) return;
      if (binObj?.empted_time) {
        binObj[item.rfidtag].empted_time.push(item.empted_time);
      } else {
        binObj[item.rfidtag].empted_time = [item.empted_time];
      }
    });

    let dataWithHistory = Object.values(binObj);

    // If the empted value is true mean the user want just the empted bins else empted is equal to "all"
    if (empted === "true") {
      dataWithHistory = dataWithHistory.filter((item) => {
        return item?.empted_time?.length > 0;
      });
    }
    if (get) {
      const filteredData = pickKeysFromObjects(get, dataWithHistory); //pickKeysFromObjects(get, dataWithHistory);

      res.status(200).json(filteredData);
    } else {
      res.status(200).json(dataWithHistory);
    }
  } catch (error) {
    console.log(error);
    res.status(400).send("Server Error");
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

// const summary = async (req, res) => {
//   let db;

//   const query = req.query;
//   //Query for last 7 days bins status
//   const dbQuery = `SELECT tcn_poi_schedule.geoid, tcn_poi_schedule.serv_time FROM tcn_poi_schedule
//                     WHERE tcn_poi_schedule.serv_time BETWEEN "${
//                       query.from
//                     }" AND ${
//     query.to ? `"${query.to}"` : false || "(select current_timestamp)"
//   }`;
//   //Query for all bins
//   const queryAllBins = `SELECT COUNT(tc_geofences.id) AS counter FROM tc_geofences
//                         WHERE tc_geofences.attributes LIKE '%"bins": "yes"%' AND JSON_EXTRACT(tc_geofences.attributes, "$.cartoon") IS NULL`;

//   try {
//     db = await dbPools.pool.getConnection();
//     const [allBins, data] = await Promise.all([
//       db.query(queryAllBins),
//       db.query(dbQuery),
//     ]);

//     const groupedByDate = new Object();

//     data.forEach((item) => {
//       const date = item.serv_time.toISOString().split("T")[0];
//       if (groupedByDate[date]) {
//         groupedByDate[date] += 1;
//         return;
//       }
//       groupedByDate[date] = 1;
//     });

//     const response = new Array();

//     for (let key in groupedByDate) {
//       //Skip the first day because is not full
//       // if (key === query.from.split("T")[0]) {
//       //   continue;
//       // }
//       response.push({
//         date: key,
//         total: parseInt(allBins[0].counter),
//         empty_bin: groupedByDate[key],
//         un_empty_bin: parseInt(allBins[0].counter) - groupedByDate[key],
//       });
//     }
//     res.json(response);
//   } catch (error) {
//     res.status(500).end();
//   } finally {
//     if (db) {
//       await db.release();
//     }
//   }
// };

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
  updateBin,
  addBin,
  deleteBin,
  updateBinStatus,
};
