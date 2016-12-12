--
-- Copyright 2016 Waverley Labs, LLC
-- 
-- This file is part of SDPcontroller
-- 
-- SDPcontroller is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
-- 
-- SDPcontroller is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
-- GNU General Public License for more details.
-- 
-- You should have received a copy of the GNU General Public License
-- along with this program.  If not, see <http://www.gnu.org/licenses/>.
--
--


-- phpMyAdmin SQL Dump
-- version 4.0.10deb1
-- http://www.phpmyadmin.net
--
-- Host: localhost
-- Generation Time: Nov 07, 2016 at 06:34 AM
-- Server version: 5.5.52-0ubuntu0.14.04.1
-- PHP Version: 5.5.9-1ubuntu4.20

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;

--
-- Database: `sdp`
--
CREATE DATABASE IF NOT EXISTS `sdp` DEFAULT CHARACTER SET utf8 COLLATE utf8_bin;
USE `sdp`;

-- --------------------------------------------------------

--
-- Table structure for table `closed_connection`
--

DROP TABLE IF EXISTS `closed_connection`;
CREATE TABLE IF NOT EXISTS `closed_connection` (
  `gateway_sdpid` int(11) NOT NULL,
  `client_sdpid` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  `start_timestamp` bigint(20) NOT NULL,
  `end_timestamp` bigint(20) NOT NULL,
  `protocol` tinytext COLLATE utf8_bin NOT NULL,
  `source_ip` tinytext COLLATE utf8_bin NOT NULL,
  `source_port` int(11) NOT NULL,
  `destination_ip` tinytext COLLATE utf8_bin NOT NULL,
  `destination_port` int(11) NOT NULL,
  `nat_destination_ip` tinytext COLLATE utf8_bin NOT NULL,
  `nat_destination_port` int(11) NOT NULL,
  PRIMARY KEY (`gateway_sdpid`,`client_sdpid`,`start_timestamp`,`source_port`),
  KEY `gateway_sdpid` (`gateway_sdpid`),
  KEY `client_sdpid` (`client_sdpid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- RELATIONS FOR TABLE `closed_connection`:
--   `gateway_sdpid`
--       `sdpid` -> `sdpid`
--   `client_sdpid`
--       `sdpid` -> `sdpid`
--

-- --------------------------------------------------------

--
-- Table structure for table `controller`
--

DROP TABLE IF EXISTS `controller`;
CREATE TABLE IF NOT EXISTS `controller` (
  `sdpid` int(11) NOT NULL,
  `name` varchar(1024) COLLATE utf8_bin NOT NULL,
  `address` varchar(4096) COLLATE utf8_bin NOT NULL COMMENT 'ip or url',
  `port` int(11) NOT NULL,
  `gateway_sdpid` int(11) DEFAULT NULL,
  `service_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`sdpid`),
  KEY `service_id` (`service_id`),
  KEY `gateway_sdpid` (`gateway_sdpid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- RELATIONS FOR TABLE `controller`:
--   `sdpid`
--       `sdpid` -> `sdpid`
--   `service_id`
--       `service` -> `id`
--   `gateway_sdpid`
--       `sdpid` -> `sdpid`
--

-- --------------------------------------------------------

--
-- Table structure for table `environment`
--

DROP TABLE IF EXISTS `environment`;
CREATE TABLE IF NOT EXISTS `environment` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(1024) COLLATE utf8_bin NOT NULL,
  `mobile` tinyint(1) NOT NULL,
  `os_group` enum('Android','iOS','Windows','OSX','Linux') COLLATE utf8_bin NOT NULL,
  `os_version` varchar(1024) COLLATE utf8_bin NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin AUTO_INCREMENT=1 ;

-- --------------------------------------------------------

--
-- Table structure for table `gateway`
--

DROP TABLE IF EXISTS `gateway`;
CREATE TABLE IF NOT EXISTS `gateway` (
  `sdpid` int(11) NOT NULL,
  `name` varchar(1024) COLLATE utf8_bin NOT NULL,
  `address` varchar(1024) COLLATE utf8_bin NOT NULL COMMENT 'ip or url',
  `port` int(11) DEFAULT NULL,
  PRIMARY KEY (`sdpid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- RELATIONS FOR TABLE `gateway`:
--   `sdpid`
--       `sdpid` -> `sdpid`
--

-- --------------------------------------------------------

--
-- Table structure for table `gateway_controller`
--

DROP TABLE IF EXISTS `gateway_controller`;
CREATE TABLE IF NOT EXISTS `gateway_controller` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `gateway_sdpid` int(11) NOT NULL,
  `controller_sdpid` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `gateway_sdpid` (`gateway_sdpid`),
  KEY `controller_sdpid` (`controller_sdpid`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 COLLATE=utf8_bin AUTO_INCREMENT=3 ;

--
-- RELATIONS FOR TABLE `gateway_controller`:
--   `gateway_sdpid`
--       `sdpid` -> `sdpid`
--   `controller_sdpid`
--       `sdpid` -> `sdpid`
--

-- --------------------------------------------------------

--
-- Table structure for table `group`
--

DROP TABLE IF EXISTS `group`;
CREATE TABLE IF NOT EXISTS `group` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `valid` tinyint(4) NOT NULL DEFAULT '1',
  `name` varchar(1024) COLLATE utf8_bin NOT NULL,
  `Description` varchar(4096) COLLATE utf8_bin NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 COLLATE=utf8_bin AUTO_INCREMENT=2 ;

--
-- Triggers `group`
--
DROP TRIGGER IF EXISTS `group_after_delete`;
DELIMITER //
CREATE TRIGGER `group_after_delete` AFTER DELETE ON `group`
 FOR EACH ROW BEGIN
    INSERT INTO refresh_trigger
    SET table_name = 'group',
        event = 'delete';
END
//
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `group_service`
--

DROP TABLE IF EXISTS `group_service`;
CREATE TABLE IF NOT EXISTS `group_service` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `group_id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `service_id` (`service_id`),
  KEY `group_id` (`group_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 COLLATE=utf8_bin AUTO_INCREMENT=2 ;

--
-- RELATIONS FOR TABLE `group_service`:
--   `group_id`
--       `group` -> `id`
--   `service_id`
--       `service` -> `id`
--

--
-- Triggers `group_service`
--
DROP TRIGGER IF EXISTS `group_service_after_delete`;
DELIMITER //
CREATE TRIGGER `group_service_after_delete` AFTER DELETE ON `group_service`
 FOR EACH ROW BEGIN
    INSERT INTO refresh_trigger
    SET table_name = 'group_service',
        event = 'delete';
END
//
DELIMITER ;
DROP TRIGGER IF EXISTS `group_service_after_insert`;
DELIMITER //
CREATE TRIGGER `group_service_after_insert` AFTER INSERT ON `group_service`
 FOR EACH ROW BEGIN
    INSERT INTO refresh_trigger
    SET table_name = 'group_service',
        event = 'insert';
END
//
DELIMITER ;
DROP TRIGGER IF EXISTS `group_service_after_update`;
DELIMITER //
CREATE TRIGGER `group_service_after_update` AFTER UPDATE ON `group_service`
 FOR EACH ROW BEGIN
    INSERT INTO refresh_trigger
    SET table_name = 'group_service',
        event = 'update';
END
//
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `open_connection`
--

DROP TABLE IF EXISTS `open_connection`;
CREATE TABLE IF NOT EXISTS `open_connection` (
  `gateway_sdpid` int(11) NOT NULL,
  `client_sdpid` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  `start_timestamp` bigint(20) NOT NULL,
  `end_timestamp` bigint(20) NOT NULL,
  `protocol` tinytext COLLATE utf8_bin NOT NULL,
  `source_ip` tinytext COLLATE utf8_bin NOT NULL,
  `source_port` int(11) NOT NULL,
  `destination_ip` tinytext COLLATE utf8_bin NOT NULL,
  `destination_port` int(11) NOT NULL,
  `nat_destination_ip` tinytext COLLATE utf8_bin NOT NULL,
  `nat_destination_port` int(11) NOT NULL,
  `gateway_controller_connection_id` int(11) NOT NULL COMMENT 'Only used to track open conns, not an index to a table',
  PRIMARY KEY (`gateway_controller_connection_id`,`client_sdpid`,`start_timestamp`,`source_port`),
  KEY `gateway_sdpid` (`gateway_sdpid`),
  KEY `client_sdpid` (`client_sdpid`),
  KEY `service_id` (`service_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- RELATIONS FOR TABLE `open_connection`:
--   `gateway_sdpid`
--       `sdpid` -> `sdpid`
--   `client_sdpid`
--       `sdpid` -> `sdpid`
--   `service_id`
--       `service` -> `id`
--

-- --------------------------------------------------------

--
-- Table structure for table `refresh_trigger`
--

DROP TABLE IF EXISTS `refresh_trigger`;
CREATE TABLE IF NOT EXISTS `refresh_trigger` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `table_name` tinytext COLLATE utf8_bin NOT NULL,
  `event` tinytext COLLATE utf8_bin NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 COLLATE=utf8_bin AUTO_INCREMENT=43 ;

-- --------------------------------------------------------

--
-- Table structure for table `sdpid`
--

DROP TABLE IF EXISTS `sdpid`;
CREATE TABLE IF NOT EXISTS `sdpid` (
  `sdpid` int(11) NOT NULL AUTO_INCREMENT,
  `valid` tinyint(1) NOT NULL DEFAULT '1',
  `type` enum('client','gateway','controller') COLLATE utf8_bin NOT NULL DEFAULT 'client',
  `country` varchar(128) COLLATE utf8_bin NOT NULL,
  `state` varchar(128) COLLATE utf8_bin NOT NULL,
  `locality` varchar(128) COLLATE utf8_bin NOT NULL,
  `org` varchar(128) COLLATE utf8_bin NOT NULL,
  `org_unit` varchar(128) COLLATE utf8_bin DEFAULT NULL,
  `alt_name` varchar(128) COLLATE utf8_bin DEFAULT NULL,
  `email` varchar(128) COLLATE utf8_bin DEFAULT NULL,
  `encrypt_key` varchar(2048) COLLATE utf8_bin DEFAULT NULL,
  `hmac_key` varchar(2048) COLLATE utf8_bin DEFAULT NULL,
  `serial` varchar(32) COLLATE utf8_bin NOT NULL,
  `last_cred_update` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `cred_update_due` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `user_id` int(11) DEFAULT NULL,
  `environment_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`sdpid`),
  KEY `user_id` (`user_id`),
  KEY `environment_id` (`environment_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 COLLATE=utf8_bin AUTO_INCREMENT=55556 ;

--
-- RELATIONS FOR TABLE `sdpid`:
--   `user_id`
--       `user` -> `id`
--   `environment_id`
--       `environment` -> `id`
--

--
-- Triggers `sdpid`
--
DROP TRIGGER IF EXISTS `sdpid_after_delete`;
DELIMITER //
CREATE TRIGGER `sdpid_after_delete` AFTER DELETE ON `sdpid`
 FOR EACH ROW BEGIN
    INSERT INTO refresh_trigger
    SET table_name = 'sdpid',
        event = 'delete';
END
//
DELIMITER ;
DROP TRIGGER IF EXISTS `sdpid_after_update`;
DELIMITER //
CREATE TRIGGER `sdpid_after_update` AFTER UPDATE ON `sdpid`
 FOR EACH ROW BEGIN
IF OLD.user_id != NEW.user_id OR
   OLD.valid != NEW.valid THEN
    INSERT INTO refresh_trigger
    SET table_name = 'sdpid',
        event = 'update';
END IF;
END
//
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `sdpid_service`
--

DROP TABLE IF EXISTS `sdpid_service`;
CREATE TABLE IF NOT EXISTS `sdpid_service` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sdpid` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `service_id` (`service_id`),
  KEY `sdpid` (`sdpid`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 COLLATE=utf8_bin AUTO_INCREMENT=11 ;

--
-- RELATIONS FOR TABLE `sdpid_service`:
--   `sdpid`
--       `sdpid` -> `sdpid`
--   `service_id`
--       `service` -> `id`
--

--
-- Triggers `sdpid_service`
--
DROP TRIGGER IF EXISTS `sdpid_service_after_delete`;
DELIMITER //
CREATE TRIGGER `sdpid_service_after_delete` AFTER DELETE ON `sdpid_service`
 FOR EACH ROW BEGIN
    INSERT INTO refresh_trigger
    SET table_name = 'sdpid_service',
        event = 'delete';
END
//
DELIMITER ;
DROP TRIGGER IF EXISTS `sdpid_service_after_insert`;
DELIMITER //
CREATE TRIGGER `sdpid_service_after_insert` AFTER INSERT ON `sdpid_service`
 FOR EACH ROW BEGIN
    INSERT INTO refresh_trigger
    SET table_name = 'sdpid_service',
        event = 'insert';
END
//
DELIMITER ;
DROP TRIGGER IF EXISTS `sdpid_service_after_update`;
DELIMITER //
CREATE TRIGGER `sdpid_service_after_update` AFTER UPDATE ON `sdpid_service`
 FOR EACH ROW BEGIN
    INSERT INTO refresh_trigger
    SET table_name = 'sdpid_service',
        event = 'update';
END
//
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `service`
--

DROP TABLE IF EXISTS `service`;
CREATE TABLE IF NOT EXISTS `service` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(1024) COLLATE utf8_bin NOT NULL,
  `description` varchar(4096) COLLATE utf8_bin NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 COLLATE=utf8_bin AUTO_INCREMENT=6 ;

--
-- Triggers `service`
--
DROP TRIGGER IF EXISTS `service_after_delete`;
DELIMITER //
CREATE TRIGGER `service_after_delete` AFTER DELETE ON `service`
 FOR EACH ROW BEGIN
    INSERT INTO refresh_trigger
    SET table_name = 'service',
        event = 'delete';
END
//
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `service_gateway`
--

DROP TABLE IF EXISTS `service_gateway`;
CREATE TABLE IF NOT EXISTS `service_gateway` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `service_id` int(11) NOT NULL,
  `gateway_sdpid` int(11) NOT NULL,
  `protocol` tinytext COLLATE utf8_bin NOT NULL COMMENT 'TCP, UDP',
  `port` int(10) unsigned NOT NULL,
  `nat_ip` varchar(128) COLLATE utf8_bin NOT NULL DEFAULT '' COMMENT '1.1.1.1   internal IP address',
  `nat_port` int(10) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `service_id` (`service_id`),
  KEY `gateway_sdpid` (`gateway_sdpid`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 COLLATE=utf8_bin AUTO_INCREMENT=5 ;

--
-- RELATIONS FOR TABLE `service_gateway`:
--   `service_id`
--       `service` -> `id`
--   `gateway_sdpid`
--       `sdpid` -> `sdpid`
--

--
-- Triggers `service_gateway`
--
DROP TRIGGER IF EXISTS `service_gateway_after_delete`;
DELIMITER //
CREATE TRIGGER `service_gateway_after_delete` AFTER DELETE ON `service_gateway`
 FOR EACH ROW BEGIN
    INSERT INTO refresh_trigger
    SET table_name = 'service_gateway',
        event = 'delete';
END
//
DELIMITER ;
DROP TRIGGER IF EXISTS `service_gateway_after_insert`;
DELIMITER //
CREATE TRIGGER `service_gateway_after_insert` AFTER INSERT ON `service_gateway`
 FOR EACH ROW BEGIN
    INSERT INTO refresh_trigger
    SET table_name = 'service_gateway',
        event = 'insert';
END
//
DELIMITER ;
DROP TRIGGER IF EXISTS `service_gateway_after_update`;
DELIMITER //
CREATE TRIGGER `service_gateway_after_update` AFTER UPDATE ON `service_gateway`
 FOR EACH ROW BEGIN
    INSERT INTO refresh_trigger
    SET table_name = 'service_gateway',
        event = 'update';
END
//
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
CREATE TABLE IF NOT EXISTS `user` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `last_name` varchar(128) COLLATE utf8_bin NOT NULL,
  `first_name` varchar(128) COLLATE utf8_bin NOT NULL,
  `country` varchar(128) COLLATE utf8_bin DEFAULT NULL,
  `state` varchar(128) COLLATE utf8_bin DEFAULT NULL,
  `locality` varchar(128) COLLATE utf8_bin DEFAULT NULL,
  `org` varchar(128) COLLATE utf8_bin DEFAULT NULL,
  `org_unit` varchar(128) COLLATE utf8_bin DEFAULT NULL,
  `alt_name` varchar(128) COLLATE utf8_bin DEFAULT NULL,
  `email` varchar(128) COLLATE utf8_bin NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 COLLATE=utf8_bin AUTO_INCREMENT=3 ;

--
-- Triggers `user`
--
DROP TRIGGER IF EXISTS `user_after_delete`;
DELIMITER //
CREATE TRIGGER `user_after_delete` AFTER DELETE ON `user`
 FOR EACH ROW BEGIN
    INSERT INTO refresh_trigger
    SET table_name = 'user',
        event = 'delete';
END
//
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `user_group`
--

DROP TABLE IF EXISTS `user_group`;
CREATE TABLE IF NOT EXISTS `user_group` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `group_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `group_id` (`group_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 COLLATE=utf8_bin AUTO_INCREMENT=2 ;

--
-- RELATIONS FOR TABLE `user_group`:
--   `user_id`
--       `user` -> `id`
--   `group_id`
--       `group` -> `id`
--

--
-- Triggers `user_group`
--
DROP TRIGGER IF EXISTS `user_group_after_delete`;
DELIMITER //
CREATE TRIGGER `user_group_after_delete` AFTER DELETE ON `user_group`
 FOR EACH ROW BEGIN
    INSERT INTO refresh_trigger
    SET table_name = 'user_group',
        event = 'delete';
END
//
DELIMITER ;
DROP TRIGGER IF EXISTS `user_group_after_insert`;
DELIMITER //
CREATE TRIGGER `user_group_after_insert` AFTER INSERT ON `user_group`
 FOR EACH ROW BEGIN
    INSERT INTO refresh_trigger
    SET table_name = 'user_group',
        event = 'insert';
END
//
DELIMITER ;
DROP TRIGGER IF EXISTS `user_group_after_update`;
DELIMITER //
CREATE TRIGGER `user_group_after_update` AFTER UPDATE ON `user_group`
 FOR EACH ROW BEGIN
    INSERT INTO refresh_trigger
    SET table_name = 'user_group',
        event = 'update';
END
//
DELIMITER ;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `closed_connection`
--
ALTER TABLE `closed_connection`
  ADD CONSTRAINT `closed_connection_ibfk_1` FOREIGN KEY (`gateway_sdpid`) REFERENCES `sdpid` (`sdpid`) ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT `closed_connection_ibfk_2` FOREIGN KEY (`client_sdpid`) REFERENCES `sdpid` (`sdpid`) ON DELETE NO ACTION ON UPDATE CASCADE;

--
-- Constraints for table `controller`
--
ALTER TABLE `controller`
  ADD CONSTRAINT `controller_ibfk_1` FOREIGN KEY (`sdpid`) REFERENCES `sdpid` (`sdpid`) ON UPDATE CASCADE,
  ADD CONSTRAINT `controller_ibfk_2` FOREIGN KEY (`service_id`) REFERENCES `service` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `controller_ibfk_3` FOREIGN KEY (`gateway_sdpid`) REFERENCES `sdpid` (`sdpid`) ON UPDATE CASCADE;

--
-- Constraints for table `gateway`
--
ALTER TABLE `gateway`
  ADD CONSTRAINT `gateway_ibfk_1` FOREIGN KEY (`sdpid`) REFERENCES `sdpid` (`sdpid`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `gateway_controller`
--
ALTER TABLE `gateway_controller`
  ADD CONSTRAINT `gateway_controller_ibfk_1` FOREIGN KEY (`gateway_sdpid`) REFERENCES `sdpid` (`sdpid`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `gateway_controller_ibfk_2` FOREIGN KEY (`controller_sdpid`) REFERENCES `sdpid` (`sdpid`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `group_service`
--
ALTER TABLE `group_service`
  ADD CONSTRAINT `group_service_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `group` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `group_service_ibfk_2` FOREIGN KEY (`service_id`) REFERENCES `service` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `open_connection`
--
ALTER TABLE `open_connection`
  ADD CONSTRAINT `open_connection_ibfk_1` FOREIGN KEY (`gateway_sdpid`) REFERENCES `sdpid` (`sdpid`) ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT `open_connection_ibfk_2` FOREIGN KEY (`client_sdpid`) REFERENCES `sdpid` (`sdpid`) ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT `open_connection_ibfk_3` FOREIGN KEY (`service_id`) REFERENCES `service` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

--
-- Constraints for table `sdpid`
--
ALTER TABLE `sdpid`
  ADD CONSTRAINT `sdpid_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `sdpid_ibfk_2` FOREIGN KEY (`environment_id`) REFERENCES `environment` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `sdpid_service`
--
ALTER TABLE `sdpid_service`
  ADD CONSTRAINT `sdpid_service_ibfk_1` FOREIGN KEY (`sdpid`) REFERENCES `sdpid` (`sdpid`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `sdpid_service_ibfk_2` FOREIGN KEY (`service_id`) REFERENCES `service` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `service_gateway`
--
ALTER TABLE `service_gateway`
  ADD CONSTRAINT `service_gateway_ibfk_1` FOREIGN KEY (`service_id`) REFERENCES `service` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `service_gateway_ibfk_2` FOREIGN KEY (`gateway_sdpid`) REFERENCES `sdpid` (`sdpid`) ON UPDATE CASCADE;

--
-- Constraints for table `user_group`
--
ALTER TABLE `user_group`
  ADD CONSTRAINT `user_group_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `user_group_ibfk_2` FOREIGN KEY (`group_id`) REFERENCES `group` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
