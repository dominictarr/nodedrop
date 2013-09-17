
var duplex       = require('duplex')
var EventEmitter = require('events').EventEmitter
var hashTree     = require('./hash-tree')
var timestamp    = require('monotonic-timestamp')
var shasum       = require('shasum')
var Store        = require('./store')

function hash (obj) {
  if('string' === typeof obj)
    return shasum(obj)
  if(!obj) return shasum('')

  var o = {}
  for(var f in obj)
    o[f] = obj[f].hash

  return shasum(JSON.stringify(o))
}

function clone (obj) {
  var o = {}
  for (var k in obj)
  { o[k] = 'object' !== typeof obj[k] ? obj[k] : clone(obj[k]) }
  return o
}

module.exports = function (dir, storeDir) {

  var Watch = require('./watch')

  var emitter = Watch(dir, storeDir || dir + '/.nodedrop')
  var d = duplex()

  emitter.createStream = function (name) {

    var tophash = hash(emitter.tree)
    var tree    = clone(emitter.tree)
    var last = null
    var streams = {}

    var d = duplex()

    var syncing = false

    var other

    function sync (_other) {
      other = _other
      var send = hashTree.diffTree(emitter.tree, other) 
      var sending = clone(emitter.tree)

      if(Object.keys(send).length) {
        syncing = true
        var n = 0
        for(var file in send) (function (hash) {
          n++
          emitter.createReadStream(hash)
            .on('data', function (data) {
              d._data([hash, data])
            })
            .on('end', function () {
              d._data([hash, null])
              next()
            })
            .on('error', function (err) {
              console.log('stream err', err)
              throw err
            })

        })(send[file].hash)

        function next() {
          if(--n) return
          other = sending
          d.emit('synced')
          console.log('SYNC', other)
          syncing = false
        }
      }

    }


    d.on('_data', function (data) {
      
      //data will be two element array.
      var type  = data[0]
      var value = data[1]

      if (type == 'TREE') {
        sync(value)
      } else {
        //receive streams
        var stream =
          streams[type] = streams[type] || 
            emitter.createWriteStream(type)
            .on('error', function (err) {
              console.log('stream err', err)
              throw err
            })
            .on('end', function () {
              delete streams[type];
              if(!Object.keys(streams).length) {
                var checkout = hashTree.merge(emitter.tree || {}, other)
                console.log(checkout)
                other = emitter.tree = checkout
//                d._data(['tree', checkout])

                console.log('WOULD CHECKOUT NOW')
                console.log('WOULD CHECKOUT NOW')
                console.log('WOULD CHECKOUT NOW')
                console.log('WOULD CHECKOUT NOW')
                /*
                emitter.checkout(checkout, function (err, e) {
                  console.log('CHECKEDOUT')
                })
                */
              }
            })

        if(value) stream.write(value)
        else      stream.end()
      }
    })

    //send the tophash

    if(emitter.tree)
      d._data(['TREE', emitter.tree])
    else
      emitter.on('change', function () {
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

