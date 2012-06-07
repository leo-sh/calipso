/**
 * Calipso, a NodeJS CMS
 *
 * This file is the core application launcher.  See app-cluster for visibility
 * of how the application should be run in production mode
 *
 * Usage:  node app, or NODE_ENV=production node app
 *
 */


var rootpath = process.cwd() + '/',
  path = require('path'),
  fs = require('fs'),
  express = require('express'),
  mongoose = require('mongoose'),
  nodepath = require('path'),
  stylus = require('stylus'),
  colors = require('colors'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  translate = require(path.join(rootpath, 'i18n/translate')),
  logo = require(path.join(rootpath, 'logo')),
  mongoStore = require(path.join(rootpath, 'support/connect-mongodb'));

// Local App Variables
var path = rootpath,
    theme = 'default',
    port = process.env.PORT || 3000;

/**
 * Catch All exception handler
 */
//process.on('uncaughtException', function (err) {
//  console.log('Uncaught exception: ' + err + err.stack);
//});

/**
 *  App settings and middleware
 *  Any of these can be added into the by environment configuration files to
 *  enable modification by env.
 */
function bootApplication(next) {

  // Create our express instance, export for later reference
  var app = express.createServer();
  app.path = path;
  app.isCluster = false;

  // Load configuration
  var Config = calipso.configuration; //require(path + "/lib/core/Config").Config;
  app.config = new Config();
  app.config.init(function(err) {

    if(err) return console.error(err.message);

    // Default Theme
    calipso.defaultTheme = app.config.get('themes:default');

    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.cookieParser());
    app.use(express.responseTime());

    // Create dummy session middleware - tag it so we can later replace
    var temporarySession = app.config.get('installed') ? {} : express.session({ secret: "installing calipso is great fun" });
    temporarySession.tag = "session";
    app.use(temporarySession);

    // Create holders for theme dependent middleware
    // These are here because they need to be in the connect stack before the calipso router
    // THese helpers are re-used when theme switching.
    app.mwHelpers = {};

    // Load placeholder, replaced later
    if(app.config.get('libraries:stylus:enabled')) {
      app.mwHelpers.stylusMiddleware = function (themePath) {
        var mw = stylus.middleware({
          src: themePath + '/stylus',
          dest: themePath + '/public',
          debug: false,
          compile: function (str, path) { // optional, but recommended
            return stylus(str)
              .set('filename', path)
              .set('warn', app.config.get('libraries:stylus:warn'))
              .set('compress', app.config.get('libraries:stylus:compress'));
          }
        });
        mw.tag = 'theme.stylus';
        return mw;
      };
      app.use(app.mwHelpers.stylusMiddleware(''));
    }
    // Static
    app.mwHelpers.staticMiddleware = function (themePath) {
      var mw = express["static"](themePath + '/public', {maxAge: 86400000});
      mw.tag = 'theme.static';
      return mw;
    };
    // Load placeholder, replaced later
    app.use(app.mwHelpers.staticMiddleware(''));

    // Core static paths
    app.use(express["static"](path + '/media', {maxAge: 86400000}));
    app.use(express["static"](path + '/lib/client/js', {maxAge: 86400000}));

    // Translation - after static, set to add mode if appropriate
    app.use(translate.translate(app.config.get('i18n:language'), app.config.get('i18n:languages'), app.config.get('i18n:additive')));

    // Core calipso router
    calipso.init(app, function() {

      // Add the calipso mw
      app.use(calipso.routingFn());

      // return our app refrerence
      next(app);

    })

  });

}

/**
 * Initial bootstrapping
 */
exports.boot = function (cluster, next) {

  // Bootstrap application
  bootApplication(next);

};

// allow normal node loading if appropriate
// e.g. not called from app-cluster or bin/calipso
if (!module.parent) {

  logo.print();

  exports.boot(false, function (app) {

    if (app) {
      app.listen(port, function () {
        console.log("Calipso version: ".green + app.about.version);
        console.log("Calipso configured for: ".green + (global.process.env.NODE_ENV || 'development') + " environment.".green);
        console.log("Calipso server listening on port: ".green + app.address().port);
      });
    } else {
      console.log("\r\nCalipso terminated ...\r\n".grey);
      process.exit();
    }

  });

}
