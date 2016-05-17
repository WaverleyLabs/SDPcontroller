-- phpMyAdmin SQL Dump
-- version 4.4.10
-- http://www.phpmyadmin.net
--
-- Host: localhost:3306
-- Generation Time: May 16, 2016 at 06:46 PM
-- Server version: 5.5.42
-- PHP Version: 5.6.10

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `sdp`
--
CREATE DATABASE IF NOT EXISTS `sdp` DEFAULT CHARACTER SET latin1 COLLATE latin1_swedish_ci;
USE `sdp`;

-- --------------------------------------------------------

--
-- Table structure for table `sdp_members`
--

CREATE TABLE `sdp_members` (
  `id` int(11) NOT NULL,
  `type` enum('client','gate','controller') NOT NULL DEFAULT 'client',
  `country` varchar(128) NOT NULL,
  `state` varchar(128) NOT NULL,
  `locality` varchar(128) NOT NULL,
  `org` varchar(128) NOT NULL,
  `org_unit` varchar(128) DEFAULT NULL,
  `alt_name` varchar(128) DEFAULT NULL,
  `email` varchar(128) DEFAULT NULL,
  `encrypt_key` varchar(2048) DEFAULT NULL,
  `hmac_key` varchar(2048) DEFAULT NULL,
  `serial` varchar(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Dumping data for table `sdp_members`
--

INSERT INTO `sdp_members` (`id`, `type`, `country`, `state`, `locality`, `org`, `org_unit`, `alt_name`, `email`, `encrypt_key`, `hmac_key`, `serial`) VALUES
(11111, 'gate', 'US', 'Virginia', 'Waterford', 'Waverley Labs, LLC', 'R&D', NULL, 'support@waverleylabs.com', NULL, NULL, ''),
(33333, 'client', 'US', 'Virginia', 'Leesburg', 'Client Org', 'Client Unit', NULL, 'dbailey@waverleylabs.com', 'BASE64+ENCRYPTION+KEY', 'BASE64+HMAC+KEY', '00AF8F8EAC509B9321');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `sdp_members`
--
ALTER TABLE `sdp_members`
  ADD PRIMARY KEY (`id`);

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
