// import dbPools from "../db/config/index.js";
// import { eventParamsSchema } from "../validations/zodSchemas.js";

// export const getEvents = async (req, res) => {
//   const queryParams = req.query;

//   if (!eventParamsSchema.safeParse(queryParams).success) {
//     return res.status(400).send("params error");
//   }

//   let db;
//   let query = "SELECT * FROM tc_events WHERE type=?";

//   if (queryParams.deviceId != "all")
//     query += " AND deviceId=" + Number(queryParams.deviceId);

//   try {
//     console.log(query);
//     db = await dbPools.pool.getConnection();
//     const data = await db.query(query, [
//       queryParams.type,
//       queryParams.from,
//       queryParams.to,
//     ]);
//     return res.status(200).json(data);
//   } catch (error) {
//     console.log(error);
//     return res.status(404).send("Server error");
//   } finally {
//     if (db) {
//       await db.release();
//     }
//   }
// };
