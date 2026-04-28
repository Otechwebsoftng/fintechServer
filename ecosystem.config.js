module.exports = {
  apps: [
    {
      name: 'fintechServer',
      script: 'dist/main.js',
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};

// pm2 start ecosystem.config.js

//Start application and watch for changes in development mode
// pm2 start ecosystem.config.js --env development --watch

// PM2 will launch 4 processes (one per core). You can check with pm2 list or pm2 monit.
// To stop the application, use pm2 stop fintechServer or pm2 stop all.
