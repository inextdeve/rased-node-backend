import dbPools from "../db/config/index.js";
import { TODAY, LAST7DAYS, LASTWEEK } from "../helpers/constants.js";

const washingCategorized = async (req, res) => {
  let db;
  const query = req.query;

  //Query for washed bins only
  const dbQuery = `SELECT tcn_posi_washing.geoid, tcn_posi_washing.bydevice, tc_geofences.description FROM tcn_posi_washing
                    RIGHT JOIN tc_geofences ON tcn_posi_washing.geoid=tc_geofences.id
                    WHERE tcn_posi_washing.serv_time BETWEEN ${
                      query.from
                        ? `"${query.from}"`
                        : false || `"${TODAY()} 00:00"`
                    } AND ${
    query.to ? `"${query.to}"` : false || "(select current_timestamp)"
  }`;
  //Query for all bins
  const queryAllBins = `SELECT tc_geofences.id, tc_geofences.description, tc_geofences.area AS position, tc_geofences.bintypeid AS binTypeId, tcn_centers.center_name, tc_geofences.centerid AS centerId, tcn_routs.rout_code, tcn_routs.id AS routeId, tc_drivers.name AS driverName, tc_drivers.phone, tcn_bin_type.bintype FROM tc_geofences
                          JOIN tcn_centers ON tc_geofences.centerid=tcn_centers.id
                          JOIN tcn_routs ON tc_geofences.routid=tcn_routs.id
                          JOIN tc_drivers ON tcn_routs.driverid=tc_drivers.id
                          JOIN tcn_bin_type ON tc_geofences.bintypeid=tcn_bin_type.id 
                          WHERE tc_geofences.attributes LIKE '%"bins": "yes"%'`;

  const groupedBy = (data, category) => {
    const byGroup = new Object();

    data.forEach((item) => {
      if (byGroup[item[category]]) {
        byGroup[item[category]].total += 1;
        byGroup[item[category]].cleaned += Number(item.cleaned);
        byGroup[item[category]].not_cleaned += Number(!item.cleaned);
        return;
      }
      byGroup[item[category]] = {
        [req.params.category]: item[category],
        total: 1,
        cleaned: Number(item.cleaned),
        not_cleaned: Number(!item.cleaned),
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
    if (data?.length > 0) {
      response = allBins.map((bin) => {
        if (dataObject[bin.id]) {
          return {
            ...bin,
            cleaned: true,
          };
        } else {
          return {
            ...bin,
            cleaned: false,
          };
        }
      });
    }

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

  //Query for last 7 days washing status
  const dbQuery = `SELECT tcn_posi_washing.geoid, tcn_posi_washing.serv_time FROM tcn_posi_washing
                    WHERE tcn_posi_washing.serv_time BETWEEN ${LASTWEEK()} AND (SELECT current_timestamp)`;

  //Query for all bins
  const queryAllBins = `SELECT COUNT(tc_geofences.id) AS counter FROM tc_geofences
                        WHERE tc_geofences.attributes LIKE '%"bins": "yes"%'`;

  try {
    db = await dbPools.pool.getConnection();
    const allBins = await db.query(queryAllBins);
    const data = await db.query(dbQuery);

    const lastSevenDaysStatus = LAST7DAYS().map((day) => {
      const cleaned = data.filter(
        (item) => item.serv_time.toISOString().split("T")[0] === day
      ).length;
      return {
        date: day,
        total: parseInt(allBins[0].counter),
        cleaned,
        not_cleaned: parseInt(allBins[0].counter) - cleaned,
      };
    });

    res.json(lastSevenDaysStatus);
  } catch (error) {
    res.status(500).end();
  } finally {
    if (db) {
      await db.release();
    }
  }
};

export { washingCategorized, summary };
