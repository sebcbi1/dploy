'use strict';

const Client = require('ftp');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const isString = require('lodash.isstring');
const merge = require('lodash.merge');
const logger = require('../logger');
const chalk = require('chalk');
const fixSlash = require('../util/fixSlash');


let connection = null;


module.exports = {

  connect(settings) {

    logger.spaced(1, chalk.yellow('Connecting to remote server...'));

    const options = settings.options;
    const config = merge({ secure: false, secureOptions: {} }, options, {
      host: settings.host,
      port: settings.port,
      user: settings.user,
      password: settings.pass
    });

    return new Promise(function(resolve, reject) {

      connection = new Client();
      connection.on('error', function(err) {

        logger.error(err);
        reject(new Error(err));

      });
      connection.on('ready', function() {

        logger.spaced(3, chalk.green('[connected]'));
        resolve(settings);

      });
      connection.connect(config);

    });

  },


  disconnect(settings) {

    return new Promise(function(resolve) {

      if (!connection) {

        return resolve(settings);

      }

      logger.debug(`Disconnecting from ${chalk.white(settings.target)}...`);

      connection.on('end', function() {

        connection = null;
        logger.debug(`Disconnected from ${chalk.white(settings.target)}`);
        resolve(settings);

      });
      connection.end();

    });

  },


  get(remotePath) {

    return new Promise(function(resolve, reject) {

      connection.get(fixSlash(remotePath), function(err, res) {

        if (err) {

          return reject(new Error(err));

        }
        resolve(res);

      });

    });

  },


  put(localPath, remotePath) {

    if (isString(localPath) && !fs.existsSync(localPath)) {

      return Promise.reject({
        local: localPath,
        remote: remotePath,
        reason: 'file not found'
      });

    }

    return new Promise(function(resolve, reject) {

      connection.put(localPath, fixSlash(remotePath), function(err) {

        if (err) {

          return reject({
            local: localPath,
            remote: remotePath,
            reason: err
          });

        }

        resolve({
          local: isString ? localPath : '',
          remote: remotePath
        });

      });

    });

  },


  delete(remotePath) {

    return new Promise(function(resolve, reject) {

      connection.delete(fixSlash(remotePath), function(err) {

        if (err && err.code !== 550) {

          return reject({
            remote: remotePath,
            reason: err
          });

        }

        resolve({ remote: remotePath });

      });

    });

  },


  mkdir(remotePath) {

    if (remotePath === null || remotePath === '.') {

      return Promise.resolve({ remote: remotePath });

    }

    return new Promise(function(resolve, reject) {

      connection.mkdir(fixSlash(remotePath), true, function(err) {

        if (err) {

          return reject({
            remote: remotePath,
            reason: err
          });

        }

        resolve({ remote: remotePath });

      });

    });

  }

};