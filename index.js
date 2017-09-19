/*
    use myPipeCommander.start.then for the first time
*/
import Promise from "bluebird";
import Redis from "ioredis";

//concat two arrays. Return an array where the first elements from the arr1, and the following - from the arr2
function concatArrays(arr1, arr2) {
    var res;
    if ( arr2 === undefined ) {
        res = arr1;    
    } else if ( arr2.length === 1 ) {
        res = arr1;
        res[res.length] = arr2[0];    
    } else {
        Array.prototype.push.apply( arr1, arr2); 
        res = arr1;   
    }
    return res;
}

function hashFunction(s) { //java object.hashCode
    var hash,
        strlen = s.length,
        i;
    if ( strlen === 0 ) {
        return hash;
    }
    
    //try to convert string to number
    var num = Number(s);
    if ( isNaN(num) === false ) { //if the string for hashing is a number return the number as the result
        return num; 
    }
    
    for ( i = 0, hash = 0; i < strlen; i++ ) {
        hash = ((hash << 5) - hash) + s.charCodeAt( i );
        hash &= hash; // Convert to 32bit integer
    }
    return hash < 0 ? -hash : hash;
}

//check if a pipeline return an error as the result of execution
function afterPipelineCheckIfError(err, results){
    return err !== null ? err : results;
}

/*
    after when a pipeline with the given command had executed
    this function was bound to an array with queued commands, that are into the pipeline
    result[i] linked with this[i]
    Promise for the command will be resolved with result[i], where i = index into the result and the commands queue
*/
function afterPipelineDone(results) {
    if (results instanceof Error === false
        && results instanceof Array
        && this instanceof Array
        && this._resulted !== true ) { //was bound to the queuedCommands array, where this[command_index][2] = promise, that was return as the resulted promise, pending for the result of it's execution
            var currentCommandIndexFromQueue = 0; //index for queued command
            for ( var commandIndex = 0, len = results.length; commandIndex < len; commandIndex++ ) { //for the result of each command
                var commandDesc = this[currentCommandIndexFromQueue];
                        
                if ( commandDesc !== undefined ) {
                    
                    var resultOfPipelinedCommand = results[commandIndex]; //[error, result], error = instance of Error or null, result = result of the command execution in pipeline mode
                    var promiseForCommand = commandDesc[2]; //promise, that was returned as the result of the command, and it is necessary to resolve or to reject it
                    
                    currentCommandIndexFromQueue++;
                        
                    var commandName = commandDesc[0]; 
                    if ( commandName === "multi" ) { //if transaction
                        if ( resultOfPipelinedCommand[0] === null
                            && resultOfPipelinedCommand[1] === "OK" ) { //if the transaction starts ok
                                //the number of a commands within this transaction. commandDesc[1] - arguments = array of a commands for transaction
                                commandIndex = commandIndex + commandDesc[1].length + 1; //set index for the next result for a queued command
                                var resultOfTransaction = results[commandIndex]; //the result of the transaction. +1 because of the exec command
                                
                                if ( resultOfTransaction[0] === null ) { //if it is transaction without an errors
                                   promiseForCommand._fulfill(resultOfTransaction[1]);  //return the result of the transaction     
                                } else { //if an error has occurred
                                    if ( resultOfTransaction[0].message !== undefined ) {
                                        promiseForCommand._fulfill(new Error(resultOfTransaction.message));  //return an error to the promise     
                                    } else {
                                        promiseForCommand._fulfill(new Error(resultOfTransaction[0].toString()));
                                    }
                                }    
                        } else {
                            //the number of a commands within this transaction. commandDesc[1] - arguments = array of a commands for transaction
                            commandIndex = commandIndex + commandDesc[1].length + 1; //set index for the next result for a queued command
                            promiseForCommand._reject(new Error(resultOfPipelinedCommand.toString()));    
                        }
                    } else {
                        if ( promiseForCommand._fulfill !== undefined ) { //resolve or reject the Promise for command with the result from pipeline execution
                            if ( resultOfPipelinedCommand[0] !== null ) {
                                promiseForCommand._reject(new Error(resultOfPipelinedCommand[0].toString()));
                            } else {
                                promiseForCommand._fulfill(resultOfPipelinedCommand[1]); //reject with the error as the result
                            }
                        }
                    }
                    
                }
            }
            
            this._resulted = true; //set the flag that the results for the queue were recevied
            
    } else if ( results instanceof Error === true ) {
        console.log("Error. PipeCommander : ");
        console.log(results.message);
        console.log(results.stack);
    } else {
        console.log("Something going wrong");    
    }
}

/*
    reject commands in commands queue with the given error
*/
function rejectCommandsQueue(commandsQueue, err) {
    if ( commandsQueue instanceof Array ) {
        commandsQueue._resulted = true;
        for( var i = 0, len = commandsQueue.length; i < len; i++ ) {
            var command = commandsQueue[i][2]; //Promise for the command
            if (typeof(command.isPending) === "function" //if the method is exists
                && command.isPending(command) === true ) { //if not fullfield or rejected before
                    command._reject(err);    
            }    
        }
    }    
}

/*
    on error has occurred when a pipeline was performed
*/
function onPipelineError(e) {
    rejectCommandsQueue(this, e != null ? e : new Error("Unknown error")); //reject all commands from the list with the error
}

//create and execute a pipeline, only for the one specified redis node
function notBound_makePipelinesFromQueuedCommandsForNode(nodeID) {
    const queuedCommandsForNode = this.queuedCommandsForNodes[nodeID]; //list of a commands from the queue
    if ( queuedCommandsForNode === undefined ) {
        return;    
    }
    const queueLength = queuedCommandsForNode.length;
    if ( queueLength > 0 ) {
        const pipelinedCommandsForNode = []; //create a resulted pipeline for node
        var pipelineCommandIndex = 0;
        for ( var i = 0; i < queueLength; i++  ) { //add queued command to the resulted pipeline
            
            var commandDesc = queuedCommandsForNode[i];
            var commandName = commandDesc[0];
            var commandArgs = commandDesc[1]; //array with arguments for the command
            var pipelinedCommand = pipelinedCommandsForNode[pipelineCommandIndex] = [commandName]; //add the name of the command
            
            var len = commandArgs.length;  //a number of the arguments for the redis command
            var ii;
            if ( commandName === "multi" ) {
                for( ii=0; ii < len; ii++ ) {
                    pipelinedCommandsForNode[++pipelineCommandIndex] = commandArgs[ii]; 
                }
                pipelinedCommandsForNode[++pipelineCommandIndex] = ["exec"]; 
            } else {
                if ( len === 1 ) { pipelinedCommand[1] = commandArgs[0]; }
                else if ( len === 2 ) { pipelinedCommand[1] = commandArgs[0];  pipelinedCommand[2] = commandArgs[1]; }
                else if ( len === 3 ) { pipelinedCommand[1] = commandArgs[0];  pipelinedCommand[2] = commandArgs[1]; pipelinedCommand[3] = commandArgs[2]; }
                else if ( len === 4 ) { pipelinedCommand[1] = commandArgs[0];  pipelinedCommand[2] = commandArgs[1]; pipelinedCommand[3] = commandArgs[2]; pipelinedCommand[4] = commandArgs[3]; }
                else if ( len === 5 ) { pipelinedCommand[1] = commandArgs[0];  pipelinedCommand[2] = commandArgs[1]; pipelinedCommand[3] = commandArgs[2]; pipelinedCommand[4] = commandArgs[3]; pipelinedCommand[5] = commandArgs[4]; }
                else if ( len === 6 ) { pipelinedCommand[1] = commandArgs[0];  pipelinedCommand[2] = commandArgs[1]; pipelinedCommand[3] = commandArgs[2]; pipelinedCommand[4] = commandArgs[3]; pipelinedCommand[5] = commandArgs[4]; pipelinedCommand[6] = commandArgs[5]; }
                else if ( len === 7 ) { pipelinedCommand[1] = commandArgs[0];  pipelinedCommand[2] = commandArgs[1]; pipelinedCommand[3] = commandArgs[2]; pipelinedCommand[4] = commandArgs[3]; pipelinedCommand[5] = commandArgs[4]; pipelinedCommand[6] = commandArgs[5]; pipelinedCommand[7] = commandArgs[6]; }
                else if ( len === 8 ) { pipelinedCommand[1] = commandArgs[0];  pipelinedCommand[2] = commandArgs[1]; pipelinedCommand[3] = commandArgs[2]; pipelinedCommand[4] = commandArgs[3]; pipelinedCommand[5] = commandArgs[4]; pipelinedCommand[6] = commandArgs[5]; pipelinedCommand[7] = commandArgs[6]; pipelinedCommand[8] = commandArgs[7]; }
                else if ( len === 9 ) { pipelinedCommand[1] = commandArgs[0];  pipelinedCommand[2] = commandArgs[1]; pipelinedCommand[3] = commandArgs[2]; pipelinedCommand[4] = commandArgs[3]; pipelinedCommand[5] = commandArgs[4]; pipelinedCommand[6] = commandArgs[5]; pipelinedCommand[7] = commandArgs[6]; pipelinedCommand[8] = commandArgs[7]; pipelinedCommand[9] = commandArgs[8]; } 
            }
            pipelineCommandIndex++; //increment the index of the next command in the pipeline
        }
        
        //execute the pipeline formed from the queued commands
        this
        .redisNodes[nodeID] //ioredis instance
        .pipeline(pipelinedCommandsForNode) //make a pipeline from array with pipelined commands for the redis node
        .exec() //execute the pipeline
        .bind(queuedCommandsForNode) //bound to the queued commands for binding results of the commands execution with the commands from the queue 
        .then(afterPipelineDone, onPipelineError); //check if an error was returned as the result and return the results if there is no errors
        
        return queuedCommandsForNode;
    }    
}

//create and execute pipelines for all nodes in the redis cluster
function notBound_makePipelinesFromQueuedCommandsForNodes(nodeID){
    var pipelinedCommands;
    
    const currentTimestamp = Date.now();
    const executingCommandsForNodes = this.executingCommandsForNodes;
    const queuedCommandsForNodes = this.queuedCommandsForNodes;
    const timestampsLastExecutionForNodes = this.timestampsLastExecutionForNodes;
    
    if ( nodeID === undefined ) { //executed not for the specified node, but for all redis nodes
        var numOfNodes = this.numOfNodes;
        var _nodeID;
        
        for ( _nodeID = 0; _nodeID < numOfNodes; _nodeID++ ) {
            
            /*
                check if the previos commands are not fulfilled
                then reject them with timeout
            */
            var executingCommands = executingCommandsForNodes[_nodeID];
            if ( executingCommands != null
                && executingCommands.length > 0
                && executingCommands._resulted !== true ) { //if the executing commands are still not get a results
                    this.rejectCommandsQueue(executingCommands, new Error("Timeout")); //reject all commands with the timeout error
            }
            
            executingCommandsForNodes[_nodeID] = null; //clear the list with the executing commands
            
            if ( (currentTimestamp - timestampsLastExecutionForNodes[_nodeID]) > this.timeInterval ) { //more than 300ms has passed since the last execution of pipeline for this redis node
                pipelinedCommands = this.makePipelinesFromQueuedCommandsForNode(_nodeID);
                queuedCommandsForNodes[_nodeID] = []; //reset queues with a commands for all the redis nodes
                timestampsLastExecutionForNodes[_nodeID] = currentTimestamp;
                executingCommandsForNodes[_nodeID] = pipelinedCommands;
            }
            
        }
    } else {
        pipelinedCommands = this.makePipelinesFromQueuedCommandsForNode(nodeID);
        queuedCommandsForNodes[nodeID] = []; //reset queue of a commands for the specified node
        timestampsLastExecutionForNodes[nodeID] = currentTimestamp;
        executingCommandsForNodes[_nodeID] = pipelinedCommands;
    }
}

var defferedPromise = new Promise(function(resolve, reject){});
function returnResult(res){return res;}
//add a redis command to the pipelines queue for redis node in the cluster
function notBound_commandToPipeline( nodeInd, commandName, commandArguments ) {
    var queueCommandsForNode = this.queuedCommandsForNodes[nodeInd];
    var indInQueue = queueCommandsForNode.length;

    var pendingPromise = this.defferedPromise //create a pending promise, that will be resolved or rejected with the result from a pipeline
                        .then(this.returnResult);

    queueCommandsForNode[indInQueue] = [commandName, commandArguments, pendingPromise]; //put the description to the queue

	if ( indInQueue > this.maxQueueLength ) {
		this.makePipelinesFromQueuedCommandsForNodes(nodeInd);
	}

    return pendingPromise;
}

/*
    add the given command to the queue for execution withing a pipeline
    commandName = redis command
    commandArguments = Array, contains an arguments for the command
    key = key for which the command is used
*/
function notBound_execCommand(commandName, commandArguments) {
    return this.commandToPipeline(this.nodeByKey(commandArguments[0], commandArguments), commandName, commandArguments); //commandArguments[0] = key. By the key we can defined the corresponding node for this key.
}

/*
    start the transaction
*/
function notBound_multi(key, commands) {
    return this.commandToPipeline(this.nodeByKey(key), "multi", commands); //commandArguments[0] = key. By the key we can defined the corresponding node for this key.
}

/*
    define a lua scripts for redis
    name - name of the script
    script - script string with the lua script
    return true if there is no errors or false
*/
function notBound_scriptLoad(scriptName, script) {
    "use strict";
    var len = this.commander.redisNodes.length;
    var listPromises = []; //list with a promises, that will be generated within the cycle
    var self = this;
    var scriptHashForNodes = (self.redisNodesScripts[scriptName] = []); //the store of the sha hashes of the script returned by each redis node
    for( let i = 0; i < len; i++ ) { //load the script to each redis node
        listPromises[i] = this.commandToPipeline(i, "script", ["LOAD", script]) //command for loading scrits onto the redis cache
        .then(function(shaDigest){ //put the script sha hash to the redis node script store
            if ( shaDigest instanceof Error ) {
                throw shaDigest;    
            } else {
                scriptHashForNodes[i] = shaDigest;        
            }
        })
        .catch(function(e){
            console.log("Can't to load script + " + scriptName + " + for redis node = " + i);
            if ( e instanceof Error ) {
                console.log(e.message);
                console.log(e.stack);
            }
            throw e;
        });
    }
    return Promise
            .all(listPromises) //return the Promise that will be resolve after all scripts from the list will be loaded
            .then(function(){ //return true if there is no errors
                return true;    
            })
            .catch(function(e){ //return false if error
                return false;        
            });
}

/*
    executes the lua script by it's name on the redis node, that defined by the key
    scriptName - name of the sript, that was loaded to the redis before
    key - key to define the redis node
*/
function notBound_scriptExec(scriptName, key, args) {
    var scriptSHAForNodes = this.redisNodesScripts[scriptName]; //list with a values of the sha digests of this script for each redis node
    if ( scriptSHAForNodes == null ) { //if a script with the given name is not defined
        return this.returnFalse; //return promise that will returns the false value   
    } else {
        var nodeIndex = this.nodeByKey(key); //redis node index
        return this.commandToPipeline(nodeIndex, "evalsha", concatArrays( [scriptSHAForNodes[nodeIndex], 1, key] ,args) );  //eval the script on the right redis node by it's sha digest   
    }
}

//function for choosing the right node for a key
function notBound_nodeByKey(val, commandArguments) {    
    if ( typeof(val) === "number" ) {
        if ( commandArguments !== undefined ) {
            commandArguments[0] = val + ""; //convert the key to a string value    
        }
        return val % this.numOfNodes; //node number ind = 0...N-1, where N = number of redis nodes
    } else {        
        return (this.hashFunc(val) % this.numOfNodes); //node number ind = 0...N-1, where N = number of redis nodes
    }
}

var makeCommands = require("./loadRedisCommands.js");
/*
    makes a pipelines from a given redis commands for a redis instances
    to wich of the redis instances a command will be send is defined by the hash function applyied to the key of the command
    Use as: 
        PipeCommander.redisCommand, that returns a promise, after the redis command within a pipeline will be done, this promise will be resolved by a value, returned by redis
    settings : 
        redisNodesSettings : [ [{host1, port1}, options1],...[{hostN, portN}, optionsN] ] or [ {host1, port1},...{hostN, portN} ] - options for connections to the existing redis nodes, commands will be distributed between this nodes
        ioRedisOptions : options, that are applyied to an each of the redis nodes, if options for the node are not defined by the redisNodesSettings
        options : {
            timeInterval - interval in milliseconds, defines an interval within of which commands will be pipelined. Each time when this interval fires, the formed pipelines will be sent to corresponding redis nodes. 
            maxQueueLength - the maximum number of the of a pipelined commands for a one node. When the queue of a pipelined commands is reach this limit the pipeline queue will be sent to the node
        }
*/
function PipeCommander(settings) {
    
    //instances of ioredis
    this.redisNodes = [];
    
    //settings for this instance
    this.settings = settings;
    
    //scripts store = { ScriptName : ([redisNodeIndex] = shaDigest) }
    this.redisNodesScripts = {};
    
    //globals
    this.queuedCommandsForNodes = []; //[nodeInd] = [[commandName1, commandArguments1, pendingPromise1],...[commandNameN, commandArgumentsN, pendingPromiseN]]
    this.executingCommandsForNodes = []; //commands, that executed for now on the redis nodes
    this.timestampsLastExecutionForNodes = [];
    this.hashFunc = hashFunction; //hash function to define the redis node corresponding to a key to which a command is reffered
    
    //initialize the object
    this.start = this._init();
    
    this.returnFalse = Promise.resolve(false);
}

//start to execute pipelines one time per the given interval
PipeCommander.prototype._init = function() {

    var settings = this.settings;
    var redisNodesSettings = settings.redisNodesSettings; //settings, defines host and port of a redis instances to which connections shall be established
    var ioRedisOptions  = settings.ioRedisOptions;
    var timeInterval = settings.options.timeInterval || 300; //each this interval pipeline queue will be send for redis nodes
    
    function onsentinelreconnect(){
        console.log("retry");
    }
    
    if ( ioRedisOptions != null ) {
        ioRedisOptions.retryStrategy = onsentinelreconnect;
        ioRedisOptions.sentinelRetryStrategy = onsentinelreconnect;
        ioRedisOptions.reconnectOnError = onsentinelreconnect;
    }
    
    //connect to each of the redis nodes
    var waitingForConnection = []; //Promises, that will be retuned by Redis.connect for an each of the redis nodes
    for ( var nodeInd = 0, len = redisNodesSettings.length; nodeInd < len; nodeInd++ ) {
        var redisNode;
        var options = redisNodesSettings[nodeInd][1] != null ? redisNodesSettings[nodeInd][1] : ioRedisOptions;
        
        if ( Array.isArray(redisNodesSettings[nodeInd]) === true ) { //with an options for an each of the redis connections
            options.retryStrategy = onsentinelreconnect;
            options.sentinelRetryStrategy = onsentinelreconnect;
            options.reconnectOnError = onsentinelreconnect;
            redisNode = this.redisNodes[nodeInd] = new Redis(redisNodesSettings[nodeInd][0], options);  //connect with the given settings for node
        } else {
            redisNode = this.redisNodes[nodeInd] = new Redis(redisNodesSettings[nodeInd], ioRedisOptions);  //connect with the given settings for node
        }
        
        if ( ioRedisOptions != null
            && ioRedisOptions.lazyConnect === true ) { //connecting manually
                waitingForConnection[nodeInd] = redisNode.connect();    
        }
        
        this.queuedCommandsForNodes[nodeInd] = [];
        this.executingCommandsForNodes[nodeInd] = null;
        this.timestampsLastExecutionForNodes[nodeInd] = Date.now();
    }
    
    var self = this;
    
    //create a bound functions
    this.nodeByKey = notBound_nodeByKey.bind({
        hashFunc   : self.hashFunc,
        numOfNodes : redisNodesSettings.length
    });
    this.makePipelinesFromQueuedCommandsForNode = notBound_makePipelinesFromQueuedCommandsForNode.bind({
        queuedCommandsForNodes : self.queuedCommandsForNodes,
        redisNodes : self.redisNodes,
        afterPipelineCheckIfError : afterPipelineCheckIfError,
        afterPipelineDone : afterPipelineDone
    });
    this.makePipelinesFromQueuedCommandsForNodes = notBound_makePipelinesFromQueuedCommandsForNodes.bind({
        rejectCommandsQueue : self.rejectCommandsQueue,
        makePipelinesFromQueuedCommandsForNode : self.makePipelinesFromQueuedCommandsForNode,
        executingCommandsForNodes : self.executingCommandsForNodes,
        queuedCommandsForNodes : self.queuedCommandsForNodes,
        timestampsLastExecutionForNodes : self.timestampsLastExecutionForNodes,
        numOfNodes : redisNodesSettings.length,
        timeInterval : timeInterval
    });
    this.commandToPipeline = notBound_commandToPipeline.bind({
        returnResult    : returnResult,
        defferedPromise : defferedPromise,
        queuedCommandsForNodes : self.queuedCommandsForNodes,
        makePipelinesFromQueuedCommandsForNodes : self.makePipelinesFromQueuedCommandsForNodes,
        maxQueueLength : self.settings.options.maxQueueLength 
    });
    this.execCommand = notBound_execCommand.bind({
        nodeByKey : self.nodeByKey,
        commandToPipeline : self.commandToPipeline,
        commander : self
    });
    this.exec = notBound_execCommand.bind({
        nodeByKey : self.nodeByKey,
        commandToPipeline : self.commandToPipeline,
        commander : self
    });
    this.multi = notBound_multi.bind({
        nodeByKey : self.nodeByKey,
        commandToPipeline : self.commandToPipeline,
        commander : self
    });
    this.multi = notBound_multi.bind({
        nodeByKey : self.nodeByKey,
        commandToPipeline : self.commandToPipeline,
        commander : self
    });
    this.scriptLoad = notBound_scriptLoad.bind({
        nodeByKey : self.nodeByKey,
        commandToPipeline : self.commandToPipeline,
        redisNodesScripts : self.redisNodesScripts,
        commander : self
    });
    this.scriptExec = notBound_scriptExec.bind({
        nodeByKey : self.nodeByKey,
        commandToPipeline : self.commandToPipeline,
        redisNodesScripts : self.redisNodesScripts,
        ommander : self
    });
    
    //start interval for execution of a pipelines
    this.mainInterval = setInterval(this.makePipelinesFromQueuedCommandsForNodes, timeInterval);
    this.stop = function stopPipelining() { //stop pipelining
        clearInterval(self.mainInterval); //stop the main interval
        self.makePipelinesFromQueuedCommandsForNodes(); //do an existing commands
    }; //stop pipelining
    
    //return a promise, whaiting when all commands as a methods will be loaded
    return  (new Promise(
            function(resolve, reject) {
                function onComandsMade(result){ //make redis commands as methods of this object for easy calling them by PipeCommander[redisCommand] 
                    if ( result instanceof Error ) { //if an error try once again
                        console.log("PromiseCommander. ERROR while trying to create a methods by the list of a redis commands.");
                        console.log(result);
                        makeCommands(onComandsMade, self, self); //create the redis methods and bind them to this object. use only the main arguments(keys and it's values) for a commands
                    } else {
                        resolve();
                    }  
                }
                makeCommands(onComandsMade, self, self); //create the redis methods and bind them to this object. use only the main arguments(keys and it's values) for a commands
            }
        ))
        .then(function(){
            if ( waitingForConnection.length > 0 ) { //if it is needed to connect manually with a redis nodes
                return Promise
                        .all(waitingForConnection)
                        .then(function(){
                            console.log("PipeCommander. Connections to the redis nodes were established!");
                            return self;
                        })
                        .catch(function(e){
                            console.log(e);
                            var err = new Error("The error was occurred while connecting to redis instance");
                            console.log(err);
                        });
        } else {
            console.log("PipeCommander. Connections to the redis nodes were established!");
            return self;    
        }
        });
};

/*
    commandsQueue - array with Promises that must be resulted with error(rejected)
    err - instance of Error
*/
PipeCommander.prototype.rejectCommandsQueue = rejectCommandsQueue;

if( !!module ) {
    module.exports = PipeCommander; //this.start.then is necessary to use before a commands execution;
}

export default PipeCommander; //this.start.then is necessary to use before a commands execution;