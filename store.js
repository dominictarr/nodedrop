
//for each hash object...,
//write out that file, indexed by it's content.


var gzip = require('zlib').createGzip
var fs   = require('fs') //require('graceful-fs')
var join = require('path').join
var shasum = require('shasum')
var through = require('through')

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

module.exports = function (dir, _dir) {
  var dropDir = _dir || nodedropDir
  try { fs.mkdirSync(dropDir) }
  catch (err) { if(err.code !== 'EEXIST') throw err }

  var r = {}, store = r

  r.putAll = function (tree, cb) {

    var n = 0, cancel = [], move = []
    for(var file in tree) {
      n++
      var hash = tree[file].hash || tree[file]
      file = join(dir, file)
      cancel.push(store.prePut(hash, file, next))
    }

    if(!n) return cb()

    function next(err, mv) {
      if(err) {
        console.log(err)
        cancel.forEach(function (cancel) { cancel() })
        return console.log('err'), cb(err)
      }
      if(mv) move.push(mv)
      if(--n) return console.log('n', n)

      var m = move.length
      move.forEach(function (mv) {
        mv(_next)
      })
      if(!move.length) return cb()
      function _next(_) {
        if(--m) return
        //everything has been saved!
        cb()
      }
    }
  }

  r.put = function (hash, filename, cb) {
    r.prePut(hash, filename, function (err, mv) {
      if(err) return cb(err)
      mv(cb)
    })
  }

  r.prePut = function (hash, filename, cb) {

    var rs, ws, abort
    var prefix  = hash.substring(0, 2)

    var dest    = join(dropDir, prefix, hash.substring(2))
    var tmpFile = join(tmpDir, hash)

    fs.stat(filename, isMatch)
    fs.stat(dest, isMatch)

    var _stat
    function isMatch(err, stat) {
      if(abort) return
      if(!_stat) { _stat = stat || true; return }
      //if both files exist, skip.
      if(_stat && stat) {
        console.log('retern')
        return cb()
      }

      function mv (cb) {
//        console.log('mv', tmpFile, dest)
        fs.rename(tmpFile, dest, cb)
      }

      mv.source = tmpFile
      mv.dest   = dest

      fs.mkdir(join(dropDir, prefix), function (err) {
        //copy
        console.log('ABORT')
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
      console.log('ABORT')
      return
      abort = true
//      ws.removeListener('close', mv)
      rs.destroy()
      ws.destroy()
      cb(new Error('aborted'))
    }
  }

  r.get = function (hash, encoding, cb) {
    var prefix = hash.substring(0, 2)
    fs.readFile(join(dir, prefix, hash.substring(2)), encoding, cb)
  }

  r.getStream = function (hash, encoding) {
    var prefix = hash.substring(0, 2)
    return fs.createReadStream(join(dropDir, prefix, hash.substring(2)), 
      {encoding: encoding}).on('error', function (err) {
        console.log("EROEHUROEHU", err)
      })
  }

  r.putStream = function (hash, encoding) {

    var ts = through().pause(), ws

    var prefix  = hash.substring(0, 2)
    fs.mkdir(join(dropDir, prefix), function (err) {
      //copy
      if(err && err.code !== 'EEXIST') return cb(err)

      ws = fs.createWriteStream(join(dropDir, prefix, hash.substring(2)),
        {encoding: encoding, flags: 'w', mode: 0666})
      ts.pipe(ws)
      ts.resume()
    })
    return ts
  }

  r.dir = dir

  return r
}

