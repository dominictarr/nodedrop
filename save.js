
//for each hash object...,
//write out that file, indexed by it's content.


var gzip = require('zlib').createGzip
var fs   = require('graceful-fs')
var join = require('path').join
var shasum = require('shasum')

var tmpDir = '/tmp/content_store_tmp'
var nodedropDir = '/tmp/nodedrop'
var nodedropTreeDir = '/tmp/nodedrop/trees'

try { fs.mkdirSync(nodedropDir) }
catch (err) { if(err.code !== 'EEXIST') throw err }
try { fs.mkdirSync(tmpDir) }
catch (err) { if(err.code !== 'EEXIST') throw err }
try { fs.mkdirSync(nodedropTreeDir) }
catch (err) { if(err.code !== 'EEXIST') throw err }

//given a tree of files, and a dest directory,
//write out any that are not saved already.
//write out each file to a /tmp and then link it to the correct place.

module.exports = function (dir) {

  var r = {}

  r.put = function (hash, filename, cb) {
    r.prePut(hash, filename, function (err, mv) {
      if(err) return cb(err)
      mv(cb)
    })
  }

  r.prePut = function (hash, filename, cb) {

    var rs, ws, abort
    var prefix  = hash.substring(0, 2)

    var dest    = join(dir, prefix, hash.substring(2))
    var tmpFile = join(tmpDir, hash)

    fs.stat(filename, isMatch)
    fs.stat(dest, isMatch)

    var _stat
    function isMatch(err, stat) {
      if(abort) return
      if(!_stat) { _stat = stat || true; return }
      //if both files exist, skip.
      if(_stat && stat) {
        console.log('match1111')
        return cb()
      }

      function mv (cb) {
        console.log('mv', tmpFile, dest)
        fs.rename(tmpFile, dest, cb)
      }

      mv.source = tmpFile
      mv.dest   = dest

      fs.mkdir(join(dir, prefix), function (err) {
        //copy
        
        if(abort) return
        if(err && err.code !== 'EEXIST') return cb(err)
        rs = fs.createReadStream(filename)
        ws = fs.createWriteStream(tmpFile)
        rs.pipe(ws)
        ws.once('close', function () {
          cb(null, mv)
        })
      })      
    }

    //return a cancel function.
    //to be called if the something went wrong.
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
  fs.mkdir(nodedropDir, function (err) {
    if(err && err.code !== 'EEXIST') throw err

    var store = module.exports(nodedropDir)
    var dir = process.cwd()
    var cancel = [], move = []
    //hash the file tree, and save it ...
    //also, save the current tree.
    //when replicating, exchange hash(hash-tree)
    //if different, then exchange trees.
    //(save the other node's tree)
    //if you know the hash they have, and the hash you have
    //and your change is more recent, then diff and send.
    require('./hash-tree')(dir, function (filename) {
      return !~filename.indexOf('.git') && !~filename.indexOf('.nodedrop')
    }, function (err, hashes) {
      var n = 0
      for(var file in hashes) {
        n++
        var hash = hashes[file]
        file = join(dir, file)
        cancel.push(store.prePut(hash, file, next))
      }
      function next(err, mv) {
        console.log('next', n)
        if(err) {
          cancel.forEach(function (cancel) {
            cancel()
          })
          console.log('aborted')
        }
        if(mv) move.push(mv)
        if(--n) return
        var m = move.length
        console.log(move.length)
        move.forEach(function (mv) {
          mv(_next)
        })
        function _next(_) {
          if(--m) return
          //write out the whole tree
          var json = JSON.stringify(hashes)
          var hash = shasum(json)
          fs.writeFile(join(nodedropTreeDir, hash), json, function (err) {
            if(err) throw err
            console.log('done')
          })
        }
      }
    })
  })
}
