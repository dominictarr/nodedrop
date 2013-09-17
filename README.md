# nodedrop

file replication with node.

# failed experiment

This was an attempt to build a dropbox like thing in node.js
pushing this so I can show juliangruber who is trying to build this idea.


this was an attemp at building a smooth sink protocol for node.

It hashes all the files in a directory, and then two nodes can replicate.

looking back at it, the replication part seems to work...
but the state where it decides to check out a file is broken...

now, I'm thinking that the best approach might be to scan the tree,
and replicate that information over scuttlebutt.

replicate the various versions of the file tree, with scuttlebutt,
and replicate the current state of each node in a separate scuttlebutt.
aka, the current hash they have.

that will be a much more flexible than currently. you'll be able to 
tell each node to checkout a particular stream, or put some nodes into
read-only mode (i.e, don't scan their file - other than to check the current state)

also, you could see a tree of the current states, and who has what,
on an admin screen, because that data is replicated via scuttlebutt.



## License

MIT
