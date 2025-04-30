import dbPools from "../db/config/index.js";

export const groups = async (req, res) => {
  let db;

  const userId = req.userId;

  const query = `SELECT tc_groups.* FROM tc_groups
                    LEFT JOIN tc_user_group ON tc_groups.id = tc_user_group.groupid
                    WHERE tc_user_group.userid = ?`;

  try {
    db = await dbPools.pool.getConnection();
    let data = await db.query(query, [userId]);
    return res.json(
      data.map((group) => ({
        ...group,
        attributes: JSON.parse(group.attributes),
      }))
    );
  } catch (error) {
    console.error("Error fetching groups:", error);
    return res.status(404).end("Server error");
  } finally {
    if (db) {
      await db.release();
    }
  }
};
