-- Insert default admin user
-- Password: admin123 (hashed with bcrypt)
-- IMPORTANT: Change this password after first login!
INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES 
  ('admin@telosap4p.com', '$2a$10$rXKvHYHvJXT0nJ.yN4Br7uWvMq5d.xCFPxqJrJqLqoN8Y0K8K8K8K', 'Admin User', 'admin');

-- Insert sample member users
INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES 
  ('member@telosap4p.com', '$2a$10$rXKvHYHvJXT0nJ.yN4Br7uWvMq5d.xCFPxqJrJqLqoN8Y0K8K8K8K', 'John Doe', 'member'),
  ('analyst@telosap4p.com', '$2a$10$rXKvHYHvJXT0nJ.yN4Br7uWvMq5d.xCFPxqJrJqLqoN8Y0K8K8K8K', 'Jane Smith', 'member');
