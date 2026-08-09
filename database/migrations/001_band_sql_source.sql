CREATE TABLE IF NOT EXISTS semesterBand (
    semesterBandId VARCHAR(64) NOT NULL,
    semesterId INT NOT NULL,
    band VARCHAR(2) NOT NULL,
    description TEXT NULL,
    PRIMARY KEY (semesterBandId),
    UNIQUE KEY uq_semesterBand_term (semesterId, band),
    CONSTRAINT fk_semesterBand_semester
        FOREIGN KEY (semesterId) REFERENCES semester (semesterId),
    CONSTRAINT fk_semesterBand_band
        FOREIGN KEY (band) REFERENCES band (band)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS semesterBandEducator (
    semesterBandEducatorId INT NOT NULL AUTO_INCREMENT,
    semesterBandId VARCHAR(64) NOT NULL,
    educatorName VARCHAR(100) NOT NULL,
    centre VARCHAR(100) NOT NULL,
    role ENUM('Lead Educator', 'Supporting Educator') NOT NULL,
    PRIMARY KEY (semesterBandEducatorId),
    KEY idx_semesterBandEducator_band (semesterBandId),
    CONSTRAINT fk_semesterBandEducator_band
        FOREIGN KEY (semesterBandId) REFERENCES semesterBand (semesterBandId)
        ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS semesterBandAssessmentWeight (
    semesterBandId VARCHAR(64) NOT NULL,
    assessmentId INT NOT NULL,
    weight DECIMAL(7,4) NOT NULL,
    PRIMARY KEY (semesterBandId, assessmentId),
    CONSTRAINT fk_semesterBandAssessmentWeight_band
        FOREIGN KEY (semesterBandId) REFERENCES semesterBand (semesterBandId)
        ON DELETE CASCADE,
    CONSTRAINT fk_semesterBandAssessmentWeight_assessment
        FOREIGN KEY (assessmentId) REFERENCES assessment (assessmentId)
        ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO semesterBand (semesterBandId, semesterId, band, description)
SELECT DISTINCT
    CONCAT('band-', LOWER(source.band), '-', semester.academicYear, '-s', semester.semesterNo),
    source.semesterId,
    source.band,
    NULL
FROM (
    SELECT semesterId, band FROM studentSemBand
    UNION
    SELECT currentSemester AS semesterId, currentBand AS band
    FROM student
    WHERE currentSemester IS NOT NULL AND currentBand IS NOT NULL
    UNION
    SELECT studentAssessment.semesterId, assessment.band
    FROM studentAssessment
    INNER JOIN assessment ON assessment.assessmentId = studentAssessment.assessmentId
    WHERE studentAssessment.semesterId IS NOT NULL
) AS source
INNER JOIN semester ON semester.semesterId = source.semesterId
INNER JOIN band ON band.band = source.band;
