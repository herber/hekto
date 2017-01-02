#!/usr/bin/env node

const koa = require('koa');
const app = koa();

const path = require('path');
const fs = require('fs');
const argument = require('argument.js');

/*
  set argument options
*/
argument.option('port', 'The port your content should be served on.', '3000');
argument.option('maxage', 'Maxage for http caching.', '3600');
argument.option('version', 'Shows the installed version of hekto.', true);
argument.option('v', 'Shows the installed version of hekto.', true);

/*
  set argument command
*/
argument.command('serve', 'Serve the current directory.');

/*
  parse arguments
*/
const args = argument.parse(process.argv.slice(2));

/*
  if -v  of  --version option is passed in log the installed version of hekto
*/
if (args.v || args.version) {
  console.log(require('../package.json').version);
  process.exit();
}

if (args.serve) {
  const port = args.port || 3000;
  const cache = args.maxage || 3600;

  app.use(require('koa-cash')({
    maxAge: cache,
    get (key, maxAge) {
      return cache.get(key)
    },
    set (key, value) {
      cache.set(key, value)
    }
  }))

  app.use(require('koa-compress')());

  app.use(function *(next) {
    try {
      yield next;
    } catch (err) {
      this.status = 500;
      this.body = err;
      this.app.emit('error', err, this);
    }
  });

  app.use(function *() {
    let file = path.join(__dirname, this.request.url);
    const _404 = path.join(__dirname, '404.html');
    const query = this.querystring.length ? '?' + this.querystring : '';

    this.response.set('X-Powered-By', 'Hekto');

    if (fs.existsSync(file)) {
      if (fs.lstatSync(file).isDirectory()) {
        file = path.join(file, 'index.html');

        if (fs.existsSync(file)) {
          if (this.request.url.slice(-1) !== '/') {
            this.status = 307;

            this.redirect(this.request.url + '/' + query);
          } else {
            this.status = 200;

            this.type = 'html';
            this.body = fs.createReadStream(file);
          }
        } else {
          this.status = 404;

          if (fs.existsSync(_404) && fs.lstatSync(_404).isFile() && _404 !== false) {
            this.type = 'html';
            this.body = fs.createReadStream(_404);
          } else {
            this.body = '404 - Not found';
          }
        }

        return ;
      }

      if (fs.lstatSync(file).isFile()) {
        this.status = 200;

        if (path.extname(file) == '.html') {
          this.type = 'html';
        } else {
          this.type = 'text/plain; charset=utf-8';
        }

        this.body = fs.createReadStream(file);

        return ;
      }

      if (!this.body) {
        this.status = 404;

        if (fs.existsSync(_404) && fs.lstatSync(_404).isFile() && _404 !== false) {
          this.type = 'html';
          this.body = fs.createReadStream(_404);
        } else {
          this.body = '404 - Not found';
        }
      }
    } else {
      this.status = 404;

      if (fs.existsSync(_404) && fs.lstatSync(_404).isFile() && _404 !== false) {
        this.type = 'html';
        this.body = fs.createReadStream(_404);
      } else {
        this.body = '404 - Not found';
      }
    }
  });

  app.listen(port);
}
