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

export const countRate = (total, n) => (n * 100) / total;

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
    else keyValue += `${key}="${body[key]}"`;

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
