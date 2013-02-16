
var duplex       = require('duplex')
var EventEmitter = require('events').EventEmitter
var hashTree     = require('./hash-tree')
var timestamp    = require('monotonic-timestamp')
var shasum       = require('shasum')
var Store        = require('./store')

function hash (obj) {
  if('string' === typeof obj)
    return shasum(obj)
  return shasum(obj ? JSON.stringify(obj) : '')
}

function initTree (tree, old) {
  old = old || {}
  var ts = timestamp(), t = {}

  for(var file in tree) {
    var hash = tree[file].hash || tree[file]
    var _hash = old[file] ? old[file].hash : old[hash]
    if(!old[file]) {
      t[file] = {hash: hash, ts: ts}
    } else if(hash === _hash) {
      t[file] = old[file]
    } else {
      var _ts = tree[file].ts || ts
      console.log(_ts , old[file].ts)
      t[file] = clone(_ts > old[file].ts ? {hash: tree[file], ts: ts} : old[file])
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

function diffTree (mine, yours) {
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

module.exports = function (dir, storeDir) {

  var store = Store(dir, storeDir || dir + '/.nodedrop')
  var emitter = new EventEmitter() 
  var d = duplex()

  emitter.poll = function () {
    if(emitter.polling) return
    emitter.polling = true
    emitter.emit('polling')
    hashTree(dir, function (filename) {
      return (
        !~filename.indexOf('.git') 
      && !~filename.indexOf('.nodedrop') 
      && !/node_modules/.test(filename)
      )

    }, function (err, tree) {
      
      if(err) throw err
      tree = initTree(tree, emitter.tree || {})

      console.log('tree', tree)

      var ts = timestamp()

      var diff = diffTree(tree, emitter.tree) 
      if(!Object.keys(diff).length) {
        emitter.polling = false
        console.log('NOCHANGE')
        return emitter.emit('polled', emitter.tree)
      }
      console.log('DIFF?', diff)
      store.putAll(diff, function (err) {
        //NOW, we are ready to replicate these files.
        emitter.polling = false
        emitter.tree = tree
        console.log('CHANGE', tree)
        emitter.emit('changed', emitter.tree)
        emitter.emit('polled', emitter.tree)
      })
    })
  }

  emitter.on('polled', function () {
    console.log('POLLED')
    setTimeout(emitter.poll, 1000)
  })

  emitter.poll()

  emitter.createStream = function () {

    var tophash = hash(emitter.tree)
    var tree    = clone(emitter.tree)
      var last = null

    var d = duplex()

    var other

    d.on('_data', function (data) {
      
      //data will be two element array.
      var type  = data[0]
      var value = data[1]


      if(type == 'SYNC') {
        console.log('sync?', value, last)
        other = value
        if(!last || last != hash(emitter.tree)) {
          console.log('respond', last)
          d._data(['SYNC', last = tophash = hash(emitter.tree)])
        } else if (emitter.tree) {
          d._data(['TREE', emitter.tree]), sync = false
        }
      } else if (type == 'TREE') {

        //data to send
        var send = diffTree(tree, value) 

        console.log('SEND!!!', send)
      }
    })

    //send the tophash
    emitter.on('changed', function () {
      console.log('CHANGED', other)
      if(!other)
        d._data(['SYNC', last = tophash = hash(emitter.tree)])
      else if(other != hash(emitter.tree))
        d._data(['TREE', emitter.tree])
    })

    d.on('_end', function () {
      d._end()
    })

    return d

  }
  return emitter
}

if(!module.parent)
  module.exports(process.cwd())
