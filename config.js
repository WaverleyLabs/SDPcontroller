module.exports = {
    // print debug statements
    'debug': false,

	'serverPort': 5000,
	'maxConnections': 100,

	// 0 indicates no timeout
	'socketTimeout': 0,

	// false indicates the server should disconnect
	// after a successful credential update
	'keepClientsConnected': true,

	// can create these using ./setup/create-certs.sh
	'serverCert': './path/server.crt',
	'serverKey':  './path/server.key',

	// to be prompted for a password, set this field
	// to a null string using '' (that's 2 single quotes
	// with no spaces between)
	'serverKeyPassword': 'password',
	'serverKeyPasswordRequired': true,

	// can create these using ./setup/create-certs.sh
	'caCert': './path/ca.crt',
	'caKey': './path/ca.key',

	// to be prompted for a password, delete this field or
	// set it to a null string using '' (that's 2 single 
	// quotes with no spaces between)
	'caKeyPassword': 'password',
	'caKeyPasswordRequired': true,

	// how many days new certificates should be good for
	'daysToExpiration': 31,

	// SPA encryption key length in bytes, range is 4 to 32
	'encryptionKeyLen': 32,

	// SPA HMAC key length in bytes, range is 4 to 128
	'hmacKeyLen': 128,

	// database options
	'dbHost': 'localhost',
	'dbUser': 'sdp_controller',

	// to be prompted for a password, delete this field or
	// set it to a null string using '' (that's 2 single 
	// quotes with no spaces between)
    'dbPassword': 'password',
    'dbName': 'sdp',

    // if any of these are exceeded, the controller 
    // disconnects from the client
    'maxDataTransmitTries': 3,
    'maxCredentialMakerTries': 3,
    'maxBadMessages': 3
};
