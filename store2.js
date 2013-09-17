var fs   = require('fs') //require('graceful-fs')
var KV   = require('kv')
var join = require('path').join

module.exports = function (dir, _dir) {
  _dir = _dir || dir+'/.nodedrop'

  var kv = KV(_dir)
  var streams = {}

  try { fs.mkdirSync(_dir) }
  catch (err) { if(err.code !== 'EEXIST') throw err }

  var emitter = new (require('events').EventEmitter)()
  var checking = false

  function check(bool) {
    if(checking && bool) throw new Error('store is checking in or out')

    if(!bool) 
      checking = false, emitter.emit('free'), console.log('FREE')
    else
      checking = true,  emitter.emit('lock'), console.log('LOCK')
  }

  emitter.checkin = function (tree, cb) {
    console.log('CHECKIN', tree)
    check(true)
    var n = 0
    for(file in tree) {
      n++
      //TODO lock files. THIS IS A PLACE TO USE DOMAINS!
      console.log('createReadStream', process.cwd(), file)
      fs.createReadStream(join(dir, file), {flags: 'r'}).on('error', function (err) {
          console.log('Read error', err)
        })
        .pipe(kv.put(tree[file].hash).on('error', function (err) {
          console.log('PUT error', err)
        }))
        .on('end', next)
    }

    function next() {
      if(--n) return
      check(false)
      cb()
    }
  }

  emitter.checkout = function (tree, cb) {
    console.log('CHECKOUT', tree)
    check(true)
    var n = 0
    for(file in tree) {
      n++
      //TODO lock files. THIS IS A PLACE TO USE DOMAINS!
      console.log('checkout', file, tree[file].hash, join(dir, file))
      kv.createReadStream(tree[file].hash)
        .on('data', console.log)
        .on('close', next)
        .pipe(fs.createWriteStream(join(dir, file)))
    }

    function next() {
      console.log(n)
      if(--n) return
      check(false)
      cb()
    }
  }

  emitter.createReadStream  = kv.createReadStream
  emitter.createWriteStream = kv.createWriteStream

  return emitter
}


