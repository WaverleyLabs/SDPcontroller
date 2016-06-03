// Load the libraries
var tls    = require('tls');
var fs     = require('fs');
var mysql  = require("mysql");
var config = require('./config'); // get our config file
var credentialMaker = require('./sdpCredentialMaker');
var prompt = require("prompt");

const encryptionKeyLenMin = 4;
const encryptionKeyLenMax = 32;
const hmacKeyLenMin = 4;
const hmacKeyLenMax = 128;

// a couple global variables
var db;
var dbPassword = config.dbPassword;
var serverKeyPassword = config.serverKeyPassword;
var myCredentialMaker = new credentialMaker(config);


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
  if(dbPassword)
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
  db = mysql.createPool({
    connectionLimit: config.maxConnections,
    host: config.dbHost,
    user: config.dbUser,
    password: dbPassword, //config.dbPassword,
    database: config.dbName,
    debug: false
  });

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
    var sdpId = socket.getPeerCertificate().subject.CN;

    console.log("Connection from sdp ID " + sdpId);

    // Set the socket timeout to watch for inactivity
    if(config.socketTimeout) 
      socket.setTimeout(config.socketTimeout, function() {
        console.error("Connection to SDP ID " + sdpId + " has timed out. Disconnecting.");
        socket.end();
      });

    // Find sdpId in the database
    db.getConnection(function(error,connection){
      if(error){
        connection.release();
        console.error("Error connecting to database: " + error);
        socket.end();
        return;
      }
      connection.query('SELECT * FROM `sdp_members` WHERE `id` = ?', [sdpId], 
      function (error, rows, fields) {
        connection.release();
        if (error) {
          console.error("Query returned error: " + error);
          console.error(error);
          console.error("SDP ID unrecognized. Disconnecting.");
          socket.end();
        } else if (rows.length < 1) {
          console.error("SDP ID not found, disconnecting");
          socket.end();
        } else if (rows.length > 1) {
            // Fatal error, should not be possible to find more than
            // one instance of an ID
            throw new sdpQueryException(sdpId, rows.length);
        } else {
  
          memberDetails = rows[0];
  
          if (config.debug) {
            console.log("Data for client is: ");
            console.log(memberDetails);
          }
  
          // Send initial credential update
          handleCredentialUpdate();
          
          // Set the global var to do this after
          // the gate has acknowledged its new creds
          if(memberDetails.type === 'gate') {
            accessRefreshDue = true;
          }
          
  
          // Handle incoming requests from members
          socket.on('data', function (data) {
            processMessage(data);
          });
  
          socket.on('end', function () {
            console.log("Connection to SDP ID " + sdpId + " closed.");
          });
  
          socket.on('error', function (error) {
            console.error(error);
          });
  
        }  
  
      });
      
      connection.on('error', function(error) {
        console.error("Error from database connection: " + error);
        socket.end();
        return;
      });
      
    });

    // Parse SDP messages 
    function processMessage(data) {
      try {
        if(config.debug) {
          console.log("Message Data Received: ");
          console.log(data.toString());
        }

        var message = JSON.parse(data);

        if(config.debug) {
          console.log("Message parsed");
        }

        console.log("Message received from SDP ID " + memberDetails.id);

        if(config.debug) {
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
        } else if (action === 'access_ack') {
          handleAccessAck();
        } else {
          console.error("Invalid message received, invalid or missing action");
          handleBadMessage(data.toString());
        }
        
      }
      catch (err) {
        console.error("Error processing received data:");
        console.error(data.toString());
        handleBadMessage(data.toString());
      }
    }

    function handleKeepAlive() {
      console.log("Received keep_alive request, responding now");
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
      if ( checkAndHandleTooManyTransmitTries() )
        return;
  
      // get the credentials
      myCredentialMaker.getNewCredentials(memberDetails, function(err, data){
        if (err) {
          
          credentialMakerTries++;
          
          if ( checkAndHandleTooManyCredMakerTries() )
            return;
  
          // otherwise, just notify requestor of error
          var credErrMessage = {
            action: 'credential_update_error',
            data: 'Could not generate new credentials',
          };
  
          console.log("Sending credential_update_error message to SDP ID " + memberDetails.id + ", failed attempt: " + credentialMakerTries);
          socket.write(JSON.stringify(credErrMessage));
  
        } else {
          // got credentials, send them over
          var newCredMessage = {
            action: 'credential_update',
            data
          };
          
          newKeys = {
            encryptionKey: data.encryptionKey,
            hmacKey: data.hmacKey
          };
  
          console.log("Sending credential_update message to SDP ID " + memberDetails.id + ", attempt: " + dataTransmitTries);
          dataTransmitTries++;
          socket.write(JSON.stringify(newCredMessage));
  
        }
  
      });
    } // END FUNCTION handleCredentialUpdate
    
    
    function handleCredentialUpdateAck()  {
      console.log("Received acknowledgement from requestor, data successfully delivered");

      // store the necessary info in the database
      storeKeysInDatabase();

    }  // END FUNCTION handleCredentialUpdateAck


    function PostStoreKeysCallback(error) {
      if(memberDetails.type === 'client') {
        notifyGateways(error);
      } else {
        handleAccessRefresh(error);
      }
    }  // END FUNCTION PostStoreKeysCallback


    function notifyGateways(error) {
      if ( error ) {
        console.error("Not performing gateway notification for SDP ID " 
                       + memberDetails.id + " due to previous error");
        return;
      }
      
      // TODO notify gateways
      
      // only after successful notification
      if(!config.keepClientsConnected) socket.end();

    } // END FUNCTION notifyGateways
    
    
    function handleAccessRefresh(error) {
      if ( !accessRefreshDue )
        return;
        
      if ( error ) {
        console.error("Not performing access refresh for SDP ID "
                       + memberDetails.id + " due to previous error");
        return;
      }
      
      if ( checkAndHandleTooManyTransmitTries() )
        return;


      // get the access data, MAKING IT UP FOR NOW
      var data = [
        {
            sdp_client_id: 33333,
            source: "192.168.0.0/16",
            open_ports: "tcp/80, tcp/1398, tcp/443, tcp/5000",
            key_base64: "BUajKbdZ4X6ssMODIKSgCxjKoxlByPjsw+/FKpWD7Wk=",
            hmac_key_base64: "BodzNUM5tLlwTQOAopHQs3XpEKnE1sbLOfsvHNycNMbJEtYvh7AXV8bNtbdpvDfhV3aAGurP8Er0epPVMw6IHQ=="
        },
        {
            sdp_client_id: 44444,
            source: "192.168.0.0/16",
            open_ports: "tcp/81",
            key_base64: "aldskfjasldfjaddslfjalsdfjalddsfjasdlfjasdld",
            hmac_key_base64: "aldskfjasldfjaddslfjalsdfjalddsfjasdlfjasdldEtYvh7AXV8bNtbdpvDfhV3aAGurP8Er0epPVMw6IHQ=="
        }
      ];

      // got credentials, send them over
      var accessMessage = {
        action: 'access_refresh',
        data
      };
      
      console.log("Sending access_refresh message to SDP ID " + memberDetails.id + ", attempt: " + dataTransmitTries);
      dataTransmitTries++;
      accessRefreshDue = false;
      socket.write(JSON.stringify(accessMessage));

    }  // END FUNCTION handleAccessRefresh


    function handleAccessAck()  {
      console.log("Received access data acknowledgement from requestor, data successfully delivered");

      clearStateVars();

    }  // END FUNCTION handleAccessAck


    // store generated keys in database
    function storeKeysInDatabase() {
      if (newKeys.hasOwnProperty('encryptionKey') && 
          newKeys.hasOwnProperty('hmacKey')) 
      {
        if(config.debug)
          console.log("Found the new keys to store in database for SDP ID "+sdpId);
        
        db.getConnection(function(error,connection){
          if(error){
            connection.release();
            console.error("Error connecting to database: " + error);
            PostStoreKeysCallback(error);
            return;
          }
          connection.query('UPDATE `sdp_members` SET `encrypt_key` = ?, `hmac_key` = ? WHERE `id` = ?', 
            [newKeys.encryptionKey,
             newKeys.hmacKey,
             memberDetails.id],
          function (error, rows, fields){
            connection.release();
            if (error)
            {
              console.error("Failed when writing keys to database for SDP ID "+sdpId);
              console.error(error);
            } else {
              console.log("Successfully stored new keys for SDP ID "+sdpId+" in the database");
            }

            newKeys = null;
            clearStateVars();
            PostStoreKeysCallback(error);
          });
          
          connection.on('error', function(error) {
            console.error("Error from database connection: " + error);
            socket.end();
            return;
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


    // Watch count of transmission attempts
    function checkAndHandleTooManyTransmitTries() {
      if (dataTransmitTries+1 < config.maxDataTransmitTries)
        return false;

      // Data transmission has failed
      console.error("Data transmission to SDP ID " + memberDetails.id + 
        " has failed after " + (dataTransmitTries+1) + " attempts");
      console.error("Closing connection");
      clearStateVars();
      socket.end();
      return true;
    }

    // Watch count of credentialMaker attempts
    function checkAndHandleTooManyCredMakerTries() {
      if (credentialMakerTries < config.maxCredentialMakerTries)
        return false;

      // Credential making has failed
      console.error("Failed to make credentials for SDP ID " + memberDetails.id +
                " " + credentialMakerTries + " times.");
      console.error("Closing connection");
      clearStateVars();
      socket.end();
      return true;
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
        clearStateVars();
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


