import moment from "moment";
const YESTERDAY = moment().subtract(1, "days").format("YYYY-MM-DD");
const TODAY = () => moment().format("YYYY-MM-DD");
const LASTWEEK = () => moment().subtract(6, "day").format("YYYY-MM-DD");
const LAST7DAYS = () => {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const time = moment().subtract(i, "day").format("YYYY-MM-DD");

    days.push(time);
  }
  return days;
};

export { YESTERDAY, TODAY, LAST7DAYS, LASTWEEK };
