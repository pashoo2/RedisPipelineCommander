'use strict';
//!!!MULTI and EXEC commands will be skipped
const fs=require("fs");
const path=require("path");

/*
#callback - call with the methodsList argument when after commands had been formed. 
#methodsList - object, where to put the formed commands.
if methodsList = undefined, then a new object will be created
bindTo - object to which each of a created founctions will be bound
flOnlyMainArguments - if true, then used only keys and values
*/
function createCommands(callback, methodsList, bindTo, flOnlyMainArguments) {

    try{
        const body = fs.readFileSync(path.resolve(__dirname,"commands.json"));
        generateCommands(JSON.parse(body));
    } catch(e) { //try to load from Redis official

        var http = require("http");
        http.get({host: "redis.io", path: "/commands.json"},
            function (res) {
                var body = "";

                res.on('data', function (chunk) {
                    body += chunk;
                });

                res.on('end', function () {
                    generateCommands(JSON.parse(body));
                });
            }
        )
            .on('error',
                function (e) {
                    console.log("Error fetching command list from redis.io: " + e.message);
                    v
                }
            );
    }
    
    function generateCommands(objRedisCommands){
        methodsList = methodsList || {}; //list with the generated functions, that executes a redis commands
        
        var commandsNames = Object.keys(objRedisCommands);
        for(var i = 0, len = commandsNames.length; i < len; i++) {
            
            var commandName = commandsNames[i];
            
            if ( commandName.indexOf(" ") !== -1 //if space characterwas found, skip this command
                || commandName === "MULTI"
                || commandName === "EXEC"
                || commandName === "multi"
                || commandName === "exec" ) {
                    continue;    
            }
            
            var commandDesc = objRedisCommands[commandName]; //description of this command
            commandName = commandName.toLowerCase(); //command name to the lower case
            var funcBody;
            if ( Array.isArray(commandDesc.arguments) === true ) { //if arguments for the command are exists
                
                //try to count the length of the properties
                var numOfArguments = 0;
                var argumentsDesc = commandDesc.arguments; //description of the command arguments
                for( var ii = 0, len2 = argumentsDesc.length; ii < len2; ii++ ) {
                    var argumentDesc = argumentsDesc[ii];
                    if ( argumentDesc.command !== undefined ) { //if it is command, then two arguments - command name and it's value
                        if ( flOnlyMainArguments !== true ) {
                            numOfArguments = numOfArguments + 2;
                        }
                    } else if ( argumentDesc.name === "condition" ) { //condition
                        if ( flOnlyMainArguments !== true ) {
                            numOfArguments++;
                        }
                    } else { //key or value
                        numOfArguments++;
                    }
                }
                
                switch ( numOfArguments ) {
                    case 1 :
                        funcBody = 'return this.execCommand("' + commandName + '", arg1 === undefined ? [] : [arg1]);';
                        methodsList[commandName] = new Function("arg1", funcBody);
                        break;
                    case 2 :
                        funcBody = "var args = []; \
                            if ( arg1 !== undefined ) { \
                                args[0] = arg1; \
                                if ( arg2 !== undefined ) { \
                                    args[1] = arg2;}}";
                        funcBody += 'return this.execCommand("' + commandName + '", args);';
                        methodsList[commandName] = new Function("arg1", "arg2", funcBody);
                        break;
                    case 3 : 
                        funcBody = "var args = []; \
                            if ( arg1 !== undefined ) { \
                                args[0] = arg1; \
                                if ( arg2 !== undefined ) { \
                                    args[1] = arg2; \
                                    if ( arg3 !== undefined ) { \
                                        args[2] = arg3;}}}";
                        funcBody += 'return this.execCommand("' + commandName + '", args);';
                        methodsList[commandName] = new Function("arg1", "arg2", "arg3", funcBody);
                        break;
                    case 4 : 
                        funcBody = "var args = []; \
                            if ( arg1 !== undefined ) { \
                                args[0] = arg1; \
                                if ( arg2 !== undefined ) { \
                                    args[1] = arg2; \
                                    if ( arg3 !== undefined ) { \
                                        args[2] = arg3; \
                                        if ( arg4 !== undefined ) { \
                                            args[3] = arg4;}}}}";
                        funcBody += 'return this.execCommand("' + commandName + '", args);';
                        methodsList[commandName] = new Function("arg1", "arg2", "arg3", "arg4", funcBody);
                        break;
                    case 5 : 
                        funcBody = "var args = []; \
                            if ( arg1 !== undefined ) { \
                                args[0] = arg1; \
                                if ( arg2 !== undefined ) { \
                                    args[1] = arg2; \
                                    if ( arg3 !== undefined ) { \
                                        args[2] = arg3; \
                                        if ( arg4 !== undefined ) { \
                                            args[3] = arg4; \
                                            if ( arg5 !== undefined ) { \
                                                args[4] = arg5;}}}}}";
                        funcBody += 'return this.execCommand("' + commandName + '", args);';
                        methodsList[commandName] = new Function("arg1", "arg2", "arg3", "arg4", "arg5", funcBody);
                        break;
                    case 6 : 
                        funcBody = "var args = []; \
                            if ( arg1 !== undefined ) { \
                                args[0] = arg1; \
                                if ( arg2 !== undefined ) { \
                                    args[1] = arg2; \
                                    if ( arg3 !== undefined ) { \
                                        args[2] = arg3; \
                                        if ( arg4 !== undefined ) { \
                                            args[3] = arg4; \
                                            if ( arg5 !== undefined ) { \
                                                args[4] = arg5; \
                                                if ( arg6 !== undefined ) { \
                                                    args[5] = arg6;}}}}}}";
                        funcBody += 'return this.execCommand("' + commandName + '", args);';
                        methodsList[commandName] = new Function("arg1", "arg2", "arg3", "arg4", "arg5", "arg6", "arg7", funcBody);
                        break;
                    case 7 : 
                        funcBody = "var args = []; \
                            if ( arg1 !== undefined ) { \
                                args[0] = arg1; \
                                if ( arg2 !== undefined ) { \
                                    args[1] = arg2; \
                                    if ( arg3 !== undefined ) { \
                                        args[2] = arg3; \
                                        if ( arg4 !== undefined ) { \
                                            args[3] = arg4; \
                                            if ( arg5 !== undefined ) { \
                                                args[4] = arg5; \
                                                if ( arg6 !== undefined ) { \
                                                    args[5] = arg6; \
                                                    if ( arg7 !== undefined ) { \
                                                        args[6] = arg7; }}}}}}}";
                        funcBody += 'return this.execCommand("' + commandName + '", args);';
                        methodsList[commandName] = new Function("arg1", "arg2", "arg3", "arg4", "arg5", "arg6", "arg7", funcBody);
                        break;
                    default:
                        funcBody = 'return this.execCommand("' + commandName + '",';
                        funcBody += "Array.prototype.slice.call(arguments) )"; //pass all arguments, that are given from caller
                        methodsList[commandName] = new Function(funcBody);
                }   
            } else { //if there is no arguments, or number of an arguments is not fixed
                funcBody = 'return this.execCommand("' + commandName + '",';
                funcBody += "Array.prototype.slice.call(arguments, 1)"; //pass an all arguments, that are given from caller
                funcBody += ");"
                methodsList[commandName] = new Function(funcBody);    
            }
            
            if ( bindTo != null ) { //bind the function to the given object
                methodsList[commandName] = methodsList[commandName].bind(bindTo);
            }
            
        }
        
        callback(methodsList); //return the formed commands to the callback function
    }
}

module.exports = createCommands;