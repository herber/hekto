#!/usr/bin/env node

const koa = require('koa');
const app = koa();

const path = require('path');
const fs = require('fs');
const argument = require('argument.js');
const join = require('array-path-join');
const readChunk = require('read-chunk');
const fileType = require('file-type');
const isPathInside = require('path-is-inside');

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
  if -v  or --version option is passed in log the installed version of hekto to the console
*/
if (args.v || args.version) {
  console.log(require('../package.json').version);
  process.exit();
}

args._.splice(0, 1);

/*
  if `serve` command is passed in
*/
if (args.serve) {
  const port = args.port || 3000;
  const cache = args.maxage || 3600;

  // Add caching
  app.use(require('koa-cash')({
    maxAge: cache,
    get (key, maxAge) {
      return cache.get(key)
    },
    set (key, value) {
      cache.set(key, value)
    }
  }))

  // Add compression
  app.use(require('koa-compress')());

  // Add 500 error handling
  app.use(function *(next) {
    try {
      yield next;
    } catch (err) {
      this.status = 500;
      this.body = err;
      this.app.emit('error', err, this);
    }
  });

  // Add main webserver
  app.use(function *() {
    // Set path to requested file
    let argDir = '';

    if (join(args._)) argDir = join(args._);

    let file = path.join(process.cwd(), argDir, this.request.url);

    let dir = path.join(process.cwd(), argDir);
    // set 404 file
    const _404 = path.join(dir, '404.html');
    // set 200 file
    const _200 = path.join(dir, '200.html');
    // set query eg. my-site.com/test?user=me
    const query = this.querystring.length ? '?' + this.querystring : '';

    this.response.set('X-Powered-By', 'Hekto');

    if (!isPathInside(file, path.join(process.cwd(), argDir))) {
      this.body = 'Bad Request';
      this.status = 400;
    }

    // if requested file / directory exists
    if (fs.existsSync(file)) {
      // if `file` is a directory
      if (fs.lstatSync(file).isDirectory()) {
        // add `/index.html` to file
        file = path.join(file, 'index.html');

        // if file + `index.html` exists
        if (fs.existsSync(file)) {
          // add trailing slash
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

      // if `file` is a file
      if (fs.lstatSync(file).isFile()) {
        this.status = 200;

        if (path.extname(file) == '.html') {
          this.type = 'text/html';
          this.body = fs.createReadStream(file);
        } else if (path.extname(file) == '.css') {
          this.type = 'text/css';
          this.body = fs.createReadStream(file);
        } else {
          const fileBuffer = readChunk.sync(file, 0, 4100);
          const mime = fileType(fileBuffer);

          if (mime) {
            this.type = mime.mime + '; charset=utf-8';
          } else {
            this.type = 'text/plain; charset=utf-8';
          }

          this.body = fs.createReadStream(file);
        }
      }

      // if  nothing is served yet
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
      // 200.html for single page applications
      if (fs.existsSync(_200) && fs.lstatSync(_200).isFile() && _200 !== false) {
        if (this.request.url.slice(-1) !== '/') {
          this.status = 307;
          this.redirect(this.request.url + '/' + query);
        } else {
          this.status = 200;
          this.type = 'html';
          this.body = fs.createReadStream(_200);
        }

        return ;
      }

      // Add trailing slash for extensionless html
      if (fs.existsSync(file + '.html') && fs.lstatSync(file + '.html').isFile()) {
        this.status = 307;
        this.redirect(this.request.url + '/' + query);

        return ;
      }

      // Serve extensionless html
      if (fs.existsSync(file.slice(0, -1) + '.html') && fs.lstatSync(file.slice(0, -1) + '.html') && this.request.url.slice(-1) === '/' ) {
        this.status = 200;
        this.type = 'html';
        this.body = fs.createReadStream(file.slice(0, -1) + '.html');

        return ;
      }

      if (!this.body) {
        // requested file / directory does not exists
        this.status = 404;

        if (fs.existsSync(_404) && fs.lstatSync(_404).isFile() && _404 !== false) {
          this.type = 'html';
          this.body = fs.createReadStream(_404);
        } else {
          this.body = '404 - Not found';
        }
      }
    }
  });

  // serve on `port`
  app.listen(port);

  console.log('Serving on port ' + port);
}
