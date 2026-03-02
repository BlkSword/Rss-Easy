/**
 * 权限检查 Hook
 * 用于检查当前用户的角色和权限
 */

'use client';

import { useMemo } from 'react';
import { trpc } from '@/lib/trpc/client';
import {
  hasPermission,
  hasRoleLevel,
  hasAnyPermission,
  hasAllPermissions,
  type Permission,
  type UserRole,
} from '@/lib/auth/roles';

/**
 * 权限检查 Hook
 */
export function usePermission() {
  const { data: user, isLoading, error } = trpc.auth.me.useQuery();

  const userRole = user?.role as UserRole | undefined;

  // 检查是否拥有指定权限
  const checkPermission = useMemo(() => {
    return (permission: Permission) => hasPermission(userRole ?? null, permission);
  }, [userRole]);

  // 检查是否达到指定角色级别
  const checkRoleLevel = useMemo(() => {
    return (requiredRole: UserRole) => hasRoleLevel(userRole ?? null, requiredRole);
  }, [userRole]);

  // 检查是否拥有任意指定权限
  const checkAnyPermission = useMemo(() => {
    return (permissions: Permission[]) => hasAnyPermission(userRole ?? null, permissions);
  }, [userRole]);

  // 检查是否拥有所有指定权限
  const checkAllPermissions = useMemo(() => {
    return (permissions: Permission[]) => hasAllPermissions(userRole ?? null, permissions);
  }, [userRole]);

  // 角色检查
  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = checkRoleLevel('admin');
  const isEditor = checkRoleLevel('editor');
  const isUser = !!userRole;

  return {
    // 用户信息
    user,
    userRole,
    isLoading,
    error,

    // 权限检查函数
    hasPermission: checkPermission,
    hasRoleLevel: checkRoleLevel,
    hasAnyPermission: checkAnyPermission,
    hasAllPermissions: checkAllPermissions,

    // 便捷角色检查
    isSuperAdmin,
    isAdmin,
    isEditor,
    isUser,

    // 系统管理权限
    canManageSystem: isSuperAdmin,
    canManageUsers: isAdmin,
    canModerateContent: isEditor,
  };
}

/**
 * 获取角色显示名称
 */
export function useRoleDisplay() {
  const { userRole } = usePermission();

  const roleDisplayNames: Record<UserRole, string> = {
    super_admin: '超级管理员',
    admin: '管理员',
    editor: '编辑',
    user: '普通用户',
  };

  return userRole ? roleDisplayNames[userRole] : null;
}
