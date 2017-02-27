// Load the libraries
var tls    = require('tls');
var fs     = require('fs');
var mysql  = require("mysql");
var credentialMaker = require('./sdpCredentialMaker');
var prompt = require("prompt");


const encryptionKeyLenMin = 4;
const encryptionKeyLenMax = 32;
const hmacKeyLenMin = 4;
const hmacKeyLenMax = 128;


//If the user specified the config path, get it
if(process.argv.length > 3) {
	try {
	    var config = require(process.argv[3]);
	} catch (e) {
	    // It isn't accessible
	    console.log("Did not find specified config file. Exiting.");
	    process.exit();
	}
} else {
	var config = require('./config.js');
}


//a couple global variables
var db;
var dbPassword = config.dbPassword;
var myCredentialMaker = new credentialMaker(config);

var sdpId = 0;
var memberDetails = null;
var newKeys = null;


// If the user specified the sdp id, get it
if(process.argv.length > 2) {
	sdpId = parseInt(process.argv[2]);
	
	if (typeof sdpId != "number") {
	    console.log("SDP ID argument is not number: ", process.argv[2], ". Exiting.");
	}
	
} else {
	console.log("Must provide SDP ID as first arg. Exiting.");
	process.exit();
}


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


myCredentialMaker.init(checkDbPassword);

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
    
    findId();
}


function findId() {

    console.log("Preparing to generate credentials for SDP ID " + sdpId);
  
    // Find sdpId in the database
    db.getConnection(function(error,connection){
        if(error){
            console.error("Error connecting to database: " + error);
            return;
        }
        connection.query('SELECT * FROM `sdpid` WHERE `sdpid` = ?', [sdpId], 
        function (error, rows, fields) {
            connection.release();
            if (error) {
                console.error("Query returned error: " + error);
                console.error(error);
            } else if (rows.length < 1) {
                console.error("SDP ID not found, notifying and disconnecting");
            } else if (rows.length > 1) {
                console.error("Query returned multiple rows for SDP ID: " + sdpId);
            } else {
            
                memberDetails = rows[0];
                
                if (config.debug) {
                    console.log("Data for SDP ID is: ");
                    console.log(memberDetails);
                }
                
                startCredGenProcess();
            }  
        
        });
      
    });
}


    
function startCredGenProcess() {
    // get the credentials
    myCredentialMaker.getNewCredentials(memberDetails, function(err, data){
        if (err) {
        	console.error(err);
            console.error("Failed to make credentials for SDP ID " + memberDetails.sdpid + ". Exiting.");
            process.exit();
            
        } else {
        	if(config.debug)
        		console.log("Credential Maker returned without error.");
        	
            // got credentials, save stuff
        	fs.writeFile("./"+sdpId+".crt", data.tls_cert, function(err) {
        	    if(err) {
                	console.error(err);
                    console.error("Failed to write cert file. Exiting.");
                    process.exit();
                    
        	    }

        	    console.log("The cert file was saved!");
        	});
            
        	fs.writeFile("./"+sdpId+".key", data.tls_key, function(err) {
        	    if(err) {
                	console.error(err);
                    console.error("Failed to write key file. Exiting.");
                    process.exit();
                    
        	    }

        	    console.log("The key file was saved!");
        	});
            
        	fs.writeFile("./"+sdpId+".spa_keys", 
        					 "KEY_BASE64       " + data.spa_encryption_key_base64 + "\n" +
        					 "HMAC_KEY_BASE64  " + data.spa_hmac_key_base64 + "\n", 
        					 function(err) {
        	    if(err) {
                	console.error(err);
                    console.error("Failed to write SPA keys file. Exiting.");
                    process.exit();
                    
        	    }

        	    console.log("The SPA keys file was saved! This one is just for " +
        	    		    "copying the SPA keys into the necessary files.");
        	});
            
        	var updated = new Date();
            var expires = new Date();
            expires.setDate(expires.getDate() + config.daysToExpiration);
            expires.setHours(0);
            expires.setMinutes(0);
            expires.setSeconds(0);
            expires.setMilliseconds(0);
            
            newKeys = {
                spa_encryption_key_base64: data.spa_encryption_key_base64,
                spa_hmac_key_base64: data.spa_hmac_key_base64,
                updated,
                expires
            };
            
            storeKeysInDatabase();
        
        }
    
    });
} // END FUNCTION startCredGenProcess


function storeKeysInDatabase() {
    if (newKeys.hasOwnProperty('spa_encryption_key_base64') && 
        newKeys.hasOwnProperty('spa_hmac_key_base64')) 
    {
        if(config.debug)
            console.log("Found the new keys to store in database for SDP ID "+sdpId);
        
        db.getConnection(function(error,connection){
            if(error){
                console.error("Error connecting to database to store new keys for SDP ID "+sdpId);
                console.error(error);
                process.exit();
            }
            connection.query(
                'UPDATE `sdpid` SET ' +
                '`encrypt_key` = ?, `hmac_key` = ?, ' +
                '`last_cred_update` = ?, `cred_update_due` = ? WHERE `sdpid` = ?', 
                [newKeys.spa_encryption_key_base64,
                 newKeys.spa_hmac_key_base64,
                 newKeys.updated,
                 newKeys.expires,
                 memberDetails.sdpid],
            function (error, rows, fields){
                connection.release();
                if (error)
                {
                    console.error("Failed when writing keys to database for SDP ID "+sdpId);
                    console.error(error);
                    process.exit();
                } 
                
                console.log("Successfully stored new keys for SDP ID "+sdpId+" in the database");
                process.exit();
            });
            
            connection.on('error', function(error) {
                console.error("Error from database connection: " + error);
                process.exit();
            });
          
        });
    
    } else {
        console.error("Did not find keys to store in database for SDP ID "+sdpId);
        process.exit();
    }
}

function sdpQueryException(sdpId, entries) {
    this.name = "SdpQueryException";
    this.message = "SDP ID " + sdpId + " query returned " + entries + " entries";
}

function sdpConfigException(configName, correctiveMessage) {
    this.name = "SdpConfigException";
    this.message = "Invalid entry for " + configName + "\n" + correctiveMessage;
}


