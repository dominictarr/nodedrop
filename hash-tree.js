var ls = require('ls-r')
var fs = require('graceful-fs')

var relative = require('path').relative

var crypto = require('crypto')
var through = require('through')

function hashStream (alg, encoding) {
  var hash = crypto.createHash(alg || 'sha1')
  return through(function (data) {
    hash.update(data)
  }, function () {
    this.queue(hash.digest(encoding || 'hex'))
    this.queue(null)
  })
}

function hashTree (dir, cb) {

  ls(dir, function (err, _, files) {
    if (err) return cb(err)

    var n = files.length
    var hashes = {}, streams = []

    files.forEach(function (file) {
      if(file.isDirectory())
        return next()

      var rs = fs.createReadStream(file.path)
      streams.push(rs)

      rs.pipe(hashStream())
        .once('data', function (hash) {
          
          hashes[relative(dir, file.path)] = hash
          next()
        })
    })

    function next(err) {
      if(err) {
        while(streams) streams.shift().destroy()
        return cb(err)
      }
      if(--n) return
      //sort the keys, so that it's possible to consistently hash
      //the hashes object
      var _hashes = {}
      Object.keys(hashes).sort().forEach(function (k) {
        _hashes[k] = hashes[k]
      })
      cb(null, _hashes)
    }
  })
}

exports = module.exports = hashTree
exports.hashStream = hashStream

if(!module.parent)
  hashTree(process.cwd(), console.log)
