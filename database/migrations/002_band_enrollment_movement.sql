-- adds movement only if it is not there yet
SET @has_movement = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'studentSemBand'
      AND COLUMN_NAME = 'movement'
);
SET @movement_sql = IF(
    @has_movement = 0,
    "ALTER TABLE studentSemBand ADD COLUMN movement ENUM('Continue', 'Advance', 'Lower') NOT NULL DEFAULT 'Continue'",
    'SELECT 1'
);
PREPARE movement_statement FROM @movement_sql;
EXECUTE movement_statement;
DEALLOCATE PREPARE movement_statement;

-- one student can only be in one Band per semester
-- clear any old duplicates before running this migration
SET @has_unique_enrollment = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'studentSemBand'
      AND INDEX_NAME = 'uq_studentSemBand_student_semester'
);
SET @unique_enrollment_sql = IF(
    @has_unique_enrollment = 0,
    'ALTER TABLE studentSemBand ADD UNIQUE KEY uq_studentSemBand_student_semester (studentId, semesterId)',
    'SELECT 1'
);
PREPARE unique_enrollment_statement FROM @unique_enrollment_sql;
EXECUTE unique_enrollment_statement;
DEALLOCATE PREPARE unique_enrollment_statement;
