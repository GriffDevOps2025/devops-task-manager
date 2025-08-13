# Deployment Guide

This guide walks through deploying the DevOps Task Manager to AWS using ECS Fargate, RDS PostgreSQL, and ECR.

## 📋 Prerequisites

### **AWS Requirements**
- AWS CLI installed and configured
- AWS account with appropriate permissions
- Access to the following services:
  - ECS (Elastic Container Service)
  - ECR (Elastic Container Registry)
  - RDS (Relational Database Service)
  - VPC (Virtual Private Cloud)
  - IAM (Identity and Access Management)

### **Local Development Tools**
- Docker Desktop
- Node.js 18+
- Git
- Code editor (VS Code recommended)

## 🚀 Step-by-Step Deployment

### **Phase 1: Container Registry Setup**

#### **1.1 Create ECR Repository**
```bash
# Create repository for backend
aws ecr create-repository \
  --repository-name devops-backend \
  --region us-east-1

# Create repository for frontend (optional)
aws ecr create-repository \
  --repository-name devops-frontend \
  --region us-east-1
```

#### **1.2 Authenticate Docker with ECR**
```bash
aws ecr get-login-password --region us-east-1 | \
docker login --username AWS --password-stdin [ACCOUNT-ID].dkr.ecr.us-east-1.amazonaws.com
```

### **Phase 2: Database Setup**

#### **2.1 Create RDS PostgreSQL Instance**
```bash
aws rds create-db-instance \
  --db-instance-identifier devops-task-manager-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username dbadmin \
  --master-user-password 'TempPassword123!' \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-[YOUR-SECURITY-GROUP] \
  --publicly-accessible \
  --region us-east-1
```

#### **2.2 Configure Security Groups**
```bash
# Allow PostgreSQL traffic within security group
aws ec2 authorize-security-group-ingress \
  --group-id sg-[YOUR-SECURITY-GROUP] \
  --protocol tcp \
  --port 5432 \
  --source-group sg-[YOUR-SECURITY-GROUP]

# Allow HTTP traffic for API access
aws ec2 authorize-security-group-ingress \
  --group-id sg-[YOUR-SECURITY-GROUP] \
  --protocol tcp \
  --port 5000 \
  --cidr 0.0.0.0/0
```

### **Phase 3: Container Orchestration Setup**

#### **3.1 Create ECS Cluster**
```bash
aws ecs create-cluster \
  --cluster-name devops-task-manager \
  --region us-east-1
```

#### **3.2 Create Task Execution Role**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

```bash
# Create IAM role for ECS task execution
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document file://task-execution-role.json

# Attach required policy
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

### **Phase 4: Application Containerization**

#### **4.1 Backend Dockerfile**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

#### **4.2 Build and Push Backend Image**
```bash
# Navigate to backend directory
cd backend

# Build Docker image
docker build -t devops-backend .

# Tag for ECR
docker tag devops-backend:latest \
  [ACCOUNT-ID].dkr.ecr.us-east-1.amazonaws.com/devops-backend:latest

# Push to ECR
docker push [ACCOUNT-ID].dkr.ecr.us-east-1.amazonaws.com/devops-backend:latest
```

### **Phase 5: ECS Task Definition**

#### **5.1 Create Task Definition JSON**
```json
{
  "family": "devops-backend-only",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::[ACCOUNT-ID]:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "[ACCOUNT-ID].dkr.ecr.us-east-1.amazonaws.com/devops-backend:latest",
      "portMappings": [
        {
          "containerPort": 5000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DATABASE_URL",
          "value": "postgresql://dbadmin:TempPassword123!@[RDS-ENDPOINT]:5432/taskmanager?ssl=true&sslmode=require"
        },
        {
          "name": "NODE_TLS_REJECT_UNAUTHORIZED",
          "value": "0"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/devops-task-manager",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "backend"
        }
      }
    }
  ]
}
```

#### **5.2 Register Task Definition**
```bash
aws ecs register-task-definition \
  --cli-input-json file://backend-task-definition.json \
  --region us-east-1
```

### **Phase 6: Service Deployment**

#### **6.1 Run Backend Task**
```bash
aws ecs run-task \
  --cluster devops-task-manager \
  --task-definition devops-backend-only:1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[subnet-XXXXXXXX],
    securityGroups=[sg-XXXXXXXX],
    assignPublicIp=ENABLED
  }" \
  --region us-east-1
```

#### **6.2 Get Task Public IP**
```bash
# Get running tasks
aws ecs list-tasks \
  --cluster devops-task-manager \
  --desired-status RUNNING

# Get network interface
aws ecs describe-tasks \
  --cluster devops-task-manager \
  --tasks [TASK-ARN] \
  --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' \
  --output text

# Get public IP
aws ec2 describe-network-interfaces \
  --network-interface-ids [ENI-ID] \
  --query 'NetworkInterfaces[0].Association.PublicIp' \
  --output text
```

### **Phase 7: CI/CD Pipeline Setup**

#### **7.1 GitHub Actions Workflow**
Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS ECS

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: devops-backend
  ECS_SERVICE: devops-backend-service
  ECS_CLUSTER: devops-task-manager

jobs:
  deploy:
    name: Deploy
    runs-on: ubuntu-latest

    steps:
    - name: Checkout
      uses: actions/checkout@v3

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ env.AWS_REGION }}

    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v1

    - name: Build, tag, and push image to Amazon ECR
      id: build-image
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        IMAGE_TAG: ${{ github.sha }}
      run: |
        cd backend
        docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
        echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT
```

#### **7.2 Required GitHub Secrets**
Add these secrets to your GitHub repository:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### **Phase 8: Verification and Testing**

#### **8.1 Health Check**
```bash
curl http://[PUBLIC-IP]:5000/health
```

Expected response:
```json
{"status":"Backend is running!"}
```

#### **8.2 API Testing**
```bash
# Get all tasks
curl http://[PUBLIC-IP]:5000/api/tasks

# Create a task
curl -X POST -H "Content-Type: application/json" \
  -d '{"title":"Test Task","description":"API testing"}' \
  http://[PUBLIC-IP]:5000/api/tasks
```

## 🔧 Common Issues and Solutions

### **Database Connection Issues**
- **SSL Certificate Errors**: Add `NODE_TLS_REJECT_UNAUTHORIZED=0` environment variable
- **Connection Timeout**: Verify security group allows port 5432
- **Authentication Failed**: Check RDS credentials and endpoint

### **Container Deployment Issues**
- **Task Stops Immediately**: Check CloudWatch logs for error details
- **Out of Memory**: Increase memory allocation in task definition
- **Image Pull Errors**: Verify ECR authentication and image exists

### **Network Connectivity Issues**
- **API Unreachable**: Verify security group allows port 5000
- **Database Unreachable**: Check VPC configuration and subnet routing

## 📊 Monitoring and Logs

### **CloudWatch Logs**
View container logs in CloudWatch:
```bash
aws logs describe-log-groups --log-group-name-prefix "/ecs/devops-task-manager"
```

### **ECS Service Monitoring**
Monitor service health in ECS console or via CLI:
```bash
aws ecs describe-services \
  --cluster devops-task-manager \
  --services devops-backend-service
```

## 🎯 Next Steps

1. **Create ECS Service** for automatic restarts and scaling
2. **Add Application Load Balancer** for production traffic routing
3. **Implement auto-scaling** based on CPU/memory metrics
4. **Add environment-specific configurations** (dev, staging, prod)
5. **Set up monitoring alerts** for critical metrics

## 📚 Additional Resources

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [AWS RDS Documentation](https://docs.aws.amazon.com/rds/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)