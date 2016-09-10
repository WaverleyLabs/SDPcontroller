/* 
 *  Copyright 2016 Waverley Labs, LLC
 *  
 *  This file is part of SDPcontroller
 *  
 *  SDPcontroller is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *  
 *  SDPcontroller is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *  
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */


// Load the libraries
var tls    = require('tls');
var fs     = require('fs');
var mysql  = require("mysql");
var credentialMaker = require('./sdpCredentialMaker');
var prompt = require("prompt");

// If the user specified the config path, get it
if(process.argv.length > 2) {
	try {
	    var config = require(process.argv[2]);
	} catch (e) {
	    // It isn't accessible
	    console.log("Did not find specified config file. Exiting");
	    process.exit();
	}
} else {
	var config = require('./config.js');
}


const encryptionKeyLenMin = 4;
const encryptionKeyLenMax = 32;
const hmacKeyLenMin = 4;
const hmacKeyLenMax = 128;

// a couple global variables
var db;
var dbPassword = config.dbPassword;
var serverKeyPassword = config.serverKeyPassword;
var myCredentialMaker = new credentialMaker(config);
var connectedGateways = [];
var connectedClients  = [];


// check a couple config settings
if(config.encryptionKeyLen < encryptionKeyLenMin
   || config.encryptionKeyLen > encryptionKeyLenMax)
{
  var explanation = "Range is " + encryptionKeyLenMin + " to " + encryptionKeyLenMax;
  throw new sdpConfigException("encryptionKeyLen", explanation);
}

if(config.hmacKeyLen < hmacKeyLenMin
   || config.hmacKeyLen > hmacKeyLenMax)
{
  var explanation = "Range is " + hmacKeyLenMin + " to " + hmacKeyLenMax
  throw new sdpConfigException("hmacKeyLen", explanation);
}


myCredentialMaker.init(startController);

function startController() {
  if(serverKeyPassword || !config.serverKeyPasswordRequired)
    checkDbPassword();
  else
  {
    var schema = {
        properties: {
          password: {
            description: 'Enter server key password',
            hidden: true,
            replace: '*',
            required: true
          }
        }
    };

    prompt.start();

    prompt.get(schema, function(err,result) {
        if(err)
        {
            throw err;
        }
        else
        {
            serverKeyPassword = result.password;
            checkDbPassword();
        }    
    });
  }
}

function checkDbPassword() {
  if(dbPassword || !config.dbPasswordRequired)
    startDbPool();
  else
  {
    var schema = {
        properties: {
          password: {
            description: 'Enter database password',
            hidden: true,
            replace: '*',
            required: true
          }
        }
    };

    prompt.start();

    prompt.get(schema, function(err,result) {
        if(err)
            console.log(err);
        else
        {
            dbPassword = result.password;
            startDbPool();
        }    
    });
  }
}

function startDbPool() {
  // set up database pool
  if(config.dbPasswordRequired == false) {
	  db = mysql.createPool({
	    connectionLimit: config.maxConnections,
	    host: config.dbHost,
	    user: config.dbUser,
	    database: config.dbName,
	    debug: false
      });
  } else {
	  db = mysql.createPool({
	    connectionLimit: config.maxConnections,
	    host: config.dbHost,
	    user: config.dbUser,
	    password: dbPassword, //config.dbPassword,
	    database: config.dbName,
	    debug: false
	  });
  }

  startServer();
}


function startServer() {

  // tls server options
  const options = {
    // the server's private key
    key: fs.readFileSync(config.serverKey),
    passphrase: serverKeyPassword,

    // the server's public cert
    cert: fs.readFileSync(config.serverCert),

    // require client certs
    requestCert: true,
    rejectUnauthorized: true,

    // for client certs created by us
    ca: [ fs.readFileSync(config.caCert) ]
  };


  // Start a TLS Server
  var server = tls.createServer(options, function (socket) {

    if(config.debug)
      console.log("Socket connection started");

    var action = null;
    var memberDetails = null;
    var dataTransmitTries = 0;
    var credentialMakerTries = 0;
    var badMessagesReceived = 0;
    var newKeys = null;
    var accessRefreshDue = false;
    
    // Identify the connecting client or gateway
    var sdpId = parseInt(socket.getPeerCertificate().subject.CN);

    console.log("Connection from SDP ID " + sdpId);

    // Set the socket timeout to watch for inactivity
    if(config.socketTimeout) 
      socket.setTimeout(config.socketTimeout, function() {
        console.error("Connection to SDP ID " + sdpId + " has timed out. Disconnecting.");
        socket.end();
      });

    // Handle incoming requests from members
    socket.on('data', function (data) {
      processMessage(data);
    });
  
    socket.on('end', function () {
      console.log("Connection to SDP ID " + sdpId + " closed.");
      removeFromConnectionList(memberDetails);
    });
  
    socket.on('error', function (error) {
      console.error(error);
    });
  
    // Find sdpId in the database
    db.getConnection(function(error,connection){
      if(error){
        console.error("Error connecting to database: " + error);
        socket.end(JSON.stringify({action: 'database_error'}));
        return;
      }

      var databaseErrorCallback = function(error) {
        connection.removeListener('error', databaseErrorCallback);
        connection.release();
        console.error("Error from database connection: " + error);
        return;
      };
    
      connection.on('error', databaseErrorCallback);
      
      connection.query('SELECT * FROM `sdpid` WHERE `id` = ?', [sdpId], 
      function (error, rows, fields) {
        connection.removeListener('error', databaseErrorCallback);
        connection.release();
        if (error) {
          console.error("Query returned error: " + error);
          console.error(error);
          socket.end(JSON.stringify({action: 'database_error'}));
        } else if (rows.length < 1) {
          console.error("SDP ID not found, notifying and disconnecting");
          socket.end(JSON.stringify({action: 'unknown_sdp_id'}));
        } else if (rows.length > 1) {
          console.error("Query returned multiple rows for SDP ID: " + sdpId);
          socket.end(JSON.stringify({action: 'database_error'}));
        } else {
  
          memberDetails = rows[0];
          
          
          // add the connection to the appropriate list
          var destList;
          if(memberDetails.type === 'gateway') {
              destList = connectedGateways;
          } else {
              destList = connectedClients;
          }

          // first ensure no duplicate connection entries are left around
          for(var idx = 0; idx < destList.length; idx++) {
              if(destList[idx].sdpId == memberDetails.id) {
                  destList[idx].socket.end(
                      JSON.stringify({action: 'duplicate_connection'})
                  );
                  
                  destList.splice(idx, 1);
                  idx--;
              }
          }
          
          // now add the connection to the right list
          destList.push({
              sdpId: memberDetails.id,
              connectionTime: new Date(),
              socket
          });
          
  
          if (config.debug) {
            console.log("Connected gateways: \n", connectedGateways, "\n");
            console.log("Connected clients: \n", connectedClients, "\n");
            console.log("Data for client is: ");
            console.log(memberDetails);
          }
  
          // possibly send credential update
          var now = new Date();
          if(now > memberDetails.cred_update_due) {
            handleCredentialUpdate();
          } else {
            socket.write(JSON.stringify({action: 'credentials_good'}));
          }
          
        }  
  
      });
      
    });

    
    // Parse SDP messages 
    function processMessage(data) {
      if(config.debug) {
        console.log("Message Data Received: ");
        console.log(data.toString());
      }

      // Ignore message if not yet ready
      // Clients are not supposed to send the first message
      if(!memberDetails){
        console.log("Ignoring premature message.");
        return;
      }
      
      try {
        var message = JSON.parse(data);
      }
      catch (err) {
        console.error("Error processing the following received data: \n" + data.toString());
        console.error("JSON parse failed with error: " + err);
        handleBadMessage(data.toString());
        return;
      }

      if(config.debug) {
        console.log("Message parsed");
        console.log("Message received from SDP ID " + memberDetails.id);
        console.log("JSON-Parsed Message Data Received: ");
        for(var myKey in message) {
          console.log("key: " + myKey + "   value: " + message[myKey]);
        }
      }


      action = message['action'];
      if (action === 'credential_update_request') {
        handleCredentialUpdate();
      } else if (action === 'credential_update_ack')  {
        handleCredentialUpdateAck();
      } else if (action === 'keep_alive') {
        handleKeepAlive();
      } else if (action === 'access_refresh_request') {
        handleAccessRefresh();
      } else if (action === 'access_update_request') {
        handleAccessUpdate(message);
      } else if (action === 'access_ack') {
        handleAccessAck();
      } else {
        console.error("Invalid message received, invalid or missing action");
        handleBadMessage(data.toString());
      }
    }    
    
    function handleKeepAlive() {
      if (config.debug) {
        console.log("Received keep_alive from SDP ID "+memberDetails.id+", responding now.");
      }
      
      var keepAliveMessage = {
        action: 'keep_alive'
      };
      
      // For testing only, send a bunch of copies fast
      if (config.testManyMessages > 0) {
        console.log("Sending " +config.testManyMessages+ " extra messages first for testing rather than just 1");
        var jsonMsgString = JSON.stringify(keepAliveMessage);
        for(var ii = 0; ii < config.testManyMessages; ii++) {
          socket.write(jsonMsgString);
        }
      }

      socket.write(JSON.stringify(keepAliveMessage));
      //console.log("keepAlive message written to socket");

    }


    function handleCredentialUpdate() {
      if (dataTransmitTries >= config.maxDataTransmitTries) {
        // Data transmission has failed
        console.error("Data transmission to SDP ID " + memberDetails.id + 
          " has failed after " + (dataTransmitTries+1) + " attempts");
        console.error("Closing connection");
        socket.end();
        return;
      }
  
      // get the credentials
      myCredentialMaker.getNewCredentials(memberDetails, function(err, data){
        if (err) {
          
          credentialMakerTries++;
          
          if (credentialMakerTries >= config.maxCredentialMakerTries) {
            // Credential making has failed
            console.error("Failed to make credentials for SDP ID " + memberDetails.id +
                      " " + credentialMakerTries + " times.");
            console.error("Closing connection");
            
	        var credErrMessage = {
	          action: 'credential_update_error',
	          data: 'Failed to generate credentials '+credentialMakerTries+ 
	            ' times. Disconnecting.'
	        };
  
            socket.end(JSON.stringify(credErrMessage));
            return;
          }
  
          // otherwise, just notify requestor of error
          var credErrMessage = {
            action: 'credential_update_error',
            data: 'Could not generate new credentials',
          };
  

          console.log("Sending credential_update_error message to SDP ID " + 
            memberDetails.id + ", failed attempt: " + credentialMakerTries);
          socket.write(JSON.stringify(credErrMessage));
  
        } else {
          // got credentials, send them over
          var newCredMessage = {
            action: 'credential_update',
            data
          };
          
          var updated = new Date();
          var expires = new Date();
          expires.setDate(expires.getDate() + config.daysToExpiration);
          expires.setHours(0);
          expires.setMinutes(0);
          expires.setSeconds(0);
          expires.setMilliseconds(0);
          
          newKeys = {
            encryption_key: data.encryption_key,
            hmac_key: data.hmac_key,
            updated,
            expires
          };
  
          console.log("Sending credential_update message to SDP ID " + memberDetails.id + ", attempt: " + dataTransmitTries);
          dataTransmitTries++;
          socket.write(JSON.stringify(newCredMessage));
  
        }
  
      });
    } // END FUNCTION handleCredentialUpdate
    
    
    function handleCredentialUpdateAck()  {
      console.log("Received credential update acknowledgement from SDP ID "+memberDetails.id+
        ", data successfully delivered");

      // store the necessary info in the database
      storeKeysInDatabase();

    }  // END FUNCTION handleCredentialUpdateAck


    function notifyGateways() {
        // get database connection
        db.getConnection(function(error,connection){
            if(error){
                console.error("Error connecting to database in preparation " + 
                              "to notify gateways of a client's credential update: " + error);
                
                // notify the requestor of our database troubles
                socket.write(
                    JSON.stringify({
                        action: 'notify_gateways_error',
                        data: 'Database unreachable. Gateways not notified of credential update.'
                    })
                );
                
                return;
            }
            
	        var databaseErrorCallback = function(error) {
	          connection.removeListener('error', databaseErrorCallback);
	          connection.release();
	          console.error("Error from database connection: " + error);
	          return;
	        };
    
            connection.on('error', databaseErrorCallback);
            
            // this next query requires a simple array of only
            // the sdp ids listed in connectedGateways
            var gatewaySdpIdList = [];
            for(var idx = 0; idx < connectedGateways.length; idx++) {
                gatewaySdpIdList.push(connectedGateways[idx].sdpId);
            }
            
            connection.query(
                'SELECT ' +
                '    `gateway`.`sdpid_id`,  ' +
                '    `service_gateway`.`protocol_port`, ' +
                '    `sdpid`.`encrypt_key`,  ' +
                '    `sdpid`.`hmac_key` ' +
                'FROM `gateway` ' +
                '    JOIN `service_gateway` ' +
                '        ON `service_gateway`.`gateway_id` = `gateway`.`id` ' +
                '    JOIN `sdpid_service` ' +
                '        ON `sdpid_service`.`service_id` = `service_gateway`.`service_id` ' +
                '    JOIN `sdpid` ' +
                '        ON `sdpid`.`id` = `sdpid_service`.`sdpid_id` ' +
                'WHERE `gateway`.`sdpid_id` IN (?) ' +
                'AND `sdpid`.`id` = ? ' +
                'ORDER BY `sdpid_id` ',
                [gatewaySdpIdList, memberDetails.id],
                function (error, rows, fields) {
                    connection.removeListener('error', databaseErrorCallback);
                    connection.release();
                    if(error) {
                        console.error("Access data query returned error: " + error);
                        socket.write(
                            JSON.stringify({
                                action: 'notify_gateways_error',
                                data: 'Database error. Gateways not notified of credential update.'
                            })
                        );
                        return;
                    }
                    
                    if(rows.length == 0) {
                        console.log("No relevant gateways to notify regarding credential update to SDP ID "+memberDetails.id);
                        return;
                    }
                    
                    var thisRow = rows[0];
                    var currentGatewaySdpId = thisRow.sdpid_id;
                    var openPorts = thisRow.protocol_port;
                    var encryptKey = thisRow.encrypt_key;
                    var hmacKey = thisRow.hmac_key;
                    
                    for(var rowIdx = 0; rowIdx < rows.length; rowIdx++) {
                        thisRow = rows[rowIdx];
                        
                        if(thisRow.sdpid_id != currentGatewaySdpId) {
                            currentGatewaySdpId = thisRow.sdpid_id;
                            openPorts = thisRow.protocol_port;
                            encryptKey = thisRow.encrypt_key;
                            hmacKey = thisRow.hmac_key;
                        } else if(rowIdx != 0) {
                            openPorts += ", " + thisRow.protocol_port;
                        }
                        
                        // if this is the last data row or the next is a different gateway
                        if( (rowIdx + 1) == rows.length || 
                            rows[rowIdx + 1].sdpid_id != currentGatewaySdpId ) {
                            
                            // send off this stanza data
                            notifyGateway(currentGatewaySdpId, 
                                          memberDetails.id,
                                          openPorts, 
                                          encryptKey,
                                          hmacKey);
                        }
                    }
                    
			        // only after successful notification
			        if(memberDetails.type === 'client' &&
			           !config.keepClientsConnected) 
			        {
			            socket.end();
			        }
			

                } // END QUERY CALLBACK FUNCTION

            );  // END QUERY DEFINITION
      
        });  // END DATABASE CONNECTION CALLBACK
                
    } // END FUNCTION notifyGateways
    

    function notifyGateway(gatewaySdpId, clientSdpId, openPorts, encKey, hmacKey) {

        var gatewaySocket = null;
        
        // get the right socket
        for(var idx = 0; idx < connectedGateways.length; idx++) {
            if(connectedGateways[idx].sdpId == gatewaySdpId) {
                gatewaySocket = connectedGateways[idx].socket;
                break;
            }
        }
        
        debugger;
        
        if(!gatewaySocket) {
            console.log("Attempted to notify gateway with SDP ID " +gatewaySdpId+
                        " of a client's updated credentials, but socket not found.");
            return;
        }

        var data = [{
            sdp_client_id: clientSdpId,
            source: "ANY",
            open_ports: openPorts,
            key_base64: encKey,
            hmac_key_base64: hmacKey
        }];
        
        if(config.debug) {
            console.log("Access update data to send to "+gatewaySdpId+": \n", data);
        }
        
        console.log("Sending access_update message to SDP ID " + gatewaySdpId);

        gatewaySocket.write(
            JSON.stringify({
                action: 'access_update',
                data
            })
        );
        
        
    } // END FUNCTION notifyGateway
    
    
    function removeFromConnectionList(details) {
        var theList = null;
        var found = false;
        
        if(details.type === 'client') {
            var theList = connectedClients;
            console.log("Searching connected client list for SDP ID " + details.id);
        } else {
            var theList = connectedGateways;
            console.log("Searching connected gateway list for SDP ID " + details.id);
        }
        
        for(var idx = 0; idx < theList.length; idx++) {
            if(theList[idx].sdpId == details.id) {
                theList.splice(idx, 1);
                found = true;
                break;
            }
        }
        
        if(found) {
            console.log("Found and removed SDP ID "+details.id+" from connection list");
        } else {
            console.log("Did not find SDP ID "+details.id+" in the connection list");
        }
    }
    
    
    function handleAccessRefresh() {
        if (dataTransmitTries >= config.maxDataTransmitTries) {
            // Data transmission has failed
            console.error("Data transmission to SDP ID " + memberDetails.id + 
              " has failed after " + (dataTransmitTries+1) + " attempts");
            console.error("Closing connection");
            socket.end();
            return;
        }

        db.getConnection(function(error,connection){
            if(error){
                console.error("Error connecting to database: " + error);
                
                // notify the requestor of our database troubles
                socket.write(
                    JSON.stringify({
                        action: 'access_refresh_error',
                        data: 'Database unreachable. Try again soon.'
                    })
                );
                
                return;
            }
            
	        var databaseErrorCallback = function(error) {
	          connection.removeListener('error', databaseErrorCallback);
	          connection.release();
	          console.error("Error from database connection: " + error);
	          return;
	        };
    
            connection.on('error', databaseErrorCallback);
            
            connection.query(
                'SELECT ' +
                '    `sdpid_service`.`sdpid_id`,  ' +
                '    `service_gateway`.`protocol_port`, ' +
                '    `sdpid`.`encrypt_key`,  ' +
                '    `sdpid`.`hmac_key` ' +
                'FROM `gateway` ' +
                '    JOIN `service_gateway` ' +
                '        ON `service_gateway`.`gateway_id` = `gateway`.`id` ' +
                '    JOIN `sdpid_service` ' +
                '        ON `sdpid_service`.`service_id` = `service_gateway`.`service_id` ' +
                '    JOIN `sdpid` ' +
                '        ON `sdpid`.`id` = `sdpid_service`.`sdpid_id` ' +
                'WHERE `gateway`.`sdpid_id` = ? ' +
                'ORDER BY `sdpid_id` ',
                [memberDetails.id],
                function (error, rows, fields) {
                    connection.removeListener('error', databaseErrorCallback);
                    connection.release();
                    if(error) {
                        console.error("Access data query returned error: " + error);
                        socket.write(
                            JSON.stringify({
                                action: 'access_refresh_error',
                                data: 'Database error. Try again soon.'
                            })
                        );
                        return;
                    }
                    
                    var data = [];
                    var dataIdx = 0;
                    var currentSdpId = 0;
                    for(var rowIdx = 0; rowIdx < rows.length; rowIdx++) {
                        var thisRow = rows[rowIdx];
                        dataIdx = data.length - 1;
                        if(thisRow.sdpid_id != currentSdpId) {
                            currentSdpId = thisRow.sdpid_id;
                            data.push({
                                sdp_client_id: thisRow.sdpid_id,
                                source: "ANY",
                                open_ports: thisRow.protocol_port,
                                key_base64: thisRow.encrypt_key,
                                hmac_key_base64: thisRow.hmac_key
                            });
                        } else {
                            data[dataIdx].open_ports += ", " + thisRow.protocol_port;
                        }
                    }
                    
                    if(config.debug) {
                        console.log("Access refresh data to send: \n", data, "\n");
                    }
                    
                    dataTransmitTries++;
                    console.log("Sending access_refresh message to SDP ID " + 
                        memberDetails.id + ", attempt: " + dataTransmitTries);
            
                    socket.write(
                        JSON.stringify({
                            action: 'access_refresh',
                            data
                        })
                    );
                    
                } // END QUERY CALLBACK FUNCTION

            );  // END QUERY DEFINITION
      
        });  // END DATABASE CONNECTION CALLBACK
        
    }  // END FUNCTION handleAccessRefresh
    
    
    

    function handleAccessUpdate(message) {
      //TODO
      
    }
    
    
    function handleAccessAck()  {
      console.log("Received access data acknowledgement from SDP ID "+memberDetails.id+
        ", data successfully delivered");

      clearStateVars();

    }  // END FUNCTION handleAccessAck


    // store generated keys in database
    function storeKeysInDatabase() {
      if (newKeys.hasOwnProperty('encryption_key') && 
          newKeys.hasOwnProperty('hmac_key')) 
      {
        if(config.debug)
          console.log("Found the new keys to store in database for SDP ID "+sdpId);
        
        db.getConnection(function(error,connection){
          if(error){
            console.error("Error connecting to database to store new keys for SDP ID "+sdpId);
            console.error(error);
            
            // retry soon
            setTimeout(storeKeysInDatabase, config.databaseRetryInterval);
            return;
          }
          
	      var databaseErrorCallback = function(error) {
	        connection.removeListener('error', databaseErrorCallback);
	        connection.release();
	        console.error("Error from database connection: " + error);
	        return;
	      };
    
          connection.on('error', databaseErrorCallback);
          
          connection.query(
            'UPDATE `sdpid` SET ' +
            '`encrypt_key` = ?, `hmac_key` = ?, ' +
            '`last_cred_update` = ?, `cred_update_due` = ? WHERE `id` = ?', 
            [newKeys.encryption_key,
             newKeys.hmac_key,
             newKeys.updated,
             newKeys.expires,
             memberDetails.id],
          function (error, rows, fields){
            connection.removeListener('error', databaseErrorCallback);
            connection.release();
            if (error)
            {
              console.error("Failed when writing keys to database for SDP ID "+sdpId);
              console.error(error);
              newKeys = null;
              clearStateVars();
              return;
            } 

            console.log("Successfully stored new keys for SDP ID "+sdpId+" in the database");
            newKeys = null;
            clearStateVars();
            notifyGateways();
          });
          
        });

      } else {
        console.error("Did not find keys to store in database for SDP ID "+sdpId);
        clearStateVars();
      }
    }


    // clear all state variables
    function clearStateVars() {
      action = null;
      dataTransmitTries = 0;
      credentialMakerTries = 0;
      badMessagesReceived = 0;
    }


    // deal with receipt of bad messages
    function handleBadMessage(badMessage) {
      badMessagesReceived++;

      console.error("In handleBadMessage, badMessage:\n" +badMessage);

      if (badMessagesReceived < config.maxBadMessages) {

        console.error("Preparing badMessage message...");
        var badMessageMessage = {
          action: 'bad_message',
          data: badMessage
        };

        console.error("Message to send:");
        for(var myKey in badMessageMessage) {
          console.log("key: " + myKey + "   value: " + badMessageMessage[myKey]);
        }
        socket.write(JSON.stringify(badMessageMessage));

      } else {

        console.error("Received " + badMessagesReceived + " badly formed messages from SDP ID " +
          sdpId);
        console.error("Closing connection");
        socket.end();
      }
    }

  }).listen(config.serverPort);

  if(config.maxConnections) server.maxConnections = config.maxConnections;

  // Put a friendly message on the terminal of the server.
  console.log("SDP Controller running at port " + config.serverPort);
}

function sdpQueryException(sdpId, entries) {
  this.name = "SdpQueryException";
  this.message = "SDP ID " + sdpId + " query returned " + entries + " entries";
}

function sdpConfigException(configName, correctiveMessage) {
  this.name = "SdpConfigException";
  this.message = "Invalid entry for " + configName + "\n" + correctiveMessage;
}


