RedisPipelineCommander
======================

 

>   With webpack-like just use\* import PipeCommander from
>   “RedisPipelineCommander”\*.

>   With native code use *import *PipeCommander* from
>   “./node_modules/*RedisPipelineCommander*/index.js”* or *\<script
>   src=“./node_modules/*RedisPipelineCommander*/index.js”\>*

**!Use it with nodejs and redis**

 

For the first you need to do like:

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
import PipeCommander from 'RedisPipelineCommander';

const optionsPipelineCommander = {
    redisNodesSettings, //host and port of a redis nodes
    ioRedisOptions, //specified by the ioredis library    
    options : optionsPipelineCommander //especially for the PipelineCommander library
};
const redisClient = new PipeCommander(optionsPipelineCommander);
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

where:

-   redisNodesSettings {object[]} - settings for redis nodes, created with
    [ioredis library](https://github.com/luin/ioredis). Like

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
new Redis(redisNodesSettings[i],....)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

-   ioRedisOptions {object} - settings for ioredis lib

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
new Redis(redisNodesSettings[i],ioRedisOptions )
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

-   options {object} - options used by this lib

    -   options.timeInterval {number} - ms, defie time interval to send a
        pipeline to the node

    -   option.maxQueueLength {number} - max queries limit. If more, then send
        all queries from the queue to a redis node

 

If you use a LUA scripts you need to load them before any other command:

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//list with lua scripts to load
const luaScripts = []; //[scriptName1, scriptBody1....scriptNameN, scriptBodyN]
//load lua script to the redis cache
redisClient.start //after the redis has started
        .then(function(redisClient){
            "use strict";
            for( let i = 0, len = luaScripts.length; i < len; i++ ) { //for each script that was defined
                redisClient.scriptLoad(luaScripts[i], luaScripts[++i]) //load it to the redis
                    .then(function(res){
                        if ( res !== true ) { //if an error
                            _log("Can't load script called " + luaScripts[i]);    
                        }    
                    });
            }    
        });
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

 

To execute a redis command just call it:

`redisClient[commandName](keyDb,
commandArg1....).then(result=>{}).catch(err=>{})`

For LUA  (can be applied only for a one key):

`redisClient.scriptExec(”scriptName”, keyDb, [scriptArg1, .., scriptArgN
`]).then(..).catch(..)

If you deal with a transaction (all commands of the transaction must be applied
only for a one key):

`redisClient`.multi(dbKey, [command1...commandN]).then(results=\>{...}), where

-   commandN - [ “redisCommandName”,
    redisCommandArgument1...redisCommandArgumentN]

    -   results[ command1Result ....commandNResult ]
