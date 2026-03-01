# Rss-Easy 生产环境部署指南

## 目录

- [部署前准备](#部署前准备)
- [环境变量配置](#环境变量配置)
- [安全配置检查](#安全配置检查)
- [Docker 部署](#docker-部署)
- [数据库备份](#数据库备份)
- [监控和日志](#监控和日志)
- [故障排除](#故障排除)

---

## 部署前准备

### 1. 安装必要工具

```bash
# Docker 和 Docker Compose
# Windows: 下载 Docker Desktop
# Linux:
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# OpenSSL（用于生成密钥）
# Windows: Git Bash 或 WSL
# Linux: 通常已安装
```

### 2. 生成安全密钥

```bash
# 生成随机密钥
JWT_SECRET=$(openssl rand -base64 32)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
CRON_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 16)
REDIS_PASSWORD=$(openssl rand -base64 16)

# 显示生成的密钥
echo "JWT_SECRET=$JWT_SECRET"
echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET"
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo "CRON_SECRET=$CRON_SECRET"
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
echo "REDIS_PASSWORD=$REDIS_PASSWORD"
```

### 3. 克隆项目

```bash
git clone https://github.com/your-username/rss-easy.git
cd rss-easy
```

---

## 环境变量配置

### 创建 `.env` 文件

```bash
# 复制示例文件
cp .env.example .env

# 编辑配置
nano .env  # 或使用其他编辑器
```

### 必需配置项

```env
# ==================== 应用配置 ====================
NODE_ENV=production
APP_URL=https://your-domain.com
PORT=3000

# ==================== 认证配置（必须更改！） ====================
# JWT 密钥（使用上面生成的）
JWT_SECRET=你的-JWT-密钥-至少32字符
NEXTAUTH_SECRET=你的-NEXTAUTH-密钥-至少32字符
NEXTAUTH_URL=https://your-domain.com

# 加密密钥（用于加密敏感数据）
ENCRYPTION_KEY=你的-加密密钥-32字符

# Cron 密钥（用于 API 认证）
CRON_SECRET=你的-Cron-密钥-至少32字符

# ==================== 数据库配置 ====================
# PostgreSQL 连接字符串（使用强密码）
POSTGRES_USER=rss_easy
POSTGRES_PASSWORD=你的-数据库-强密码
POSTGRES_DB=rss_easy
DATABASE_URL=postgresql://rss_easy:你的数据库密码@postgres:5432/rss_easy?connection_limit=10&pool_timeout=20

# ==================== Redis 配置 ====================
# Redis 密码（使用强密码）
REDIS_PASSWORD=你的-Redis-强密码
REDIS_URL=redis://:你的Redis密码@redis:6379
REDIS_HOST=redis
REDIS_PORT=6379

# ==================== AI 服务配置 ====================
AI_PROVIDER=openai
AI_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-your-openai-api-key
# 或使用其他 AI 服务：
# ANTHROPIC_API_KEY=sk-ant-your-key
# DEEPSEEK_API_KEY=sk-your-deepseek-key

# ==================== 邮件配置（可选） ====================
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASSWORD=your-smtp-api-key
SMTP_FROM_EMAIL=noreply@your-domain.com
SMTP_FROM_NAME=Rss-Easy

# ==================== 日志配置 ====================
LOG_LEVEL=info
```

---

## 安全配置检查

### 部署前安全检查清单

- [ ] **所有密钥已更改为强随机值**
  - [ ] JWT_SECRET (至少 32 字符)
  - [ ] NEXTAUTH_SECRET (至少 32 字符)
  - [ ] ENCRYPTION_KEY (至少 32 字符)
  - [ ] CRON_SECRET (至少 32 字符)
  - [ ] POSTGRES_PASSWORD (至少 16 字符)
  - [ ] REDIS_PASSWORD (至少 16 字符)

- [ ] **AI API 密钥已配置**
  - [ ] OPENAI_API_KEY 或其他 AI 服务密钥

- [ ] **域名配置正确**
  - [ ] APP_URL 使用正确的域名
  - [ ] NEXTAUTH_URL 使用正确的域名（包含 https://）

- [ ] **数据库连接配置**
  - [ ] 使用连接池参数（connection_limit=10）
  - [ ] 设置合理的超时（pool_timeout=20）

- [ ] **生产环境特定配置**
  - [ ] NODE_ENV=production
  - [ ] LOG_LEVEL=info（不是 debug）

### 安全功能验证

部署后验证以下安全功能：

- [ ] **速率限制**
  ```bash
  # 测试登录速率限制（10 次/10 分钟）
  for i in {1..12}; do
    curl -X POST http://localhost:8915/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email":"test@test.com","password":"wrong"}'
  done
  # 第 11 次请求应该返回 429
  ```

- [ ] **JWT 有效期**
  - 访问 Token: 1 天
  - 刷新 Token: 30 天

- [ ] **安全头部**
  ```bash
  curl -I http://localhost:8915
  # 应包含：
  # - Strict-Transport-Security
  # - X-Frame-Options
  # - X-Content-Type-Options
  # - Content-Security-Policy
  ```

- [ ] **CORS 配置**
  ```bash
  curl -H "Origin: https://evil.com" \
       -X OPTIONS http://localhost:8915/api/test
  # 应该被拒绝或返回正确的 CORS 头部
  ```

- [ ] **调度器 API 认证**
  ```bash
  # 无认证应该失败
  curl http://localhost:8915/api/scheduler/status
  # 应返回 401

  # 使用 CRON_SECRET 应该成功
  curl -H "Authorization: Bearer $CRON_SECRET" \
       http://localhost:8915/api/scheduler/status
  # 应返回 200
  ```

- [ ] **密码策略**
  - 最少 8 个字符
  - 必须包含大小写字母、数字、特殊字符

- [ ] **API Key 加密**
  - 用户 AI API Key 在数据库中已加密存储

- [ ] **XSS 防护**
  - 使用 DOMPurify 清理用户输入的 HTML

- [ ] **密码重置令牌**
  - 一次性使用
  - 使用后立即失效

---

## Docker 部署

### 开发环境部署

```bash
# 使用启动脚本（推荐）
./start.sh
# 或 Windows
start.bat
```

### 生产环境部署

#### 方式一：使用生产配置文件

```bash
# 使用生产配置启动
docker-compose -f docker-compose.prod.yml up -d

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f

# 查看服务状态
docker-compose -f docker-compose.prod.yml ps
```

#### 方式二：手动部署步骤

```bash
# 1. 构建镜像
docker build -t rss-easy:latest .

# 2. 创建网络
docker network create rss-easy-network

# 3. 启动数据库
docker run -d \
  --name rss-easy-db \
  --network rss-easy-network \
  -e POSTGRES_USER=rss_easy \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=rss_easy \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:16-alpine

# 4. 启动 Redis
docker run -d \
  --name rss-easy-redis \
  --network rss-easy-network \
  -v redis_data:/data \
  redis:7-alpine \
  redis-server --requirepass your_password --appendonly yes

# 5. 等待数据库就绪
sleep 10

# 6. 初始化数据库
docker run --rm \
  --network rss-easy-network \
  -e DATABASE_URL=postgresql://rss_easy:your_password@rss-easy-db:5432/rss_easy \
  rss-easy:latest \
  sh -c "npx prisma generate && npx prisma db push && npx tsx prisma/seed.ts"

# 7. 启动应用
docker run -d \
  --name rss-easy-app \
  --network rss-easy-network \
  -p 3000:3000 \
  --env-file .env \
  rss-easy:latest
```

### Docker 安全特性

生产环境配置已包含以下安全特性：

1. **非 root 用户运行**
   - 容器使用专用用户（UID 1001）
   - 减少容器逃逸风险

2. **资源限制**
   - CPU 限制: 2 核心
   - 内存限制: 2GB
   - 防止资源耗尽攻击

3. **健康检查**
   - 每 30 秒检查一次
   - 3 次失败后标记不健康
   - 自动重启不健康容器

4. **日志轮转**
   - 每个日志文件最大 10MB
   - 保留最近 3 个日志文件

5. **网络隔离**
   - 使用专用 Docker 网络
   - 数据库端口仅本地访问

6. **信号处理**
   - 使用 dumb-init 处理信号和僵尸进程

---

## 数据库备份

### 自动备份（Docker 环境）

生产环境配置已包含自动备份服务，每天凌晨 2 点自动运行。

### 手动备份

```bash
# 运行备份
docker exec rss-easy-backup sh /scripts/backup.sh

# 查看备份文件
ls -lh backups/

# 备份文件示例：
# backup_20240101_020000.sql.gz
```

### 恢复数据库

```bash
# 恢复备份
docker exec -it rss-easy-backup sh /scripts/backup-restore.sh /backups/backup_20240101_020000.sql.gz

# 或使用 psql 直接恢复
docker exec -i rss-easy-db psql \
  -U rss_easy \
  -d rss_easy \
  < /path/to/backup.sql
```

### 备份策略建议

- **备份频率**: 每天
- **保留时间**: 30 天
- **异地备份**: 建议定期复制到异地存储
- **恢复测试**: 每月测试一次恢复流程

---

## 监控和日志

### 健康检查端点

```bash
# 检查应用健康
curl http://localhost:8915/api/health

# 响应示例：
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "checks": {
    "database": { "status": "ok" },
    "redis": { "status": "ok" },
    "ai": { "status": "ok" }
  }
}
```

### 查看日志

```bash
# 所有服务日志
docker-compose -f docker-compose.prod.yml logs -f

# 特定服务日志
docker-compose -f docker-compose.prod.yml logs -f app
docker-compose -f docker-compose.prod.yml logs -f postgres
docker-compose -f docker-compose.prod.yml logs -f redis

# 最近 100 行
docker-compose -f docker-compose.prod.yml logs --tail=100 app
```

### 容器状态监控

```bash
# 容器资源使用
docker stats

# 服务状态
docker-compose -f docker-compose.prod.yml ps
```

---

## 故障排除

### 常见问题

#### 1. 容器无法启动

**症状**: `docker-compose up` 失败

**解决方案**:
```bash
# 查看详细日志
docker-compose -f docker-compose.prod.yml logs

# 检查端口占用
netstat -tuln | grep :3000
# 或
lsof -i :3000

# 检查磁盘空间
df -h
```

#### 2. 数据库连接失败

**症状**: 应用日志显示数据库连接错误

**解决方案**:
```bash
# 检查数据库容器
docker exec -it rss-easy-db psql -U rss_easy -d rss_easy -c "SELECT 1"

# 检查数据库日志
docker logs rss-easy-db

# 重置数据库
docker-compose -f docker-compose.prod.yml down
docker volume rm rss-easy_postgres_data
docker-compose -f docker-compose.prod.yml up -d
```

#### 3. AI 分析失败

**症状**: 文章抓取成功但无 AI 分析

**解决方案**:
```bash
# 检查队列状态
curl http://localhost:8915/api/scheduler/status

# 手动触发分析
curl -X POST http://localhost:8915/api/scheduler/trigger \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type":"both"}'
```

#### 4. 内存不足

**症状**: 容器因 OOM 退出

**解决方案**:
```bash
# 增加内存限制
# 编辑 docker-compose.prod.yml 中的 memory 限制

# 或增加 Node.js 内存
# 在 .env 中设置：
NODE_OPTIONS=--max-old-space-size=4096
```

---

## 更新应用

### 零停机更新

```bash
# 1. 拉取最新代码
git pull

# 2. 重新构建镜像
docker-compose -f docker-compose.prod.yml build

# 3. 重启服务（保留数据库）
docker-compose -f docker-compose.prod.yml up -d app

# 4. 运行数据库迁移（如果有）
docker-compose -f docker-compose.prod.yml exec app \
  npx prisma db push
```

### 数据库迁移

```bash
# 运行迁移
docker-compose -f docker-compose.prod.yml exec app \
  npx prisma db push

# 重新生成 Prisma Client
docker-compose -f docker-compose.prod.yml exec app \
  npx prisma generate
```

---

## 性能优化

### 数据库优化

```sql
-- 定期运行 VACUUM
VACUUM ANALYZE;

-- 查看表大小
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname::text || '.' || tablename::text) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname::text || '.' || tablename::text) DESC;
```

### Redis 优化

```bash
# 连接到 Redis
docker exec -it rss-easy-redis redis-cli -a your_password

# 查看信息
INFO

# 查看内存使用
MEMORY
```

---

## 安全加固

### 防火墙配置

```bash
# 只开放必要端口
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 22/tcp    # SSH
ufw enable
```

### Nginx 反向代理配置

参考 README.md 中的 Nginx 配置示例。

---

## 监控和告警

### 推荐监控工具

- **Prometheus + Grafana** - 指标监控
- **Sentry** - 错误追踪
- **Uptime Kuma** - 服务可用性监控

### 关键指标

- 应用响应时间 < 500ms (P95)
- 错误率 < 1%
- CPU 使用率 < 80%
- 内存使用率 < 85%
- 磁盘使用率 < 90%

---

## 联系和支持

- 问题反馈: [GitHub Issues](https://github.com/your-username/rss-easy/issues)
- 文档: [README.md](README.md)
- 部署文档: [DEPLOYMENT.md](DEPLOYMENT.md)

---

**部署完成后，请确认所有安全检查项都已通过！**
