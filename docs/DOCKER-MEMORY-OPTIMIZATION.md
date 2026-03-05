# Docker 部署内存优化指南

## 智能内存管理

本项目采用**智能动态内存管理**，启动脚本会自动检测系统内存并动态调整构建参数，无需手动选择配置。

### 使用方式

```bash
# Linux/macOS
./start.sh

# Windows
start.bat
```

脚本会自动：
1. 检测系统总内存
2. 计算最优的构建参数
3. 传递参数给 Docker 构建

## 内存配置档

根据系统内存自动选择配置：

| 系统内存 | 配置档 | 构建内存 | 运行时内存 | pnpm 并发 |
|---------|-------|---------|----------|----------|
| ≥8GB | high | 3072MB | 768MB | 4 |
| 4-8GB | medium | 2048MB | 512MB | 2 |
| 2-4GB | low | 1024MB | 384MB | 1 |
| <2GB | minimal | 768MB | 256MB | 1 |

## 构建参数说明

Dockerfile 支持以下构建参数：

| 参数 | 默认值 | 说明 |
|-----|-------|-----|
| BUILD_MEMORY | 1536 | Node.js 构建时内存限制（MB） |
| RUNTIME_MEMORY | 512 | 运行时内存限制（MB） |
| PNPM_CONCURRENCY | 2 | pnpm 并发下载数 |

### 手动指定参数

```bash
docker build \
  --build-arg BUILD_MEMORY=1024 \
  --build-arg RUNTIME_MEMORY=384 \
  --build-arg PNPM_CONCURRENCY=1 \
  -t rss-post .
```

## 优化策略

### 1. Node.js 内存优化

```dockerfile
ENV NODE_OPTIONS="--max-old-space-size=${BUILD_MEMORY} --optimize-for-size --gc-interval=100"
```

- `--max-old-space-size`：动态设置堆内存上限
- `--optimize-for-size`：优先内存优化
- `--gc-interval`：定期垃圾回收

### 2. 并发控制

```dockerfile
ENV NEXT_PRIVATE_STANDALONE_WORKER_THREADS=1
ENV UV_THREADPOOL_SIZE=4
```

限制 Next.js 并行编译，减少内存峰值。

### 3. pnpm 并发限制

```dockerfile
pnpm config set network-concurrency ${PNPM_CONCURRENCY}
pnpm config set child-concurrency ${PNPM_CONCURRENCY}
```

限制依赖下载和解压的并发数。

### 4. 分阶段构建

```
base → deps → builder → runner
```

每个阶段只包含必要内容，最小化镜像大小。

## 低内存环境建议

### Linux：增加 Swap

```bash
# 创建 2GB swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 永久生效
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Windows：增加虚拟内存

1. 系统属性 → 高级 → 性能 → 设置
2. 高级 → 虚拟内存 → 更改
3. 自定义大小：初始 2048MB，最大 4096MB
4. 重启电脑

## 故障排查

### 构建失败：exit code 9 (OOM)

**原因**：系统内存不足，进程被 OOM Killer 终止

**解决方案**：
1. 关闭其他应用程序
2. 增加 Swap/虚拟内存
3. 使用预构建镜像

### 构建非常慢

**原因**：低内存配置下频繁垃圾回收

**说明**：这是正常现象，低内存环境下构建时间会较长。

### 运行时崩溃

**解决方案**：
1. 检查容器资源限制
2. 手动增加 RUNTIME_MEMORY 参数

## 监控

```bash
# 实时监控容器内存
docker stats rss-post-app rss-post-db rss-post-redis
```
