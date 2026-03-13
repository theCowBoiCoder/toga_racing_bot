module.exports = {
  apps: [
    {
      name: 'iracing-bot',
      script: 'src/index.js',
      watch: false,
      max_memory_restart: '256M',
      env_file: '.env',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
