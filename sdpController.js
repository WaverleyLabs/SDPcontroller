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
            db.end();
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
    startDbConnection();
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
            startDbConnection();
        }    
    });
  }
}

function startDbConnection() {
  // connect to database
  db = mysql.createConnection({
    host: config.dbHost,
    user: config.dbUser,
    password: dbPassword, //config.dbPassword,
    database: config.dbName
  });

  db.connect(function(err) {
    if (err) throw err;
    if(config.debug)
      console.log('connected to database as id ' + db.threadId);
    startServer();
  });

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

    var subject = null;
    var memberDetails = null;
    var dataTransmitTries = 0;
    var credentialMakerTries = 0;
    var badMessagesReceived = 0;
    var newKeys = null;
    
    // Identify the connecting client or gateway
    var sdpId = socket.getPeerCertificate().subject.CN;

    console.log("\nConnection from sdp ID " + sdpId);

    // Set the socket timeout to watch for inactivity
    if(config.socketTimeout) 
      socket.setTimeout(config.socketTimeout, function() {
        console.error("\nConnection to SDP ID " + sdpId + " has timed out. Disconnecting.\n");
        socket.end();
      });

    // Find sdpId in the database
    db.query('SELECT * FROM `sdp_members` WHERE `id` = ?', [sdpId], 
    function (error, rows, fields) {
      if (error) {
        console.error("\nQuery returned error: ");
        console.error(error);
        console.error("\nSDP ID unrecognized. Disconnecting.\n");
        socket.end();
      } else if (rows.length < 1) {
        console.error("\nSDP ID not found, disconnecting");
        socket.end();
      } else if (rows.length > 1) {
          // Fatal error, should not be possible to find more than
          // one instance of an ID
          throw new sdpQueryException(sdpId, rows.length);
      } else {

        memberDetails = rows[0];

        if (config.debug) {
          console.log("\nData for client is: ");
          console.log(memberDetails);
        }

	// Send initial credential update
        handleCredentialUpdate(null);

        // Handle incoming requests from members
        socket.on('data', function (data) {
          processMessage(data);
        });

        socket.on('end', function () {
          console.log("\nConnection to SDP ID " + sdpId + " closed.\n");
        });

        socket.on('error', function (error) {
          console.error(error);
        });

      }  

    });



    // Parse SDP messages 
    function processMessage(data) {
      try {
        if(config.debug) {
          console.log("\n\nMessage Data Received: ");
          console.log(data.toString());
        }

        var message = JSON.parse(data);

        if(config.debug) {
          console.log("\n\Message parsed\n");
        }

        console.log("\n\nMessage received from SDP ID " + memberDetails.id + "\n");

        if(config.debug) {
          console.log("\n\nJSON-Parsed Message Data Received: ");
          for(var myKey in message) {
            console.log("key: " + myKey + "\nvalue: " + message[myKey] + "\n\n");
          }
        }
        
        subject = message['sdpSubject'];
        if (subject === 'memberCredentialUpdate') {
          handleCredentialUpdate(message);
        } else if (subject === 'keepAlive') {
          handleKeepAlive();
        } else {
          console.error("\nInvalid message received, invalid or missing sdpSubject\n");
          handleBadMessage(data.toString());
        }
        
      }
      catch (err) {
        console.error("\nError processing received data:");
        console.error(data.toString());
        handleBadMessage(data.toString());
      }
    }

    function handleKeepAlive() {
      console.log("\nReceived keepAlive request, responding now\n");
      var keepAliveMessage = {
        sdpSubject: 'keepAlive'
      };
      // For testing only, send a bunch of copies fast
      if (config.testManyMessages > 0) {
        console.log("\nSending " +config.testManyMessages+ " extra messages first for testing rather than just 1\n");
        var jsonMsgString = JSON.stringify(keepAliveMessage);
        for(var ii = 0; ii < config.testManyMessages; ii++) {
          socket.write(jsonMsgString);
        }
      }

      socket.write(JSON.stringify(keepAliveMessage));
      //console.log("\nkeepAlive message written to socket\n");


    }

    function handleCredentialUpdate(message) {
      if (!message ||
           message['stage'] === 'requesting' ||
           message['stage'] === 'unfulfilled')  {

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
              sdpSubject: 'memberCredentialUpdate',
              stage: 'error',
              data: 'Failed to generate new credentials'
            };

            console.log("\nSending " + subject + " error message to SDP ID " + memberDetails.id + ", failed attempt: " + credentialMakerTries);
            socket.write(JSON.stringify(credErrMessage));

          } else {
            // got credentials, send them over
            var newCredMessage = {
              sdpSubject: 'memberCredentialUpdate',
              stage: 'fulfilling',
              data
            };
            
            newKeys = {
              encryptionKey: data.encryptionKey,
              hmacKey: data.hmacKey
            };

            console.log("\nSending " + subject + " fulfilling message to SDP ID " + memberDetails.id + ", attempt: " + dataTransmitTries);
            dataTransmitTries++;
            socket.write(JSON.stringify(newCredMessage));

          }

        });
       
      } else if (message['stage'] === 'fulfilled')  {
        console.log("\nReceived acknowledgement from requestor, data successfully delivered\n");

        // store the necessary info in the database
        storeKeysInDatabase();

      } else {
        // unrecognized message
        handleBadMessage(JSON.stringify(message));
      }
          
    }  // END FUNCTION handleCredentialUpdate


    // store generated keys in database
    function storeKeysInDatabase() {
      if (newKeys.hasOwnProperty('encryptionKey') && 
          newKeys.hasOwnProperty('hmacKey')) 
      {
        if(config.debug)
          console.log("\nFound the new keys to store in database for SDP ID "+sdpId+"\n");
        
        db.query('UPDATE `sdp_members` SET `encrypt_key` = ?, `hmac_key` = ? WHERE `id` = ?', 
          [newKeys.encryptionKey,
           newKeys.hmacKey,
           memberDetails.id],
          function (error, rows, fields) 
        {
          if (error)
          {
            console.error("\nFailed when writing keys to database for SDP ID "+sdpId+"!\n");
            console.error(error);

          } else {
            console.log("\nSuccessfully stored new keys for SDP ID "+sdpId+" in the database\n");
          }

          newKeys = null;
          clearStateVars();
          if(!config.keepClientsConnected) socket.end();

        });

      } else {
        console.error("\nDid not find keys to store in database for SDP ID "+sdpId+"!\n");
        clearStateVars();
      }
    }


    // clear all state variables
    function clearStateVars() {
      subject = null;
      dataTransmitTries = 0;
      credentialMakerTries = 0;
      badMessagesReceived = 0;
    }


    // Watch count of transmission attempts
    function checkAndHandleTooManyTransmitTries() {
      if (dataTransmitTries+1 < config.maxDataTransmitTries)
        return false;

      // Data transmission has failed
      console.error("\nData transmission to SDP ID " + memberDetails.id + 
        " has failed after " + (dataTransmitTries+1) + " attempts\n");
      console.error("Closing connection\n");
      clearStateVars();
      socket.end();
      return true;
    }

    // Watch count of credentialMaker attempts
    function checkAndHandleTooManyCredMakerTries() {
      if (credentialMakerTries < config.maxCredentialMakerTries)
        return false;

      // Credential making has failed
      console.error("\nFailed to make credentials for SDP ID " + memberDetails.id +
                " " + credentialMakerTries + " times.\n");
      console.error("Closing connection\n");
      clearStateVars();
      socket.end();
      return true;
    }

    // deal with receipt of bad messages
    function handleBadMessage(badMessage) {
      badMessagesReceived++;

      console.error("In handleBadMessage, badMessage:\n" +badMessage+ "\n");

      if (badMessagesReceived < config.maxBadMessages) {

        console.error("\nPreparing badMessage message...\n");
        var badMessageMessage = {
          sdpSubject: 'badMessage',
          stage: 'error',
          data: badMessage
        };

        console.error("\nMessage to send:\n");
        for(var myKey in badMessageMessage) {
          console.log("key: " + myKey + "\nvalue: " + badMessageMessage[myKey] + "\n\n");
        }
        socket.write(JSON.stringify(badMessageMessage));

      } else {

        console.error("Received " + badMessagesReceived + " badly formed messages from SDP ID " +
          sdpId + "\n");
        console.error("Closing connection\n");
        clearStateVars();
        socket.end();
      }
    }

  }).listen(config.serverPort);

  if(config.maxConnections) server.maxConnections = config.maxConnections;

  // Put a friendly message on the terminal of the server.
  console.log("\nSDP Controller running at port " + config.serverPort + "\n");
}

function sdpQueryException(sdpId, entries) {
  this.name = "SdpQueryException";
  this.message = "SDP ID " + sdpId + " query returned " + entries + " entries";
}

function sdpConfigException(configName, correctiveMessage) {
  this.name = "SdpConfigException";
  this.message = "Invalid entry for " + configName + "\n" + correctiveMessage;
}


