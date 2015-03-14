/**
 * Module dependencies.
 */

var path = require('path');
var fs = require('mz/fs');
var spawn = require('co-child-process');

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

    }
    // generate image
    if(this.method === 'GET'){
      var mode = path.dirname(this.path)
        , type = path.extname(this.path)
        , uuid = path.basename(this.path, type)
        , reciept = modes[mode] && modes[mode].slice(0)

      try { yield fs.access(path.join(contentDir, uuid)) }
      catch (err) { throw err }
      try { yield fs.access(cache+mode) } catch (err) {
        try { yield spawn('mkdir', ['-p', path.join(cache, mode)]) }
        catch (err) { throw err }
      }
      if (!reciept) {
        throw new Error('no reciept')
      }
      reciept.unshift(path.join(contentDir, uuid))
      reciept.push(path.join(cache, mode, uuid+type))
      try { yield spawn('convert', reciept) }
      catch (err) { throw err }
      console.log('Info: Image '+uuid+' generated.');


      image = yield fs.readFile(path.join(cache, mode, uuid+type));

      this.set('Cache-Control', 'public, max-age=' + (maxAge / 1000 | 0));
      this.type = 'image/x-icon';
      this.body = image;
    }
  };
};
