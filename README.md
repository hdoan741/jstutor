Javascript backend for OPT (https://github.com/pgbovine/OnlinePythonTutor)

Implementation using NodeJS & V8debugger.

== Installation

You will need to open TCP port 5858 to allow the server connect to the JS debugger.

1. Install nodejs

        https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager

2. Install dependency packages

        $ npm install

3. Run the server

        $ PORT=80 node server.js

3.1 You can also use the Forever package to keep the server running

        https://github.com/nodejitsu/forever

        $ npm install forever -g
