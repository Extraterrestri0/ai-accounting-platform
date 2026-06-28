-- =====================================================================
-- 0034 DOWN — drop the SAF-T export store. The dataset is always regenerable
-- from the immutable sources, so no data is lost permanently.
-- =====================================================================
DROP TABLE IF EXISTS saft_exports;
