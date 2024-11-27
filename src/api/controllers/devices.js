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

export const speedSummary = async (req, res) => {
  const queryParams = req.query;

  if (!dateTimeParamsSchema.safeParse(queryParams).success) {
    return res.status(400).send("query params error");
  }

  let db;
  const query = "SELECT speed FROM tc_positions WHERE fixtime BETWEEN ? AND ?";

  try {
    db = await dbPools.pool.getConnection();
    console.log("Speed asu", query);

    const data = await db.query(query, [queryParams.from, queryParams.to]);

    const response = {
      maximum: Math.max(...data.map((device) => device.speed)),
      minimum: Math.min(...data.map((device) => device.speed)),
      average: countRate(
        data.length,
        data.reduce((sum, device) => sum + device.speed, 0)
      ),
    };

    return res.status(200).json(response);
  } catch (error) {
    console.log(error);
    return res.status(404).send("Server error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export { summary, nearbyStops };
