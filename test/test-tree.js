var tape     = require('tape')
//var hashTree = require('../hash-tree')
var fs       = require('fs')
var Watch    = require('../watch')
tape('simple tree is correct', function (t) {

  try {
    fs.unlinkSync(__dirname + '/fix-simple/blah')
  } catch (_) { }

  function filter (fn) {
    return !fn.match('.nodedrop')
  }

  var watch = Watch(__dirname + '/fix-simple')

  watch.poll(function (err, change, tree) {

    t.equal(tree.bye.hash, 'e7d9b82b45d5833c9dada13f2379e7b66c823434')
    t.equal(tree.hi.hash,  'f572d396fae9206628714fb2ce00f72e94f2258f')

    console.log('tree1', tree)
    fs.writeFileSync(__dirname + '/fix-simple/blah', 'BLAH' + Math.random())

    watch.poll(function (err, change, _tree) {
      if(err) throw err

      console.log('change', change)

      console.log(tree, _tree)

      console.log(change)

      t.equal(tree.bye.hash, 'e7d9b82b45d5833c9dada13f2379e7b66c823434')
      t.equal(tree.hi.hash,  'f572d396fae9206628714fb2ce00f72e94f2258f')
      t.equal(_tree.bye.ts, tree.bye.ts)
      t.equal(_tree.hi.ts,  tree.hi.ts)
      t.end()

    })

  })

})


