-- Rename total_sales to total_contract_value for customers
ALTER TABLE customers 
RENAME COLUMN total_sales TO total_contract_value;

-- Update column comment to clarify purpose
COMMENT ON COLUMN customers.total_contract_value IS 'Total value of all rental contracts for this customer';