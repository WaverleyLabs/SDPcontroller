# SDPcontroller
Control Module for SDP - written in node.js

This project is a basic implementation of the controller module for a 
Software Defined Perimeter (SDP). This code has been tested on *nix 
type systems only.

For more information on SDP, see the following sites:

http://www.waverleylabs.com/services/software-defined-perimeter/

https://cloudsecurityalliance.org/group/software-defined-perimeter/


To use this module:

1.  Install Node.js on your system. For details, see 
     https://nodejs.org/en/download/
 
2.  Install the node package manager (npm) if it was not automatically
    installed in step 1. Check by opening a terminal and entering: 

    npm

3.  Clone this project.

4.  Install the node packages that this project requires. Do this by
    navigating to this project folder in a terminal and entering:

    npm install

4.  Install MySQL.

5.  In MySQL, import the sample database provided with this project
    in file ./setup/sdp.sql 
    
6.  In MySQL, setup a user with write privileges for this new database.

7.  Use the shell script that comes with this project called
    ./setup/create-certs.sh to create sample keys and certs for the 
    controller as well as a client.
    
    **NOTE** When creating client certificates, the 'common name' field 
    must be set to the SDP ID of that client. The SDP ID is a 32 bit
    unsigned integer, meaning it has a range from 1 to a very large 
    number. You will be prompted for this field among many others when 
    running the shell script just mentioned.

8.  Transfer the client certificate and key files (client.crt & 
    client.key) to the client machine.
 
9.  In the SDPcontroller project, edit ./config.js based on previous 
    steps. The options are explained throughout the configuration file.

10. To start the controller, in a terminal enter: 

    node ./sdpController.js

11. See the following sites for more information about the other 
    required SDP components, namely the SDP gateway and SDP client.
    Both are provided via the github project at:

    https://github.com/WaverleyLabs/fwknop

    There is an excellent tutorial and configuration details at:

    http://www.cipherdyne.org/fwknop/docs/

