-- ESC-DAS database schema
CREATE DATABASE IF NOT EXISTS esc_das
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE esc_das;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('educator','admin') NOT NULL DEFAULT 'educator',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
