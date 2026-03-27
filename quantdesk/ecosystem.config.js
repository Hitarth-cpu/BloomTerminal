/**
 * PM2 process manager config.
 * Usage:
 *   npm install -g pm2
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'quantdesk-api',
      script: 'dist/server.js',
      cwd: './apps/api',
      instances: process.env.NODE_ENV === 'production' ? 'max' : 1,
      exec_mode: process.env.NODE_ENV === 'production' ? 'cluster' : 'fork',
      watch: false,
      env_development: { NODE_ENV: 'development', PORT: 3001 },
      env_production:  { NODE_ENV: 'production',  PORT: 3001 },
      error_file: './logs/api-error.log',
      out_file:   './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
