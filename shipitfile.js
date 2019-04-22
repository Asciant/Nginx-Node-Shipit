module.exports = shipit => {
  require('shipit-deploy')(shipit);
  require('shipit-shared')(shipit);

  const appName = 'App';

  shipit.initConfig({
    default: {
      deployTo: '/srv/www/example.com',
      repositoryUrl: 'git@github.com:Asciant/hello-world.git',
      keepReleases: 5,
      shared: {
        overwrite: true,
        dirs: ['node_modules']
      }
    },
    production: {
      servers: 'deployer@centos-ap-north.asciant.com'
    }
  });

  // Path to our PM2 ecosystem file on the remote server (that we created)
  const path = require('path');
  const ecosystemFilePath = path.join(
    shipit.config.deployTo,
    'shared',
    'ecosystem.config.js'
  );

  shipit.blTask('copy-config', async () => {
    // PM2 SPECIFIC LOGIC
    const fs = require('fs');
    const ecosystem = `
module.exports = {
  apps: [
    {
      name: '${appName}',
      script: '${shipit.releasePath}/index.js',
      watch: true,
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};`;

    fs.writeFileSync('ecosystem.config.js', ecosystem, function(err) {
      if (err) throw err;
      console.log('File created successfully.');
    });

    await shipit.copyToRemote('ecosystem.config.js', ecosystemFilePath);
  });

  shipit.blTask('npm-install', async () => {
    shipit.remote(`cd ${shipit.releasePath} && npm install --production`);
  });

  shipit.blTask('pm2-server', async () => {
    await shipit.remote(`pm2 delete -s ${appName} || :`);
    await shipit.remote(
      `pm2 start ${ecosystemFilePath} --env production --watch true`
    );
  });

  shipit.on('updated', async () => {
    shipit.start('npm-install', 'copy-config');
  });

  shipit.on('published', async () => {
    shipit.start('pm2-server');
  });
};
