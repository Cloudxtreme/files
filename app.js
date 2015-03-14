var koa = require('koa')
  , contentPath = '../uploads'
  , cachePath = './cache'
  , cdn = require('./index.js')
  , logger = require('koa-logger')
  , serve = require('koa-static')

var app = koa();

app.use(logger());

// Note! Nginx try_files up to 3x faster. Tested
app.use(serve('cache'));

app.use(cdn(contentPath));

app.use(function *response (next){
  this.body = 'Hello World';
});

// app.on('error', function(err, ctx){
//   console.log('server error', err.toString());
// });

app.listen(4202)
