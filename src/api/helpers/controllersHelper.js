export async function insertPermission(
  db,
  tableName,
  insertColumns,
  insertValues
) {
  try {
    // Validate inputs
    if (!tableName || !insertColumns) {
      throw new Error("Invalid parameters for permission function.");
    }

    // Construct the insert query
    const columns = insertColumns.join(", ");
    const placeholders = insertColumns.map(() => "?").join(", ");
    const insertQuery = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders});`;
    // Execute batch insert
    await db.query(insertQuery, insertValues);
  } catch (error) {
    throw new Error(error);
  }
}

export async function deletePermission(db, tableName, conditions, values) {
  try {
    // Validate inputs
    if (!tableName || !Array.isArray(conditions) || !Array.isArray(values)) {
      throw new Error("Invalid parameters for permission function.");
    }

    const deleteCondition = conditions
      .map((condition) => `${condition} = ? `)
      .join(" AND ");
    // Construct the insert query
    const deleteQuery = `DELETE FROM ${tableName} WHERE ${deleteCondition}`;
    console.log(deleteQuery);
    // Execute batch insert
    await db.query(deleteQuery, values);

    return true;
  } catch (error) {
    throw new Error(error);
  }
}
