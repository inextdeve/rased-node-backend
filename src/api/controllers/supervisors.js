import dbPools from "../db/config/index.js";

const statistics = async (req, res) => {
    let db;

  const query = req.query;
  // Get how many bins belongs to each driver
  const allBinsQuery = `SELECT tcn_routs.driverid, tc_drivers.name, COUNT(*) AS bins FROM tc_geofences
                        INNER JOIN tcn_routs ON tc_geofences.routid = tcn_routs.id
                        INNER JOIN tc_drivers ON tc_drivers.id = tcn_routs.driverid
                        WHERE tc_geofences.attributes LIKE '%"bins": "yes"%'
                        GROUP BY tcn_routs.driverid`;

    //Query for empted bins for each driver

    const emptedBinsQuery = `SELECT tc_drivers.id AS driverid, COUNT(tc_geofences.routid) AS emptedBins FROM tc_geofences
                            INNER JOIN tcn_poi_schedule ON tcn_poi_schedule.geoid = tc_geofences.id
                            INNER JOIN tcn_routs ON tcn_routs.id = tc_geofences.routid
                            INNER JOIN tc_drivers ON tc_drivers.id = tcn_routs.driverid
                            WHERE tcn_poi_schedule.serv_time BETWEEN "${query.from}" AND ${query.to ? `"${query.to}"` : false || "(SELECT current_timestamp)"}
                            GROUP BY tc_drivers.id`;

  try {
    db = await dbPools.pool.getConnection();

    const binsByDriver = await db.query(allBinsQuery);

    const emptedBins = await db.query(emptedBinsQuery);

    const supervisorsStatistic = binsByDriver.map((driverBins) => {
        const empted = parseInt(emptedBins.find(emptedByDriver => emptedByDriver.driverid === driverBins.driverid)?.emptedBins);
        return {
            ...driverBins,
            bins: parseInt(driverBins.bins),
            emptedBins: empted ? empted : 0
        }
    })

    res.json(supervisorsStatistic);

  } catch (error) {
    console.log(error)
    res.status(500).json({ success: false, message: "Internal Server Error" });
  } finally {
    if (db) {
      await db.release();
    }
  }

}

export { statistics }