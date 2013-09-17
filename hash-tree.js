var ls = require('ls-r')
var fs = require('graceful-fs')

var relative = require('path').relative

var crypto = require('crypto')
var through = require('through')
var timestamp = require('monotonic-timestamp')

function hashStream (alg, encoding) {
  var hash = crypto.createHash(alg || 'sha1')
  return through(function (data) {
    hash.update(data)
  }, function () {
    this.queue(hash.digest(encoding || 'hex'))
    this.queue(null)
  })
}

function hashTree (dir, filter, cb) {
  if(!cb)
    cb = filter, filter = null

  ls(dir, function (err, _, files) {
    if (err) return cb(err)

    var n = files.length
    var hashes = {}, streams = []

    files.forEach(function (file) {
      if(file.isDirectory())
        return next()
      var name = relative(dir, file.path)
      if(filter && !filter(name, file))
        return next()
      var rs = fs.createReadStream(file.path)
      streams.push(rs)

      rs.pipe(hashStream())
        .once('data', function (hash) {
          hashes[name] = {hash: hash, ts: timestamp()}
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
exports.initTree

exports.init = 
exports.initTree = function (tree, old) {
  old = old || {}
  var ts = timestamp(), t = {}

  for(var file in tree) {
    var hash = tree[file].hash
    var _hash = old[file] ? old[file].hash : old[hash]
    if(!old[file]) {
      t[file] = {hash: hash, ts: ts}
    } else if(hash === _hash) {
      t[file] = old[file]
    } else {
      var _ts = tree[file].ts || ts
      t[file] = clone(_ts > old[file].ts ? {hash: tree[file].hash, ts: ts} : old[file])
    }
  }

  return t
}

function clone (o) {
  var c = {}
  for(var k in o)
    c[k] = o[k]
  return c
}

function greatest (m, y) {
  return clone((function () {
    if(!m) return y
    if(!y) return m
    //if hashes are same, use the oldest ts.
    if(m.hash == y.hash)
      return m.ts < y.ts ? m : y
  
    return m.ts > y.ts ? m : y  
  })())
}

exports.diffTree = function (mine, yours) {
  if(!yours) return mine
  //find files to SEND
  var send = {}
  for (var file in mine) {
    if(!yours[file])
      send[file] = clone(mine[file])
    else if(yours[file].hash !== mine[file].hash 
        && (yours[file].ts || ts) < mine[file].ts
      ) send[file] = clone(mine[file])
  }

  return send
}

exports.merge = function (mine, yours) {
  for(var file in yours) {
    mine[file] = greatest(mine[file], yours[file])
  }
  return mine
}

if(!module.parent)
  hashTree(process.cwd(), function (err, t) {
    var j = {}, o = {}
    for(var k in t) {
      j[t[k].hash] = k
    }

    Object.keys(j).sort().forEach(function (h) {
      o[h] = j[h]
    })

    console.log(j)
  })
