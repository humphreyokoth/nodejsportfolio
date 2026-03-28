-- Legacy: add image_url if recipes existed before that column (CREATE IF NOT EXISTS does not alter tables).
SET @db := DATABASE();
SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'recipes' AND COLUMN_NAME = 'image_url'
);
SET @q := IF(
  @exist = 0,
  'ALTER TABLE recipes ADD COLUMN image_url VARCHAR(2048) NULL AFTER notes',
  'SELECT 1'
);
PREPARE stmt FROM @q;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
