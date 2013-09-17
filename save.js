var Store = require('./store')
var hashTree = require('./hash-tree')


module.exports = function (nodedropDir, cb) {
  function init (cb) {
    fs.mkdir(nodedropDir, cb)
  }

  fs.mkdir(nodedropDir, function (err) {
    if(err && err.code !== 'EEXIST') throw err

    var store = Store(nodedropDir)
    var dir = process.cwd()
    var cancel = [], move = []
    //hash the file tree, and save it ...
    //also, save the current tree.
    //when replicating, exchange hash(hash-tree)
    //if different, then exchange trees.
    //(save the other node's tree)
    //if you know the hash they have, and the hash you have
    //and your change is more recent, then diff and send.
    hashTree(dir, function (filename) {
      return !~filename.indexOf('.git') && !~filename.indexOf('.nodedrop')
    }, function (err, hashes) {
      var n = 0
      //remember files to 
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

