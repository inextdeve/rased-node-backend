import moment from "moment";
import dbPools from "../db/config/index.js";
import { contracts } from "../controllers/contracts.js";

export const getDatesInRange = (startDate, endDate) => {
  const date = new Date(startDate.getTime());

  const dates = new Array();

  while (date <= endDate) {
    dates.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }

  return dates;
};
/**
 * @param {Number} total Total items
 * @param {Number} n Targeted items
 */

export const countRate = (total, n) => (Number(n) * 100) / Number(total);

/**
 * @param {Array} arr Array of values
 */

// Flat array values for fit the sql syntax

export const flatArray = (arr) =>
  arr
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

// Flat body values for fit sql update syntax

export const fitUpdateValues = (body, skipedValues = []) => {
  console.log(body);
  let keyValue = "";
  Object.keys(body).forEach((key, index, array) => {
    // Skip the id_bin
    if (skipedValues.includes(key)) return;

    if (typeof body[key] === "number" || body[key] === null)
      keyValue += `${key}=${body[key]}`;
    else if (key === "start_date" || key === "end_date")
      keyValue += `${key}='${moment(body[key]).format("YYYY-MM-DDTHH:mm:ss")}'`;
    else keyValue += `${key}='${body[key]}'`;

    if (index === array.length - 1) return;

    keyValue += ",";
  });

  return keyValue.lastIndexOf(",") === keyValue.length - 1
    ? keyValue.slice(0, keyValue.length - 1)
    : keyValue;
};

export const flatInsertValues = (body, skippedValues = []) => {
  let values = "";

  Object.keys(body).forEach((key, index, keys) => {
    //Don't add skipped values
    if (skippedValues.includes(key)) return;

    if (typeof body[key] === "number" || body[key] === null)
      values += `${body[key]}`;
    else values += `"${body[key]}"`;

    if (index === keys.length - 1) return;

    values += ",";
  });
  //Check this you can remove this line because no need to check we checking before in 73
  return values.lastIndexOf(",") === values.length - 1
    ? values.slice(0, values.length - 1)
    : values;
};

export const flatInsertKeys = (body, skippedValues = []) => {
  let keys = "";
  console.log("|", Object.keys(body));
  Object.keys(body).forEach((key, index, keysArr) => {
    //Don't add skipped values
    if (skippedValues.includes(key)) return;

    keys += `${key}`;

    if (index === keysArr.length - 2) return;

    keys += ",";
  });
  console.log("KEYS", keys);
  //Check this you can remove this line because no need to check we checking before in 73
  return keys;
};

export function getDaysBetweenDates(date1, date2) {
  const start = moment(date1);
  const end = moment(date2);
  return end.diff(start, "days"); // Get the difference in days
}

/**
 * Checks if an object contains only the specified properties.
 * @param {Object} obj - The object to check.
 * @param {Array} allowedProps - The list of allowed property names.
 * @returns {boolean} - True if the object only contains the allowed properties, otherwise false.
 */
export function hasOnlyProps(obj, allowedProps) {
  return Object.keys(obj).every((key) => allowedProps.includes(key));
}

export const getCorpConnections = async (userId) => {
  let db;

  const query = `SELECT 
                        GROUP_CONCAT(DISTINCT uc.contractid) AS contracts,
                        GROUP_CONCAT(DISTINCT up.companyid) AS companies,
                        GROUP_CONCAT(DISTINCT un.contractorid) AS contractors
                    FROM 
                        (SELECT DISTINCT userid FROM tcn_user_contract
                        UNION 
                        SELECT DISTINCT userid FROM tcn_user_company
                        UNION 
                        SELECT DISTINCT userid FROM tcn_user_contractor) u
                    LEFT JOIN tcn_user_contract uc ON u.userid = uc.userid
                    LEFT JOIN tcn_user_company up ON u.userid = up.userid
                    LEFT JOIN tcn_user_contractor un ON u.userid = un.userid
                    WHERE u.userid = ?
                    GROUP BY u.userid;
          `;
  try {
    db = await dbPools.pool.getConnection();
    const data = await db.query(query, [userId]);
    return {
      contractId: data[0].contracts?.split(",")?.map(Number),
      companyId: data[0].companies?.split(",")?.map(Number),
      contractorId: data[0].contractors?.split(",")?.map(Number),
    };
  } catch (error) {
    return error;
  } finally {
    if (db) {
      await db.release();
    }
  }
};

/**
 * Returns a new array of objects with only the specified keys.
 * @param {Array<Object>} arr - The array of objects to filter.
 * @param {Array<string>} keys - The array of keys to pick from each object.
 * @returns {Array<Object>} - A new array of objects with only the specified keys.
 */

export function pickKeysFromObjects(keys, arr) {
  if (typeof keys === "string") {
    keys = [keys];
  }
  return arr.map((obj) =>
    Object.fromEntries(
      keys
        .filter((key) => key in obj) // only include existing keys
        .map((key) => [key, obj[key]])
    )
  );
}

/**
 * Converts an array of objects into an object, using a specified key as the property.
 *
 * @param {string} key - The key in each object to be used as the property name for the new object.
 * @param {Array<Object>} arr - The array of objects to be converted.
 * @returns {Object} The resulting object, where each key is the value of the specified key in the input objects.
 */
export function arrayToObjectByKey(key, arr) {
  return arr.reduce((acc, item) => {
    acc[item[key]] = item;
    return acc;
  }, {});
}

export function safeJson(obj) {
  const json = JSON.parse(
    JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? Number(v) : v))
  );

  // Convert all string numbers to numbers
  function convertStringNumberInsideJsonToNumber(json) {
    for (let key in json) {
      if (typeof json[key] === "string" && !isNaN(json[key])) {
        json[key] = Number(json[key]);
      } else if (typeof json[key] === "object") {
        convertStringNumberInsideJsonToNumber(json[key]);
      }
    }
  }
  convertStringNumberInsideJsonToNumber(json);

  return json;
}

export function formatHydraulicSessions(data) {
  const hydraulicSessions = [];
  let startTime = null;
  let startId = null;
  let sessionId = 1;
  let io109Values = [];

  for (const row of data) {
    const isHydraulics = row.hydraulics;
    const io109 = row.io109;
    const fixtime = new Date(row.fixtime);

    if (isHydraulics && startTime === null) {
      startTime = fixtime;
      startId = row.id;
      io109Values = io109 ? [io109] : [];
    } else if (!isHydraulics && startTime !== null) {
      const endTime = fixtime;
      const endId = row.id;
      const duration = (endTime - startTime) / 60000; // convert ms to minutes

      hydraulicSessions.push({
        "Session ID": sessionId,
        "Start ID": startId,
        "End ID": endId,
        "Device ID": row.deviceid,
        "Start Time": startTime.toISOString(),
        "End Time": endTime.toISOString(),
        "Duration (min)": duration,
        "io109 Values": io109Values.filter(Boolean).join(", "),
        Latitude: row.latitude,
        Longitude: row.longitude,
      });

      startTime = null;
      startId = null;
      sessionId += 1;
    } else if (isHydraulics && io109) {
      io109Values.push(io109);
    }
  }

  return hydraulicSessions;
}
