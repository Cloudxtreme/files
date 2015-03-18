var koa = require('koa')
  , contentPath = '../uploads'
  , cachePath = './cache'
  , cdn = require('./index.js')
  , logger = require('koa-logger')
  , serve = require('koa-static')

var path = require('path');
var fs = require('mz/fs');
var spawn = require('co-child-process');
var parse = require('co-busboy');
var os = require('os')
var uuid = require('node-uuid');


var app = koa();

app.use(logger());

// Note! Nginx try_files up to 3x faster. Tested
app.use(serve('cache'));

app.use(cdn(contentPath));

app.listen(4202)
