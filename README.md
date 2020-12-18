# SDPcontroller
Control Module for SDP - written in node.js

## License
Copyright 2016 Waverley Labs, LLC

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.

## Description
This project is a basic implementation of the controller module for a 
Software Defined Perimeter (SDP). This code has been tested on *nix 
type systems only.

For more information on SDP, see the following sites:

http://www.waverleylabs.com/services/software-defined-perimeter/

https://cloudsecurityalliance.org/group/software-defined-perimeter/

## Installation
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

7.  In MySQL, populate the relevant tables with controller, gateway, 
    and client information. At a minimum, a basic setup would have at 
    least one controller, gateway, and client, requiring the following 
    tables to be populated:
    
    a.  sdpid – at least one entry for each of the three required 
        components
        
    b.  service – the controller should be included as an entry in this
        table
        
    c.  service_gateway – for each active service, there should be at 
        least one entry declaring the gateway(s) by which it is 
        protected. There can be multiple instances of a service and/or 
        multiple gateways protecting a service instance.
        
    d.  sdpid_service – which SDP IDs have access to a service. Remote 
        gateways must have an entry here, providing access to the 
        controller if the controller is behind another gateway.
        
    The controller can also use ‘groups’ to provide access to services. 
    In this scenario, rather than adding an entry for a SDP ID in the 
    sdpid_service table above, the administrator can create entries in 
    the following additional tables:
    
    a.  user
    
    b.  group
    
    c.  user_group
    
    d.  group_service

    The following tables are currently placeholders that may prove 
    important later:
    
    a.  controller
    
    b.  gateway
    
    c.  gateway_controller
    
8.  In the SDPcontroller project, edit ./config.js based on previous 
    steps. The options are explained throughout the configuration file.
    
9.  If not already installed, install openssl 

10. Create a certificate authority key and certificate using the 
    following command in the terminal:

    openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:4096 -keyout ca.key -out ca.crt

11. Generate sample keys and certs for each SDP component. This step 
    assumes that a complete set of information about each SDP ID 
    (the controller, gateway(s), and client(s)) was entered into the 
    database. In a terminal, navigate to the SDP controller source code
    directory and execute:

    node ./genCredentials.js SDPID

    where SDPID is an existing ID in the database such as 12345. This 
    command will create three new files in the current directory: 
    12345.crt, 12345.key, and 12345.spa_keys. The program will store 
    the SPA keys in the controller database automatically. The crt and
    key files must be transferred to the device in question. The 
    spa_keys file is only for added convenience in copying the SPA key 
    material to the intended device. The file itself is not used by 
    any of the components. The SPA key material must be entered into 
    the respective device’s .fwknoprc file and sdp_ctrl_client.conf 
    file.

12. To start the controller, in a terminal enter: 

    node ./sdpController.js

13. See the following sites for more information about the other 
    required SDP components, namely the SDP gateway and SDP client.
    Both are provided via the github project at:

    https://github.com/WaverleyLabs/fwknop

    There is an excellent tutorial and configuration details at:

    http://www.cipherdyne.org/fwknop/docs/

