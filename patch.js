var fs = require('graceful-fs')
var diff = require('adiff').diff
var join = require('path').join

//SO, connect to a remote instance,
//send the hash of your current state...
//if you are different, enter exchange protocol.

//exchange protocol:
//send hash trees, decide who patches who.
//in deploy-mode latest update patches the whole other end
//in collab-mode patch any file that is later patches any other...
//... so, generate patches, and send.
//other side applies patches, into content-store
//and then checks out files...

//then, sends it's new top-hash,
//the sender will recieve this, and since they are the same,
//the exchange will end.

//then, the each end will record that when it last exchanged with X (other server)
//they where at -> hash(tree)

//this information can be used to GC objects that nobody needs anymore.

module.exports = function (a, b) {

  //a,b should be paths to tree hashes
  
  var A = JSON.parse(fs.readFileSync(a))
  var B = JSON.parse(fs.readFileSync(b))

  function open (hash) {
    var prefix = hash.substring(0, 2)
    var rest   = hash.substring(2)
    return fs.readFileSync(join('/tmp/nodedrop', prefix, rest), 'utf-8')
  }

  console.log(A, B)
  var hashes = {}
  for(var k in A) {
    if(B[k] != A[k]) {
      var d = hashes[k] = {source: A[k], dest: B[k]}
      
      var _a = open(A[k]).split('\n')
      var _b = open(B[k]).split('\n')

      d.diff = diff(_a, _b)
      console.log(d.diff)
    }
  }

  console.log(hashes)
}

if(!module.parent) {
  module.exports(process.argv[2], process.argv[3], function (err, patch) {

  })
}
