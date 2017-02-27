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


var pem    = require('pem');
var fs     = require('fs');
var await  = require('await');
var prompt = require('prompt');

var config;
var caKeyPassword;

function credentialMaker(configuration) {
	config = configuration;
}

credentialMaker.prototype.init = function(callback) {
  caKeyPassword = config.caKeyPassword;

  if(caKeyPassword || !config.caKeyPasswordRequired)
    callback();
  else
  {
    var schema = {
      properties: {
        password: {
          description: 'Enter certificate authority key password',
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
        console.log("prompt.get failed for cert authority key password");
        throw err;
      }
      else
      {
          caKeyPassword = result.password;
          callback();
      }    
    });
  }
};


// Get new credentials for member
credentialMaker.prototype.getNewCredentials =	function(memberDetails, callback) {
  var promiseNewCreds = await('encryptionKey', 'hmacKey', 'cert'); 
  var newCreds;

  getNewKey(config.encryptionKeyLen, function(err, key) {
    if (err) promiseNewCreds.fail(err);
    else promiseNewCreds.keep('encryptionKey', key);
  });

  getNewKey(config.hmacKeyLen, function(err, key) {
    if (err) promiseNewCreds.fail(err);
    else promiseNewCreds.keep('hmacKey', key);
  });

  getNewCert(memberDetails, function(err, cert) {
    if (err) promiseNewCreds.fail(err);
    else promiseNewCreds.keep('cert', cert);
  });

  promiseNewCreds.then( function(creds) {
    console.log("New credentials successfully created for sdp member " + memberDetails.sdpid);
    
    var credentials = {
      spa_encryption_key_base64: creds.encryptionKey,
      spa_hmac_key_base64: creds.hmacKey,
      tls_key: creds.cert.clientKey,
      tls_cert: creds.cert.certificate
    };

    callback(null, credentials);
  },function(err){
    // oops, there was an error 
    console.log(err);
    callback(err, null);
  });
};


// Generate a new key for hmac or encryption
function getNewKey(keyLen, callback) {
  // this function wants key len in bits, our config 
  // specified it in bytes, so multiply by 8
  pem.createPrivateKey(keyLen*8, function(err, key) {
    if (err) {
        console.log("key callback got an error");
        callback(err, null);
    } else {
        var tempKeyStr = "";
        var finalKey = "";
        
        // get rid of wrapping text and new lines
        var result = key.key.split("\n");
        for (var i = 1; i < (result.length-1); i++) {
            tempKeyStr += result[i];
        }

        //console.log("tempKeyStr len: %d\ntempKeyStr: %s\n", tempKeyStr.length, tempKeyStr);

        // decode the string
        var tempKeyBuf = new Buffer(tempKeyStr, 'base64');

        //console.log("tempKeyBuf len: %d", tempKeyBuf.length);

        // if the result is shorter than keyLen
        if(tempKeyBuf.length < keyLen)
        {
          var error = "pem.createPrivateKey() returned key of decoded length " +
                       tempKeyBuf.length + ", shorter than required length " + keyLen;
          callback(error, null);
        }
        else
        {
          //take from end of buffer because beginning is always rather similar
          finalKey = tempKeyBuf.toString('base64', tempKeyBuf.length - keyLen); 
        }

        callback(null, finalKey);
    }
  });
}

// Generate new client certificate and key
function getNewCert(memberDetails, callback) {
  var certOptions = {
    serviceKey: fs.readFileSync(config.caKey),
    serviceKeyPassword: caKeyPassword,
    serviceCertificate: fs.readFileSync(config.caCert),
    serial: memberDetails.serial,
    selfSigned: true,
    days: config.daysToExpiration,
    country: memberDetails.country,
    state: memberDetails.state,
    locality: memberDetails.locality,
    organization: memberDetails.org,
    organizationUnit: memberDetails.org_unit,
    commonName: memberDetails.sdpid.toString(),
    emailAddress: memberDetails.email
  };

  pem.createCertificate(certOptions, function(err, keys){
    if (err) callback(err, null);
    callback(null, keys);
  }); 
}

module.exports = credentialMaker;
