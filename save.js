
//for each hash object...,
//write out that file, indexed by it's content.

var gzip = require('zlib').createGzip
var fs   = require('graceful-fs')
var join = require('path').join

//given a tree of files, and a dest directory,
//write out any that are not saved already.
//write out each file to a /tmp and then link it to the correct place.

module.exports = function (dir) {

  var r = {}
  r.put = function (hash, filename, cb) {

    var rs, ws, abort
    var prefix = hash.substring(0, 2)
    var tmpHash = hash+(''+Math.random()).substring(2)

    function mv () {
      console.log('mv', tmpHash, join(dir, prefix, hash.substring(2)))
      fs.rename(tmpHash, join(dir, prefix, hash.substring(2)), cb)
    }

    fs.mkdir(join(dir, prefix), function (err) {
      if(abort) return
      if(err && err.code !== 'EEXIST') return cb(err)
      rs = fs.createReadStream(filename)
      ws = fs.createWriteStream(join('/tmp', tmpHash))
      rs.pipe(ws)
      ws.once('close', mv)
    })

    return function () {
      abort = true
      ws.removeListener('close', mv)
      rs.destroy()
      ws.destroy()
      cb(new Error('aborted'))
    }
  }

  r.get = function (hash, encoding, cb) {
    var prefix = hash.substring(0, 2)
    fs.readFile(join(dir, prefix, hash.substring(2)), encoding, cb)
  }

  r.dir = dir

  return r
}

if(!module.parent) {
  fs.mkdir('/tmp/content-store', function (err) {
    if(err && err.code !== 'EEXIST') throw err

    var store = module.exports('/tmp/content-store')

    require('./hash-tree')(process.cwd(), function (err, hashes) {
      var n = 0
      for(var file in hashes) {
        n++
        var hash = hashes[file]
        file = join(store.dir, file)
        store.put(hash, file, next)
      }
      function next() {
        if(--n) return
        console.log('done')
      }
    })
  })
}
