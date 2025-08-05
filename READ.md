# 🚀 DevOps Task Manager

A full-stack task management application demonstrating modern DevOps practices with containerization, CI/CD, and cloud deployment.

## 🏗️ Architecture

- **Frontend**: React.js with modern hooks and responsive design
- **Backend**: Node.js/Express REST API
- **Database**: PostgreSQL with sample data
- **Containerization**: Docker & Docker Compose
- **Web Server**: Nginx for production serving
- **CI/CD**: GitHub Actions (coming next)
- **Deployment**: AWS ECS with Load Balancer (coming next)

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Node.js 18+ (for local development)

### Run with Docker
```bash
# Clone the repository
git clone <your-repo-url>
cd devops-task-manager

# Start all services
docker-compose up --build

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000
# Database: localhost:5432
🧪 API Endpoints

GET /health - Health check
GET /api/tasks - Get all tasks
POST /api/tasks - Create new task

🛠️ Development
Backend Development
bashcd backend
npm install
npm run dev
Frontend Development
bashcd frontend
npm install
npm start
📁 Project Structure
devops-task-manager/
├── backend/                 # Node.js API server
│   ├── package.json
│   ├── server.js
│   └── Dockerfile
├── frontend/                # React application
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   └── index.js
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
├── database/                # Database setup
│   └── init.sql
├── docker-compose.yml       # Multi-container setup
└── README.md               # Project documentation
🔧 Technologies Used

Frontend: React 18, Axios, CSS3
Backend: Node.js, Express, PostgreSQL driver
Database: PostgreSQL 13
DevOps: Docker, Docker Compose, Nginx
Coming Soon: GitHub Actions, AWS ECS, CloudWatch

🎯 DevOps Features Demonstrated
✅ Containerization - All services dockerized
✅ Multi-stage builds - Optimized production images
✅ Service orchestration - Docker Compose setup
✅ Database initialization - Automated schema setup
✅ Reverse proxy - Nginx configuration
🔄 CI/CD Pipeline - GitHub Actions (next step)
🔄 Cloud Deployment - AWS ECS (next step)
🔄 Monitoring - CloudWatch integration (next step)
👨‍💻 Author
Built as a DevOps learning project demonstrating full-stack development with modern deployment practices.
