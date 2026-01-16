module.exports = {
  apps: [
    {
      name: 'warmly-backend',
      cwd: '/home/ubuntu/source/summer-loops/backend',
      script: 'src/index.ts',
      interpreter: '/home/ubuntu/.bun/bin/bun',
      env: {
        NODE_ENV: 'production',
        PORT: 7000,
        HOST: '0.0.0.0'
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: '/home/ubuntu/source/summer-loops/logs/backend-error.log',
      out_file: '/home/ubuntu/source/summer-loops/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
