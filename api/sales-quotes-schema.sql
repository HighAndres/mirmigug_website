-- =============================================
-- Tabla: sales_quotes
-- Propuestas guardadas del Cotizador de Ventas
-- Mirmibug IT Solutions
-- Ejecutar en: andres63_mirmibug_web
-- =============================================

CREATE TABLE IF NOT EXISTS sales_quotes (
  id               INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  token            VARCHAR(16)     NOT NULL UNIQUE COMMENT 'Token URL de 16 chars hex',
  folio            VARCHAR(20)     DEFAULT NULL UNIQUE COMMENT 'Folio: MB-V001-0001',
  cliente_empresa  VARCHAR(120),
  cliente_contacto VARCHAR(120),
  cliente_email    VARCHAR(180),
  vendedor         VARCHAR(60),
  vendedor_id      VARCHAR(10)     DEFAULT NULL COMMENT 'ID vendedor: V001, V002...',
  quote_json       TEXT            NOT NULL COMMENT 'JSON completo de la propuesta',
  total_mensual    DECIMAL(12,2)   DEFAULT 0,
  total_unico      DECIMAL(12,2)   DEFAULT NULL COMMENT 'Total cargos únicos (hora, proyecto, equipos)',
  notas            VARCHAR(500),
  created_at       DATETIME        DEFAULT CURRENT_TIMESTAMP,
  expires_at       DATETIME        COMMENT 'NULL = no expira',
  INDEX idx_token  (token),
  INDEX idx_folio  (folio),
  INDEX idx_vendedor_id (vendedor_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Migración: agregar folio y vendedor_id
-- Ejecutar si la tabla ya existe
-- =============================================
-- ALTER TABLE sales_quotes
--   ADD COLUMN folio VARCHAR(20) DEFAULT NULL UNIQUE AFTER token,
--   ADD COLUMN vendedor_id VARCHAR(10) DEFAULT NULL AFTER vendedor,
--   ADD INDEX idx_vendedor_id (vendedor_id);

-- =============================================
-- Migración: agregar total_unico
-- Ejecutar si la tabla ya existe
-- =============================================
-- ALTER TABLE sales_quotes
--   ADD COLUMN total_unico DECIMAL(12,2) DEFAULT NULL AFTER total_mensual;
