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

module.exports = function (contentDir, options){
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
      '/site/item/image': [
        '-strip',
        '-thumbnail', '358x558',
        '-background', 'transparent',
        '-gravity', 'center',
        '-extent', '558x558',
        '-interlace', 'Plane'
      ],
      '/admin/item/thumb': [
        '-strip',
        '-flatten',
        '-thumbnail', '100x100',
        '-interlace', 'Plane',
        '-quality', '80%'
      ],
      '/admin/item/thumb-2x': [
        '-strip',
        '-flatten',
        '-thumbnail', '200x200',
        '-interlace', 'Plane',
        '-quality', '80%'
      ],
      '/admin/item/ico-80': [
        '-strip',
        '-flatten',
        '-thumbnail', '80x80',
        '-interlace', 'Plane',
        '-quality', '80%'
      ],
      '/admin/item/ico-80-2x': [
        '-strip',
        '-flatten',
        '-thumbnail', '160x160',
        '-interlace', 'Plane',
        '-quality', '80%'
      ],
      '/admin/item/prev': [
        '-strip',
        '-flatten',
        '-thumbnail', '160x175',
        '-interlace', 'Plane',
        '-quality', '80%'
      ],
      '/admin/item/prev-2x': [
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

  return function *cdn(next){

    // if ('GET' !== this.method && 'HEAD' !== this.method) {
    //   this.status = 'OPTIONS' == this.method ? 200 : 405;
    //   this.set('Allow', 'GET, HEAD, OPTIONS, POST, DELETE');
    //   return;
    // }

    // Upload
    if(this.method === 'POST') {
      var parts = parse(this);
      var part;
      var uploaded = [];
      var file;

      while (part = yield parts) {
        var storedName = uuid.v4()
        var stream = fs.createWriteStream(path.join(cache, storedName));
        part.pipe(stream);
        console.log('uploading %s -> %s', part.filename, stream.path);
        file = {name: part.filename, uuid: storedName, fileName: path.join(cache, storedName)}
        if (/image\/.*/.test(part.mimeType)) {
          var info = yield spawn('identify', [file.fileName])
          info = info.split(' ')
          file.image = true
          file.format = info[1]
          file.width = info[2].split('x')[0]
          file.height = info[2].split('x')[1]
          uploaded.push(file)
        }
      }

      this.body = uploaded
      yield next
    }
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
    }
  };
};
