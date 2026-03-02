/**
 * 管理设置组件
 * 包含系统设置和用户管理功能
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  Users,
  Shield,
  Save,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  UserCog,
  Trash2,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { notifySuccess, notifyError } from '@/lib/feedback';
import { Modal, ConfirmModal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { usePermission } from '@/hooks/use-permission';
import { getRoleOptions, getRoleDisplayName } from '@/lib/auth/roles';

type TabKey = 'settings' | 'users';

export function AdminSettings() {
  const { isSuperAdmin, isAdmin } = usePermission();
  const [activeTab, setActiveTab] = useState<TabKey>('settings');

  // 如果没有管理员权限，显示提示
  if (!isAdmin) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="py-12">
          <div className="text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
            <h3 className="mt-4 text-lg font-medium">权限不足</h3>
            <p className="mt-2 text-muted-foreground">您没有访问此页面的权限</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const tabs = [
    { key: 'settings' as TabKey, label: '系统设置', icon: Settings, superAdminOnly: true },
    { key: 'users' as TabKey, label: '用户管理', icon: Users, superAdminOnly: false },
  ];

  // 根据权限过滤标签
  const visibleTabs = isSuperAdmin
    ? tabs
    : tabs.filter(t => !t.superAdminOnly);

  return (
    <div className="space-y-6">
      {/* 标签页导航 */}
      <div className="flex gap-2 border-b border-border pb-2">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary/10 text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 内容区域 */}
      {activeTab === 'settings' && isSuperAdmin && <SystemSettingsPanel />}
      {activeTab === 'users' && <UserManagementPanel />}
    </div>
  );
}

/**
 * 系统设置面板
 */
function SystemSettingsPanel() {
  const [formData, setFormData] = useState({
    allowRegistration: true,
    defaultUserRole: 'user' as 'user' | 'editor' | 'admin',
    systemName: 'Rss-Easy',
    systemLogo: '',
    systemDescription: '',
    maintenanceMode: false,
    maintenanceMessage: '',
  });

  // 获取当前设置
  const { data: settings, isLoading } = trpc.admin.getSystemSettings.useQuery();

  // 更新设置
  const { mutate: updateSettings, isPending } = trpc.admin.updateSystemSettings.useMutation({
    onSuccess: () => {
      notifySuccess('系统设置已保存');
    },
    onError: (err) => {
      notifyError(err.message || '保存失败');
    },
  });

  // 同步表单数据
  useEffect(() => {
    if (settings) {
      setFormData({
        allowRegistration: settings.allowRegistration,
        defaultUserRole: settings.defaultUserRole as 'user' | 'editor' | 'admin',
        systemName: settings.systemName,
        systemLogo: settings.systemLogo || '',
        systemDescription: settings.systemDescription || '',
        maintenanceMode: settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage || '',
      });
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      allowRegistration: formData.allowRegistration,
      defaultUserRole: formData.defaultUserRole,
      systemName: formData.systemName,
      systemLogo: formData.systemLogo || null,
      systemDescription: formData.systemDescription || null,
      maintenanceMode: formData.maintenanceMode,
      maintenanceMessage: formData.maintenanceMessage || null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const roleOptions = getRoleOptions().filter(r => r.value !== 'super_admin');

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 注册设置 */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            注册设置
          </CardTitle>
          <CardDescription>控制新用户注册和默认权限</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 开放注册开关 */}
          <div
            className={cn(
              'flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-250 cursor-pointer group',
              'hover:border-primary/30 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent',
              formData.allowRegistration
                ? 'border-primary/50 bg-gradient-to-r from-primary/[0.08] to-primary/[0.03] shadow-sm'
                : 'border-border/80 bg-muted/20'
            )}
            onClick={() => setFormData({ ...formData, allowRegistration: !formData.allowRegistration })}
          >
            <div className="flex items-center gap-3 flex-1">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-250',
                formData.allowRegistration ? 'bg-primary/20 shadow-sm' : 'bg-muted/60 group-hover:bg-primary/10'
              )}>
                <Check className={cn(
                  'h-5 w-5 transition-all duration-250',
                  formData.allowRegistration ? 'text-primary scale-110' : 'text-muted-foreground group-hover:text-primary/60'
                )} />
              </div>
              <div>
                <div className={cn(
                  'font-medium transition-colors duration-200',
                  formData.allowRegistration ? 'text-primary' : 'group-hover:text-primary/90'
                )}>开放注册</div>
                <div className="text-sm text-muted-foreground">允许新用户注册账户</div>
              </div>
            </div>
            <button
              type="button"
              className={cn(
                'toggle-switch relative w-14 h-7 rounded-full transition-all duration-300',
                formData.allowRegistration
                  ? 'bg-slate-300 dark:bg-slate-600'
                  : 'bg-primary shadow-lg shadow-primary/30'
              )}
              onClick={(e) => {
                e.stopPropagation();
                setFormData({ ...formData, allowRegistration: !formData.allowRegistration });
              }}
            >
              <span
                className={cn(
                  'absolute top-1 w-5 h-5 rounded-full shadow-md transition-all duration-300',
                  formData.allowRegistration
                    ? 'left-8 bg-white'
                    : 'left-1 bg-white'
                )}
              />
            </button>
          </div>

          {/* 默认角色选择 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">新用户默认角色</label>
            <select
              value={formData.defaultUserRole}
              onChange={(e) => setFormData({ ...formData, defaultUserRole: e.target.value as any })}
              className={cn(
                'w-full px-4 py-3 rounded-xl border-2 border-border bg-background',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                'transition-all duration-200 input-warm cursor-pointer hover:border-primary/30'
              )}
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.description}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* 系统外观 */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            系统外观
          </CardTitle>
          <CardDescription>自定义系统名称和外观</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 系统名称 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">系统名称</label>
            <input
              type="text"
              value={formData.systemName}
              onChange={(e) => setFormData({ ...formData, systemName: e.target.value })}
              className={cn(
                'w-full px-4 py-3 rounded-xl border-2 border-border bg-background',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                'transition-all duration-200 input-warm',
                'placeholder:text-muted-foreground/50'
              )}
              placeholder="Rss-Easy"
            />
          </div>

          {/* 系统 Logo */}
          <div className="space-y-2">
            <label className="text-sm font-medium">系统 Logo URL</label>
            <input
              type="url"
              value={formData.systemLogo}
              onChange={(e) => setFormData({ ...formData, systemLogo: e.target.value })}
              className={cn(
                'w-full px-4 py-3 rounded-xl border-2 border-border bg-background',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                'transition-all duration-200 input-warm',
                'placeholder:text-muted-foreground/50'
              )}
              placeholder="https://example.com/logo.png"
            />
          </div>

          {/* 系统描述 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">系统描述</label>
            <textarea
              value={formData.systemDescription}
              onChange={(e) => setFormData({ ...formData, systemDescription: e.target.value })}
              className={cn(
                'w-full px-4 py-3 rounded-xl border-2 border-border bg-background',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                'transition-all duration-200 input-warm min-h-[80px] resize-none',
                'placeholder:text-muted-foreground/50'
              )}
              placeholder="简要描述您的系统..."
            />
          </div>
        </CardContent>
      </Card>

      {/* 维护模式 */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            维护模式
          </CardTitle>
          <CardDescription>系统维护时显示提示信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 维护模式开关 */}
          <div
            className={cn(
              'flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-250 cursor-pointer group',
              'hover:border-primary/30 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent',
              formData.maintenanceMode
                ? 'border-orange-500/50 bg-gradient-to-r from-orange-500/[0.08] to-orange-500/[0.03] shadow-sm'
                : 'border-border/80 bg-muted/20'
            )}
            onClick={() => setFormData({ ...formData, maintenanceMode: !formData.maintenanceMode })}
          >
            <div className="flex items-center gap-3 flex-1">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-250',
                formData.maintenanceMode ? 'bg-orange-500/20 shadow-sm' : 'bg-muted/60 group-hover:bg-orange-500/10'
              )}>
                <Check className={cn(
                  'h-5 w-5 transition-all duration-250',
                  formData.maintenanceMode ? 'text-orange-500 scale-110' : 'text-muted-foreground group-hover:text-orange-500/60'
                )} />
              </div>
              <div>
                <div className={cn(
                  'font-medium transition-colors duration-200',
                  formData.maintenanceMode ? 'text-orange-500' : 'group-hover:text-orange-500/90'
                )}>启用维护模式</div>
                <div className="text-sm text-muted-foreground">开启后，普通用户将看到维护提示</div>
              </div>
            </div>
            <button
              type="button"
              className={cn(
                'toggle-switch relative w-14 h-7 rounded-full transition-all duration-300',
                formData.maintenanceMode
                  ? 'bg-slate-300 dark:bg-slate-600'
                  : 'bg-primary shadow-lg shadow-primary/30'
              )}
              onClick={(e) => {
                e.stopPropagation();
                setFormData({ ...formData, maintenanceMode: !formData.maintenanceMode });
              }}
            >
              <span
                className={cn(
                  'absolute top-1 w-5 h-5 rounded-full shadow-md transition-all duration-300',
                  formData.maintenanceMode
                    ? 'left-8 bg-white'
                    : 'left-1 bg-white'
                )}
              />
            </button>
          </div>

          {/* 维护提示信息 */}
          {formData.maintenanceMode && (
            <div className="space-y-2">
              <label className="text-sm font-medium">维护提示信息</label>
              <textarea
                value={formData.maintenanceMessage}
                onChange={(e) => setFormData({ ...formData, maintenanceMessage: e.target.value })}
                className={cn(
                  'w-full px-4 py-3 rounded-xl border-2 border-border bg-background',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                  'transition-all duration-200 input-warm min-h-[80px] resize-none',
                  'placeholder:text-muted-foreground/50'
                )}
                placeholder="系统正在维护中，请稍后再试..."
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          type="submit"
          isLoading={isPending}
          disabled={isPending}
          leftIcon={<Save className="h-4 w-4" />}
        >
          保存设置
        </Button>
      </div>
    </form>
  );
}

/**
 * 用户管理面板
 */
function UserManagementPanel() {
  const { isSuperAdmin, user: currentUser } = usePermission();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);

  // 获取用户列表
  const { data, isLoading, refetch } = trpc.admin.listUsers.useQuery({
    page,
    limit: 10,
    search: search || undefined,
    role: roleFilter as any,
  });

  // 更新用户角色
  const { mutate: updateRole, isPending: updatingRole } = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => {
      notifySuccess('用户角色已更新');
      refetch();
    },
    onError: (err) => {
      notifyError(err.message || '更新失败');
    },
  });

  // 删除用户
  const { mutate: deleteUser, isPending: deletingUser } = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      notifySuccess('用户已删除');
      refetch();
    },
    onError: (err) => {
      notifyError(err.message || '删除失败');
    },
  });

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; username: string } | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<{ id: string; username: string; currentRole: string } | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');

  const handleDeleteClick = (user: { id: string; username: string }) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (userToDelete) {
      deleteUser({ userId: userToDelete.id });
      setDeleteModalOpen(false);
      setUserToDelete(null);
    }
  };

  const handleRoleClick = (user: { id: string; username: string; currentRole: string }) => {
    setUserToEdit(user);
    setSelectedRole(user.currentRole);
    setRoleModalOpen(true);
  };

  const handleConfirmRole = () => {
    if (userToEdit && selectedRole !== userToEdit.currentRole) {
      updateRole({ userId: userToEdit.id, newRole: selectedRole as any });
    }
    setRoleModalOpen(false);
    setUserToEdit(null);
  };

  const roleOptions = getRoleOptions();

  return (
    <div className="space-y-4">
      {/* 搜索和筛选 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="搜索用户名或邮箱..."
            className={cn(
              'w-full pl-10 pr-4 py-3 rounded-xl border-2 border-border bg-background',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
              'transition-all duration-200 input-warm',
              'placeholder:text-muted-foreground/50'
            )}
          />
        </div>
        <select
          value={roleFilter || ''}
          onChange={(e) => {
            setRoleFilter(e.target.value || undefined);
            setPage(1);
          }}
          className={cn(
            'px-4 py-3 rounded-xl border-2 border-border bg-background',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
            'transition-all duration-200 input-warm cursor-pointer hover:border-primary/30'
          )}
        >
          <option value="">全部角色</option>
          {roleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* 用户列表 */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data?.users.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            没有找到用户
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data?.users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* 用户头像 - 白底黑字（深色模式黑底白字） */}
                  <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center text-sm font-medium text-zinc-900 dark:text-zinc-100 border border-border shadow-sm">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.username}</span>
                      {user.id === currentUser?.id && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          你
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* 角色标签 - 白底黑字（深色模式黑底白字） */}
                  <span className="text-xs px-3 py-1 rounded-full bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-border shadow-sm font-medium">
                    {user.roleDisplay}
                  </span>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2">
                    {/* 修改角色 */}
                    <button
                      onClick={() => handleRoleClick({
                        id: user.id,
                        username: user.username,
                        currentRole: user.role,
                      })}
                      disabled={user.id === currentUser?.id || user.role === 'super_admin'}
                      className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="修改角色"
                    >
                      <UserCog className="h-4 w-4" />
                    </button>

                    {/* 删除用户 */}
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleDeleteClick({
                          id: user.id,
                          username: user.username,
                        })}
                        disabled={user.id === currentUser?.id || user.role === 'super_admin'}
                        className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="删除用户"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <span className="text-sm text-muted-foreground">
              共 {data.total} 个用户
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm">
                {page} / {data.totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === data.totalPages}
                className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* 删除确认弹窗 */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setUserToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="删除用户"
        description={`确定要删除用户 "${userToDelete?.username}" 吗？此操作将永久删除该用户的所有数据，包括订阅源、文章、设置等。此操作无法撤销。`}
        confirmText="确认删除"
        isConfirmLoading={deletingUser}
        confirmVariant="danger"
      />

      {/* 修改角色弹窗 */}
      <Modal
        isOpen={roleModalOpen}
        onClose={() => {
          setRoleModalOpen(false);
          setUserToEdit(null);
        }}
        title="修改用户角色"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setRoleModalOpen(false);
                setUserToEdit(null);
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirmRole}
              disabled={updatingRole || selectedRole === userToEdit?.currentRole}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {updatingRole ? '更新中...' : '确认'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-muted-foreground">
            为用户 <span className="font-medium text-foreground">{userToEdit?.username}</span> 选择新角色：
          </p>
          <div className="space-y-2">
            {roleOptions
              .filter(option => option.value !== 'super_admin')
              .map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                    selectedRole === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={selectedRole === option.value}
                    onChange={() => setSelectedRole(option.value)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium">{option.label}</div>
                    <div className="text-sm text-muted-foreground">{option.description}</div>
                  </div>
                </label>
              ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
