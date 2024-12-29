import dbPools from "../db/config/index.js";

export const getEvents = async (req, res) => {
  const { from, to, groupId, deviceId, type } = req.query;
  let db;
  let params = [];

  if (!from || !to) {
    return res
      .status(400)
      .send(
        `Both "from" and "to" parameters are required when "empted" is specified.`
      );
  }

  let query = "SELECT e.* FROM tc_events e";

  if (groupId) {
    query += ` LEFT JOIN tc_devices d ON e.deviceid = d.id
             LEFT JOIN tc_groups g ON d.groupid = g.id`;
  }

  query += " WHERE e.eventtime BETWEEN ? AND ?";

  params.push(from, to);

  if (groupId) {
    if (Array.isArray(groupId)) {
      query += ` AND g.id IN (?)`;
      params.push(groupId);
    } else {
      query += ` AND g.id = ?`;
      params.push(groupId);
    }
  }

  if (deviceId) {
    if (Array.isArray(deviceId)) {
      query += ` AND e.deviceid IN (?)`;
      params.push(deviceId);
    } else {
      query += ` AND e.deviceid = ?`;
      params.push(deviceId);
    }
  }

  if (type) {
    if (Array.isArray(type)) {
      query += ` AND e.type IN (?)`;
      params.push(type);
    } else {
      query += ` AND e.type = ?`;
      params.push(type);
    }
  }

  try {
    db = await dbPools.pool.getConnection();
    const data = await db.query(query, params);

    return res.status(200).json(data);
  } catch (error) {
    console.log(error);
    return res.status(404).send("Server error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};
