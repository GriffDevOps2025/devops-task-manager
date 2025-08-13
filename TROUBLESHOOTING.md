# Troubleshooting Guide

This guide covers common issues encountered during deployment and operation of the DevOps Task Manager, along with detailed solutions and prevention strategies.

## 🚨 Common Issues & Solutions

### **Database Connection Issues**

#### **Issue 1: SSL Certificate Errors**
```bash
Error: self-signed certificate in certificate chain
```

**Root Cause:** AWS RDS uses self-signed SSL certificates that Node.js rejects by default.

**Solutions:**

**Option A: Environment Variable (Recommended for Development)**
```bash
# Add to task definition environment variables
NODE_TLS_REJECT_UNAUTHORIZED=0
```

**Option B: SSL Configuration in Code**
```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
```

**Option C: Use AWS Certificate Authority (Production)**
```javascript
const fs = require('fs');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    ca: fs.readFileSync('path/to/rds-ca-2019-root.pem').toString()
  }
});
```

**Prevention:**
- Always test SSL connections in development environment
- Use proper certificate validation in production
- Document SSL configuration requirements

---

#### **Issue 2: Database Connection Timeout**
```bash
Error: connect ETIMEDOUT
```

**Root Cause:** Security groups not configured to allow PostgreSQL traffic.

**Diagnosis:**
```bash
# Check security group rules
aws ec2 describe-security-groups --group-ids sg-XXXXXXXX

# Test network connectivity
telnet your-rds-endpoint.amazonaws.com 5432
```

**Solution:**
```bash
# Allow PostgreSQL port within security group
aws ec2 authorize-security-group-ingress \
  --group-id sg-XXXXXXXX \
  --protocol tcp \
  --port 5432 \
  --source-group sg-XXXXXXXX
```

**Prevention:**
- Always configure security groups before testing connections
- Use security group references instead of IP ranges for internal communication
- Document required ports and protocols

---

#### **Issue 3: Authentication Failed**
```bash
Error: password authentication failed for user "dbadmin"
```

**Root Cause:** Incorrect database credentials or connection string format.

**Diagnosis:**
```bash
# Test connection string components
echo $DATABASE_URL

# Verify RDS instance details
aws rds describe-db-instances --db-instance-identifier your-db-name
```

**Solution:**
```bash
# Correct connection string format
DATABASE_URL="postgresql://username:password@endpoint:5432/database?ssl=true&sslmode=require"

# Special characters must be URL encoded
# Example: password with ! becomes %21
DATABASE_URL="postgresql://dbadmin:TempPassword123%21@endpoint:5432/taskmanager"
```

**Prevention:**
- URL encode special characters in passwords
- Test connection strings in isolation
- Use parameter store or secrets manager for sensitive data

---

### **Container Deployment Issues**

#### **Issue 4: Container Stops Immediately (Exit Code 137)**
```bash
Task stopped with exit code: 137
```

**Root Cause:** Out of Memory (OOM) error - container exceeds allocated memory.

**Diagnosis:**
```bash
# Check CloudWatch logs for memory errors
aws logs get-log-events \
  --log-group-name "/ecs/devops-task-manager" \
  --log-stream-name "backend/backend/TASK-ID"

# Check task definition memory allocation
aws ecs describe-task-definition --task-definition devops-backend-only:latest
```

**Solution:**
```json
{
  "memory": "1024",  // Increase from 512 to 1024 MB
  "cpu": "512"       // May need to increase CPU as well
}
```

**Prevention:**
- Monitor memory usage during development
- Use appropriate memory allocation for Node.js applications (minimum 512MB)
- Implement memory monitoring and alerting

---

#### **Issue 5: Container Stops with Exit Code 1**
```bash
Task stopped with exit code: 1
```

**Root Cause:** Application error during startup (usually database connection failure).

**Diagnosis:**
```bash
# Check application logs
aws logs get-log-events \
  --log-group-name "/ecs/devops-task-manager" \
  --log-stream-name "backend/backend/TASK-ID" \
  --start-time $(date -d '10 minutes ago' +%s)000
```

**Common Solutions:**

**Database Connection Error:**
```javascript
// Add connection retry logic
const connectWithRetry = async () => {
  const maxRetries = 5;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('Database connected successfully');
      return;
    } catch (err) {
      console.log(`Database connection attempt ${i + 1} failed:`, err.message);
      if (i === maxRetries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};
```

**Environment Variable Missing:**
```bash
# Verify all required environment variables are set
aws ecs describe-task-definition \
  --task-definition devops-backend-only:latest \
  --query 'taskDefinition.containerDefinitions[0].environment'
```

**Prevention:**
- Implement comprehensive error handling
- Add retry logic for external dependencies
- Validate environment variables on startup

---

### **Network Connectivity Issues**

#### **Issue 6: API Unreachable from Internet**
```bash
curl: (7) Failed to connect to IP:5000: Connection refused
```

**Root Cause:** Security group doesn't allow inbound traffic on port 5000.

**Diagnosis:**
```bash
# Check security group rules
aws ec2 describe-security-groups \
  --group-ids sg-XXXXXXXX \
  --query 'SecurityGroups[0].IpPermissions'

# Check if task has public IP
aws ecs describe-tasks \
  --cluster devops-task-manager \
  --tasks TASK-ARN \
  --query 'tasks[0].attachments[0].details'
```

**Solution:**
```bash
# Allow HTTP traffic on port 5000
aws ec2 authorize-security-group-ingress \
  --group-id sg-XXXXXXXX \
  --protocol tcp \
  --port 5000 \
  --cidr 0.0.0.0/0
```

**Prevention:**
- Always configure security groups before deploying containers
- Test connectivity immediately after deployment
- Document required ports for each service

---

#### **Issue 7: Task Has No Public IP**
```bash
Error: InvalidNetworkInterfaceID.NotFound
```

**Root Cause:** Network interface deleted before public IP assignment or task failed to start.

**Diagnosis:**
```bash
# Check task status
aws ecs describe-tasks \
  --cluster devops-task-manager \
  --tasks TASK-ARN \
  --query 'tasks[0].lastStatus'

# Check network configuration
aws ecs describe-tasks \
  --cluster devops-task-manager \
  --tasks TASK-ARN \
  --query 'tasks[0].attachments[0]'
```

**Solution:**
```bash
# Ensure assignPublicIp is enabled
aws ecs run-task \
  --cluster devops-task-manager \
  --task-definition devops-backend-only:latest \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[subnet-XXXXXXXX],
    securityGroups=[sg-XXXXXXXX],
    assignPublicIp=ENABLED
  }"
```

**Prevention:**
- Always specify `assignPublicIp=ENABLED` for public access
- Use Application Load Balancer for production deployments
- Verify subnet configuration allows public IP assignment

---

### **CI/CD Pipeline Issues**

#### **Issue 8: ECR Authentication Failed**
```bash
Error: denied: authentication required
```

**Root Cause:** Docker not authenticated with ECR or expired credentials.

**Solution:**
```bash
# Re-authenticate with ECR
aws ecr get-login-password --region us-east-1 | \
docker login --username AWS --password-stdin ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com

# Verify authentication
docker pull ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com/devops-backend:latest
```

**GitHub Actions Solution:**
```yaml
- name: Login to Amazon ECR
  id: login-ecr
  uses: aws-actions/amazon-ecr-login@v1
  with:
    registry-type: private
```

**Prevention:**
- Implement automatic ECR authentication in CI/CD pipelines
- Set up proper IAM roles for GitHub Actions
- Monitor ECR login token expiration

---

#### **Issue 9: Docker Build Fails**
```bash
ERROR: failed to solve: failed to read dockerfile
```

**Root Cause:** Docker build context incorrect or Dockerfile missing.

**Diagnosis:**
```bash
# Verify Dockerfile exists
ls -la Dockerfile

# Check current directory
pwd

# Verify build context
ls -la .
```

**Solution:**
```bash
# Navigate to correct directory
cd backend

# Verify Dockerfile exists
cat Dockerfile

# Build with correct context
docker build -t devops-backend .
```

**Prevention:**
- Always verify build context and Dockerfile location
- Use `.dockerignore` to exclude unnecessary files
- Test Docker builds locally before CI/CD deployment

---

### **Performance Issues**

#### **Issue 10: Slow API Response Times**
```bash
API response time > 5 seconds
```

**Root Cause:** Database connection pool exhaustion or inefficient queries.

**Diagnosis:**
```bash
# Check database connection metrics
aws rds describe-db-instances \
  --db-instance-identifier devops-task-manager-db \
  --query 'DBInstances[0].DBInstanceStatus'

# Monitor CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=devops-task-manager-db \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

**Solution:**
```javascript
// Optimize connection pool settings
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections
  connectionTimeoutMillis: 2000,  // Connection timeout
  ssl: { rejectUnauthorized: false }
});

// Add query logging for optimization
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});
```

**Prevention:**
- Monitor database connection metrics
- Implement connection pooling best practices
- Add database query performance monitoring
- Consider read replicas for read-heavy workloads

---

## 🔍 Diagnostic Commands

### **ECS Diagnostics**
```bash
# List all tasks in cluster
aws ecs list-tasks --cluster devops-task-manager

# Get detailed task information
aws ecs describe-tasks --cluster devops-task-manager --tasks TASK-ARN

# Check service status
aws ecs describe-services --cluster devops-task-manager --services SERVICE-NAME

# View task definition
aws ecs describe-task-definition --task-definition TASK-DEFINITION-NAME
```

### **Database Diagnostics**
```bash
# Check RDS instance status
aws rds describe-db-instances --db-instance-identifier DB-IDENTIFIER

# View database logs
aws rds describe-db-log-files --db-instance-identifier DB-IDENTIFIER

# Download specific log file
aws rds download-db-log-file-portion \
  --db-instance-identifier DB-IDENTIFIER \
  --log-file-name LOG-FILE-NAME
```

### **Network Diagnostics**
```bash
# Check security group rules
aws ec2 describe-security-groups --group-ids sg-XXXXXXXX

# Verify network interface details
aws ec2 describe-network-interfaces --network-interface-ids eni-XXXXXXXX

# Test connectivity from container
# (Run inside container)
nc -zv RDS-ENDPOINT 5432
curl -v http://localhost:5000/health
```

### **CloudWatch Logs**
```bash
# List log groups
aws logs describe-log-groups --log-group-name-prefix "/ecs"

# List log streams
aws logs describe-log-streams \
  --log-group-name "/ecs/devops-task-manager" \
  --order-by LastEventTime \
  --descending

# Get recent log events
aws logs get-log-events \
  --log-group-name "/ecs/devops-task-manager" \
  --log-stream-name "backend/backend/TASK-ID" \
  --start-time $(date -d '1 hour ago' +%s)000
```

## 🛠️ Advanced Troubleshooting

### **Container Debugging**
```bash
# Execute shell in running container
aws ecs execute-command \
  --cluster devops-task-manager \
  --task TASK-ARN \
  --container backend \
  --interactive \
  --command "/bin/sh"

# View container resource usage
aws ecs describe-tasks \
  --cluster devops-task-manager \
  --tasks TASK-ARN \
  --include TAGS \
  --query 'tasks[0].containers[0].{name:name,cpu:cpu,memory:memory,memoryReservation:memoryReservation}'
```

### **Database Connection Testing**
```javascript
// Test script for database connectivity
const { Pool } = require('pg');

const testConnection = async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Testing database connection...');
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('Database connected successfully:', result.rows[0]);
    
    // Test table existence
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Available tables:', tables.rows);
    
  } catch (err) {
    console.error('Database connection failed:', err);
  } finally {
    await pool.end();
  }
};

testConnection();
```

### **Performance Monitoring**
```javascript
// Add performance monitoring to your application
const performanceMonitor = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    
    // Alert on slow requests
    if (duration > 5000) {
      console.warn(`Slow request detected: ${req.path} took ${duration}ms`);
    }
  });
  
  next();
};

app.use(performanceMonitor);
```

## 📊 Monitoring & Alerts

### **Key Metrics to Monitor**
```yaml
Application Metrics:
  - API response time (target: < 500ms)
  - Error rate (target: < 1%)
  - Request throughput
  - Database connection count

Infrastructure Metrics:
  - Container CPU utilization (target: < 70%)
  - Container memory utilization (target: < 80%)
  - Database CPU utilization
  - Database connection count

Health Checks:
  - Container health status
  - Database availability
  - API endpoint accessibility
```

### **CloudWatch Alarms**
```bash
# Create CPU utilization alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "ECS-HighCPU" \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

# Create database connection alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "RDS-HighConnections" \
  --alarm-description "Alert when connections exceed 80% of max" \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 16 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

## 🚀 Prevention Strategies

### **Development Best Practices**
1. **Local Testing**: Always test Docker containers locally before deployment
2. **Environment Parity**: Keep development and production environments similar
3. **Health Checks**: Implement comprehensive health check endpoints
4. **Graceful Degradation**: Handle external service failures gracefully

### **Infrastructure Best Practices**
1. **Infrastructure as Code**: Use CloudFormation or Terraform for reproducible deployments
2. **Security Groups**: Follow principle of least privilege
3. **Monitoring**: Set up comprehensive monitoring and alerting
4. **Backup Strategy**: Implement automated backups and test recovery procedures

### **Deployment Best Practices**
1. **Blue-Green Deployments**: Minimize downtime with zero-downtime deployments
2. **Rollback Strategy**: Always have a rollback plan
3. **Health Checks**: Wait for health checks before declaring deployment successful
4. **Gradual Rollout**: Deploy to staging environment first

---

This troubleshooting guide should help you quickly identify and resolve common issues. Remember to always check CloudWatch logs first, as they often contain the most detailed error information.