

var hashTree = require('./hash-tree')
var EventEmitter = require('events').EventEmitter
var Store = require('./store2')

function filter (filename) {
  return (
    !~filename.indexOf('.git') 
  && !~filename.indexOf('.nodedrop') 
  && !/node_modules/.test(filename)
  )
}

module.exports = function (dir, _dir) {

  var emitter   = Store(dir, _dir)
  var first     = true

  emitter.poll = function (cb) {
    if(emitter.polling) return cb(new Error('currently polling'))
    emitter.polling = true
    hashTree(dir, filter, function (err, tree) {

      tree = hashTree.initTree(tree, emitter.tree || {})
      var change = hashTree.diffTree(tree, emitter.tree)
      
      emitter.polling = false

      if(Object.keys(change).length || first) {  
        first = false
        emitter.tree = tree
        emitter.emit('change', change, tree)
        if(cb) cb(null, change, tree)
      } else {
        emitter.emit('polled')
        if(cb) cb(null, null, tree)
      }
    })

  }

  emitter.watch = function () {

    function repoll () {

      emitter.poll(function (err, change, tree) {
        if(change)
          emitter.checkin(change, function () {
            emitter.emit('checkin', tree)
            setTimeout(repoll, 1000)
          })
        else
          setTimeout(repoll, 2000)
      })

    }

    repoll()
    return emitter
  }

  return emitter
}


if(!module.parent)
  module.exports(process.cwd()).watch().on('checkin', console.log)
