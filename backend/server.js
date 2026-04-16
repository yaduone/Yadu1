require('dotenv').config();
const app = require('./src/app');
const config = require('./src/config');
const { initCronJobs } = require('./src/jobs/nightlyManifest');

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Dairy Delivery API running on port ${PORT}`);
  console.log(`Timezone: ${config.timezone}`);
  console.log(`Manifest cutoff: ${config.manifestCutoffHour}:00`);
  console.log(`Manifest cron: ${config.manifestCronHour}:00`);

  // Initialize cron jobs
  initCronJobs();
});
