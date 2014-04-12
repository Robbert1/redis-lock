"use strict";

var Scripto = require('redis-scripto');


var acquireLock = function (client, lockName, timeout, retryDelay, onLockAquired) {
	function retry() {
		setTimeout(function() {
			acquireLock(client, lockName, timeout, retryDelay, onLockAquired);
		}, retryDelay);
	}

  var token = Math.random().toString(36).substr(2);
  client.set(lockName, token, 'NX', 'PX', timeout, function(err, result){
    if(err) return retry();

    if (result !== null) {
      onLockAquired(token);
    } else {
      retry();
    }
  });
};

module.exports = function(client, retryDelay) {
	if(!(client && client.setnx)) {
		throw new Error("You must specify a client instance of http://github.com/mranney/node_redis");
	}
  var scriptManager;

	retryDelay = retryDelay || 50;

	return function(lockName, timeout, taskToPerform) {
		if(!lockName) {
			throw new Error("You must specify a lock string. It is on the basis on this the lock is acquired.");
		}

		if(!taskToPerform) {
			taskToPerform = timeout;
			timeout = 5000;
		}

		lockName = "lock:" + lockName;

		acquireLock(client, lockName, timeout, retryDelay, function(token) {
			taskToPerform(function(done) {
        if(!scriptManager) {
          scriptManager = new Scripto(client);
          scriptManager.loadFromDir('scripts');
        }
        scriptManager.run('unlock', [lockName], [token], function(err, result) {
          if(!result)
            console.warn('failed to unlock as tokens did not match');
          if(done)
            done();
        });
			});
		});
	}
};
