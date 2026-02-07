# 前端重构文档

## 重构概述

本次重构旨在提升 Rss-Easy 项目的用户体验和代码质量，主要包含以下改进：

## 1. 统一设计系统

### 1.1 基础 UI 组件
- **Button** - 统一按钮组件，支持多种变体和尺寸
- **Card** - 卡片组件，支持悬停效果和多种样式
- **Badge** - 徽章组件，用于状态和标签展示
- **Skeleton** - 骨架屏组件，提供加载状态
- **EmptyState** - 空状态组件，统一无数据展示
- **Modal** - 模态框组件，统一的对话框交互
- **Tooltip** - 提示组件

### 1.2 动画组件
- **Fade** - 淡入淡出动画
- **StaggerContainer** - 交错动画容器
- **Scale** - 缩放动画
- **PageTransition** - 页面过渡动画
- **Spinner** - 加载动画

## 2. 交互增强

### 2.1 键盘快捷键支持
- `j/k` - 上一篇/下一篇文章
- `r` - 刷新
- `s` - 收藏/取消收藏
- `m` - 标记已读/未读
- `cmd+k` - 搜索
- `a` - 添加订阅
- `?` - 快捷键帮助

### 2.2 无限滚动
- 文章列表支持无限滚动加载
- 自动触发加载更多
- 加载状态指示

### 2.3 用户偏好
- 侧边栏折叠状态持久化
- 阅读模式偏好
- 自动标记已读设置
- 字体大小设置

## 3. 布局优化

### 3.1 三栏式阅读器布局
```
+------------------+------------------+------------------+
|     Header       |     Header       |     Header       |
+------------------+------------------+------------------+
|                  |                  |                  |
|    Sidebar       |   Entry List     |  Article View    |
|   (Navigation)   |   (Article List) |  (Reading Panel) |
|                  |                  |                  |
+------------------+------------------+------------------+
```

### 3.2 响应式设计
- 移动端：单栏布局，底部导航
- 平板：双栏布局
- 桌面：三栏布局

## 4. 性能优化

### 4.1 组件级优化
- 使用 `React.memo` 减少不必要渲染
- 使用 `useCallback` 缓存回调函数
- 使用 `useMemo` 缓存计算结果

### 4.2 数据获取优化
- 无限滚动替代分页
- 数据预取
- 乐观更新

## 5. 代码结构

```
components/
├── ui/              # 基础 UI 组件
├── animation/       # 动画组件
├── layout/          # 布局组件
├── entries/         # 文章相关组件
└── error-boundary.tsx

hooks/
├── use-keyboard.ts
├── use-intersection-observer.ts
├── use-local-storage.ts
└── use-media-query.ts

lib/
└── utils.ts         # 工具函数
```

## 6. 使用示例

### 6.1 使用 UI 组件
```tsx
import { Button, Card, Badge } from '@/components/ui';

<Button variant="primary" size="md" isLoading={isLoading}>
  保存
</Button>

<Card isHoverable isClickable>
  <CardHeader>
    <CardTitle>文章标题</CardTitle>
  </CardHeader>
</Card>

<Badge variant="primary" dot>新消息</Badge>
```

### 6.2 使用 Hooks
```tsx
import { useKeyboard, useUserPreferences } from '@/hooks';

// 键盘快捷键
useKeyboard([
  { key: 's', handler: handleSave },
  { key: 'j', handler: handleNext },
]);

// 用户偏好
const { sidebarCollapsed, setSidebarCollapsed } = useUserPreferences();
```

### 6.3 使用动画
```tsx
import { PageTransition, StaggerContainer } from '@/components/animation';

<PageTransition>
  <StaggerContainer staggerDelay={100}>
    {items.map(item => <Item key={item.id} {...item} />)}
  </StaggerContainer>
</PageTransition>
```

## 7. 主题配置

### 7.1 颜色系统
- Primary: 温暖的橙红色
- Secondary: 温暖的米黄色
- Background: 米色背景
- Muted: 静音色

### 7.2 圆角系统
- sm: 0.5rem
- md: 0.75rem
- lg: 1rem
- xl: 1.5rem
- full: 9999px

## 8. 待完成事项

- [ ] 完成所有页面的响应式适配
- [ ] 添加更多动画效果
- [ ] 优化移动端触摸操作
- [ ] 添加 PWA 支持
- [ ] 优化首屏加载速度
