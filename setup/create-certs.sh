#! /usr/bin/env bash

# Create the CA Key and Certificate for signing Client Certs
openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:4096 -keyout ca.key -out ca.crt

# Create the Server Key, CSR, and Certificate
openssl genrsa -out server.key 1024
openssl req -new -key server.key -out server.csr

# We're self signing our own server cert here.  This is a no-no in production.
openssl x509 -req -days 365 -in server.csr -CA ca.crt -CAkey ca.key -out server.crt

# Create the Client Key and CSR
openssl genrsa -out client.key 1024
openssl req -new -key client.key -out client.csr

# Sign the client certificate with our CA cert.  Unlike signing our own server cert, this is what we want to do.
# Serial should be different from the server one, otherwise curl will return NSS error -8054
openssl x509 -req -days 31 -in client.csr -CA ca.crt -CAkey ca.key -out client.crt

# Verify Server Certificate
openssl verify -purpose sslserver -CAfile ca.crt server.crt

# Verify Client Certificate
openssl verify -purpose sslclient -CAfile ca.crt client.crt

# Convert Client Certificate to PEM encoding
# not needed for SDP, clients use the key and crt files individually
#openssl pkcs12 -export -inkey client.key -in client.crt -out client.p12

