require("dotenv").config();
const { getMysqlConfig } = require("./mysqlConfig");
const { runMigrations } = require("./runMigrations");

(async () => {
  const config = getMysqlConfig();
  if (!config) {
    console.error("Configure MySQL (MYSQLHOST / MYSQL_HOST and related vars) first.");
    process.exit(1);
  }
  await runMigrations(config);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
