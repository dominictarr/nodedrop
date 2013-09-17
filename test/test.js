
var rep = require('../replicate')

var a = rep(__dirname + '/fix-a').watch()
var b = rep(__dirname + '/fix-b').watch()

var as = a.createStream('A')
var bs = b.createStream('B')

as.on('data', function (h) {
  console.log('A', h)
})

bs.on('data', function (h) {
  console.log('B', h)
})

as.pipe(bs).pipe(as)

//*/
