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

export const CORPQUERY_ALLCONTRACTS = `
   WITH
    linked_contracts AS (
      SELECT tcn_contracts.* FROM tcn_contracts
      LEFT JOIN tcn_user_contract user_contract ON tcn_contracts.id = user_contract.contractid
      WHERE user_contract.userid = ? OR tcn_contracts.userid = ?
      GROUP BY tcn_contracts.id
    ),
    linked_companies AS (
      SELECT tcn_companies.id FROM tcn_companies
      LEFT JOIN tcn_user_company user_company ON tcn_companies.id = user_company.companyid
      WHERE user_company.userid = ? OR tcn_companies.userid = ?
      GROUP BY tcn_companies.id
    ),
    linked_contractors AS (
      SELECT tcn_contractors.id FROM tcn_contractors
      LEFT JOIN tcn_user_contractor user_contractor ON tcn_contractors.id = user_contractor.contractorid
      WHERE user_contractor.userid = ? OR tcn_contractors.userid = ?
      GROUP BY tcn_contractors.id
    ),
    all_contracts AS (
      SELECT tcn_contracts.* FROM tcn_contracts
      LEFT JOIN tcn_companies ON tcn_companies.id = tcn_contracts.companyid
      LEFT JOIN tcn_contractors ON tcn_contractors.id = tcn_companies.contractorid
      WHERE tcn_contractors.id IN (SELECT id FROM linked_contractors) OR tcn_companies.id IN (SELECT id FROM linked_companies) OR tcn_contracts.id IN (SELECT id FROM linked_contracts)
    )
`;

export { YESTERDAY, TODAY, LAST7DAYS, LASTWEEK };
