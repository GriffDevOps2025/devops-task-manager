-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data
INSERT INTO tasks (title, description) VALUES 
('Setup CI/CD Pipeline', 'Configure GitHub Actions for automated deployment'),
('Write Documentation', 'Create comprehensive README for the project'),
('Add Monitoring', 'Implement health checks and logging');

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);