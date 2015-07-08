/**
 * Module dependencies.
 */

var path = require('path');
var fs = require('mz/fs');
var spawn = require('co-child-process');
var parse = require('co-busboy');
var os = require('os')
var uuid = require('node-uuid');

/**
 * Serve favicon.ico
 *
 * @param {String} path
 * @param {Object} [options]
 * @return {Function}
 * @api public
 */

module.exports = function cdn(contentDir, options){
  var icon
    , cache = path.resolve('./cache')
    , modes = {
      '/site/item/first-image': [
        '-strip',
        '-thumbnail', '383x558',
        '-background', 'transparent',
        '-gravity', 'center',
        '-extent', '558x558',
        '-interlace', 'Plane'
      ],
      '/site/item/first-image-2x': [
        '-strip',
        '-thumbnail', '766x1116',
        '-background', 'transparent',
        '-gravity', 'center',
        '-extent', '1116x1116',
        '-interlace', 'Plane'
      ],
      '/site/item/image': [
        '-strip',
        '-thumbnail', '558x558',
        '-background', 'transparent',
        '-gravity', 'center',
        '-extent', '558x558',
        '-interlace', 'Plane'
      ],
      '/site/item/image-2x': [
        '-strip',
        '-thumbnail', '1116x1116',
        '-background', 'transparent',
        '-gravity', 'center',
        '-extent', '1116x1116',
        '-interlace', 'Plane'
      ],
      '/site/item/ico-60': [
        '-strip',
        '-flatten',
        '-thumbnail', '60x60',
        '-gravity', 'center',
        '-extent', '60x60',
        '-interlace', 'Plane',
        '-quality', '80%'
      ],
      '/site/item/ico-60-2x': [
        '-strip',
        '-flatten',
        '-thumbnail', '120x120',
        '-gravity', 'center',
        '-extent', '120x120',
        '-interlace', 'Plane',
        '-quality', '80%'
      ],
      '/site/item/preview': [
        '-strip',
        '-flatten',
        '-thumbnail', '220x',
        '-interlace', 'Plane',
        '-quality', '80%'
      ],
      '/site/item/preview-2x': [
        '-strip',
        '-flatten',
        '-thumbnail', '440x',
        '-interlace', 'Plane',
        '-quality', '80%'
      ],
      '/ipad/menu/ico-110': [
        '-strip',
        '-thumbnail', '110x110',
        '-background', 'transparent',
        '-gravity', 'center',
        '-extent', '110x110',
        '-interlace', 'Plane'
      ],
      '/ipad/menu/ico-220': [
        '-strip',
        '-thumbnail', '220x220',
        '-background', 'transparent',
        '-gravity', 'center',
        '-extent', '220x220',
        '-interlace', 'Plane'
      ],
      '/ipad/item/preview': [
        '-strip',
        '-flatten',
        '-thumbnail', '226x',
        '-interlace', 'Plane',
        '-quality', '80%'
      ],
      '/ipad/item/preview-2x': [
        '-strip',
        '-flatten',
        '-thumbnail', '452x',
        '-interlace', 'Plane',
        '-quality', '80%'
      ],
      '/ipad/item/order': [
        '-strip',
        '-thumbnail', '180x200',
        '-background', 'transparent',
        '-gravity', 'center',
        '-extent', '180x200',
        '-interlace', 'Plane'
      ],
      '/ipad/item/preview-2x': [
        '-strip',
        '-thumbnail', '360x400',
        '-background', 'transparent',
        '-gravity', 'center',
        '-extent', '360x400',
        '-interlace', 'Plane'
      ],
      // admin
      '/admin/product/thumb': [
        '-strip',
        '-flatten',
        '-thumbnail', '100x100',
        '-interlace', 'Plane',
        '-quality', '80%'
      ],
      '/admin/product/thumb-2x': [
        '-strip',
        '-flatten',
        '-thumbnail', '200x200',
        '-interlace', 'Plane',
        '-quality', '80%'
      ],
      '/admin/product/search': [
        '-strip',
        '-flatten',
        '-thumbnail', '80x80',
        '-interlace', 'Plane',
        '-quality', '80%'
      ],
      '/admin/product/search-2x': [
        '-strip',
        '-flatten',
        '-thumbnail', '160x160',
        '-interlace', 'Plane',
        '-quality', '80%'
      ],
      '/admin/product/preview': [
        '-strip',
        '-flatten',
        '-thumbnail', '160x175',
        '-interlace', 'Plane',
        '-quality', '80%'
      ],
      '/admin/product/preview-2x': [
        '-strip',
        '-flatten',
        '-thumbnail', '320x350',
        '-interlace', 'Plane',
        '-quality', '80%'
      ]

    }
  if (contentDir) contentDir = path.resolve(contentDir);
  options = options || {};
  var maxAge = options.maxAge == null
    ? 86400000
    : Math.min(Math.max(0, options.maxAge), 31556926000);

  this.cors = function *cors(next) {
    if ('GET' !== this.method && 'HEAD' !== this.method && 'POST' !== this.method) {
      this.status = 'OPTIONS' == this.method ? 200 : 405;
      this.set('Allow', 'GET, HEAD, OPTIONS, POST, DELETE');
      this.set('Access-Control-Allow-Origin', '*');
      return;
    }
    yield* next;
  }

  this.uploader = function *uploader(next) {
    if(this.method === 'POST') {
      var parts = parse(this);
      var part;
      var uploaded = [];
      var file;

      while (part = yield parts) {
        var storedName = uuid.v4()
        var stream = fs.createWriteStream(path.join(contentDir, storedName));

        part.pipe(stream);
        var dataLength = 0
        var requestLength = this.request.length
        part.on('data', function (chunk) {
          dataLength += chunk.length
          console.log('uploading', Math.round(dataLength/requestLength*100));
        })
        console.log('uploading %s -> %s', part.filename, stream.path);
        file = {
          name: part.filename,
          uuid: storedName,
          fileName: path.join(contentDir, storedName),
          isImage: /image\/.*/.test(part.mimeType)
        }
        uploaded.push(file)
      }
      this.uploaded = uploaded
    }
    yield* next;
  }

  this.fileInfo = function *fileInfo(next) {
    if (this.uploaded && this.uploaded.length) {
      for (var i = 0; i < this.uploaded.length; i++) {
        var file = this.uploaded[i]
        if (file.isImage) {
          var info = yield spawn('identify', [file.fileName])
          info = info.split(' ')
          file.image = true
          file.format = info[1]
          file.width = info[2].split('x')[0]
          file.height = info[2].split('x')[1]
          delete file.fileName
        }
      }
      this.body = this.uploaded;
      return;
    }
    yield* next;
  }

  this.imageGenerator = function *imageGenerator(next){
    // generate image
    if(this.method === 'GET'){
      var mode = path.dirname(this.path)
        , type = path.extname(this.path)
        , id = path.basename(this.path, type)
        , reciept = modes[mode] && modes[mode].slice(0)

      try { yield fs.access(path.join(contentDir, id)) }
      catch (err) { throw err }
      try { yield fs.access(cache+mode) } catch (err) {
        try { yield spawn('mkdir', ['-p', path.join(cache, mode)]) }
        catch (err) { throw err }
      }
      if (!reciept) {
        throw new Error('no reciept')
      }
      reciept.unshift(path.join(contentDir, id))
      reciept.push(path.join(cache, mode, id+type))
      try { yield spawn('convert', reciept) }
      catch (err) { throw err }
      console.log('Info: Image '+id+' generated.');


      image = yield fs.readFile(path.join(cache, mode, id+type));

      this.set('Cache-Control', 'public, max-age=' + (maxAge / 1000 | 0));
      this.type = 'image/x-icon';
      this.body = image;
      return;
    }
    yield* next;
  }
  return this
};
