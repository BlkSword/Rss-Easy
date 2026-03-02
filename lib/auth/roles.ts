/**
 * 角色权限系统
 * 定义四级用户角色及其权限
 */

// 角色类型
export type UserRole = 'super_admin' | 'admin' | 'editor' | 'user';

// 权限类型
export type Permission =
  // 基础权限
  | 'read:feeds'
  | 'write:feeds'
  | 'read:entries'
  | 'write:entries'
  | 'read:categories'
  | 'write:categories'
  // 编辑权限
  | 'moderate:entries'
  | 'manage:categories'
  // 管理员权限
  | 'read:users'
  | 'write:users'
  | 'read:logs'
  | 'manage:reports'
  // 超级管理员权限
  | 'admin:system'
  | 'admin:users'
  | 'admin:delete_user';

// 角色权限映射
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    // 基础权限
    'read:feeds',
    'write:feeds',
    'read:entries',
    'write:entries',
    'read:categories',
    'write:categories',
    // 编辑权限
    'moderate:entries',
    'manage:categories',
    // 管理员权限
    'read:users',
    'write:users',
    'read:logs',
    'manage:reports',
    // 超级管理员权限
    'admin:system',
    'admin:users',
    'admin:delete_user',
  ],
  admin: [
    // 基础权限
    'read:feeds',
    'write:feeds',
    'read:entries',
    'write:entries',
    'read:categories',
    'write:categories',
    // 编辑权限
    'moderate:entries',
    'manage:categories',
    // 管理员权限
    'read:users',
    'write:users',
    'read:logs',
    'manage:reports',
  ],
  editor: [
    // 基础权限
    'read:feeds',
    'write:feeds',
    'read:entries',
    'write:entries',
    'read:categories',
    'write:categories',
    // 编辑权限
    'moderate:entries',
    'manage:categories',
  ],
  user: [
    // 基础权限
    'read:feeds',
    'write:feeds',
    'read:entries',
    'write:entries',
    'read:categories',
    'write:categories',
  ],
};

// 角色层级（数字越大权限越高）
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 100,
  admin: 75,
  editor: 50,
  user: 25,
};

/**
 * 检查用户是否拥有指定权限
 */
export function hasPermission(userRole: string | null | undefined, permission: Permission): boolean {
  if (!userRole) return false;

  const role = userRole as UserRole;
  const permissions = ROLE_PERMISSIONS[role];

  if (!permissions) return false;

  return permissions.includes(permission);
}

/**
 * 检查用户是否拥有所有指定权限
 */
export function hasAllPermissions(userRole: string | null | undefined, permissions: Permission[]): boolean {
  if (!userRole || permissions.length === 0) return false;

  return permissions.every(permission => hasPermission(userRole, permission));
}

/**
 * 检查用户是否拥有任意指定权限
 */
export function hasAnyPermission(userRole: string | null | undefined, permissions: Permission[]): boolean {
  if (!userRole || permissions.length === 0) return false;

  return permissions.some(permission => hasPermission(userRole, permission));
}

/**
 * 检查用户角色是否达到指定级别
 */
export function hasRoleLevel(userRole: string | null | undefined, requiredRole: UserRole): boolean {
  if (!userRole) return false;

  const userLevel = ROLE_HIERARCHY[userRole as UserRole];
  const requiredLevel = ROLE_HIERARCHY[requiredRole];

  if (userLevel === undefined || requiredLevel === undefined) return false;

  return userLevel >= requiredLevel;
}

/**
 * 验证角色值是否有效
 */
export function isValidRole(role: string): role is UserRole {
  return ['super_admin', 'admin', 'editor', 'user'].includes(role);
}

/**
 * 获取角色显示名称
 */
export function getRoleDisplayName(role: string): string {
  const displayNames: Record<UserRole, string> = {
    super_admin: '超级管理员',
    admin: '管理员',
    editor: '编辑',
    user: '普通用户',
  };

  return displayNames[role as UserRole] || role;
}

/**
 * 获取所有角色选项（用于下拉选择）
 */
export function getRoleOptions(): { value: UserRole; label: string; description: string }[] {
  return [
    {
      value: 'super_admin',
      label: '超级管理员',
      description: '拥有全部权限，包括系统设置和用户管理',
    },
    {
      value: 'admin',
      label: '管理员',
      description: '可以管理用户和查看系统日志',
    },
    {
      value: 'editor',
      label: '编辑',
      description: '可以管理内容和分类',
    },
    {
      value: 'user',
      label: '普通用户',
      description: '基础功能：订阅、阅读、个人设置',
    },
  ];
}

/**
 * 检查是否可以修改目标用户的角色
 * 规则：
 * - 只有 super_admin 可以创建/修改 admin
 * - 只有 admin+ 可以创建/修改 editor
 * - 用户不能修改自己的角色
 */
export function canModifyRole(
  currentRole: string,
  targetRole: string,
  currentUserId: string,
  targetUserId?: string
): { allowed: boolean; reason?: string } {
  // 不能修改自己的角色
  if (currentUserId === targetUserId) {
    return { allowed: false, reason: '不能修改自己的角色' };
  }

  const currentLevel = ROLE_HIERARCHY[currentRole as UserRole];
  const targetLevel = ROLE_HIERARCHY[targetRole as UserRole];

  if (currentLevel === undefined || targetLevel === undefined) {
    return { allowed: false, reason: '无效的角色' };
  }

  // super_admin 可以修改任何角色
  if (currentRole === 'super_admin') {
    return { allowed: true };
  }

  // admin 只能修改 editor 和 user
  if (currentRole === 'admin') {
    if (targetLevel >= ROLE_HIERARCHY.admin) {
      return { allowed: false, reason: '管理员只能修改编辑和普通用户的角色' };
    }
    return { allowed: true };
  }

  // editor 只能修改 user（但通常编辑不应该有用户管理权限）
  if (currentRole === 'editor') {
    if (targetRole !== 'user') {
      return { allowed: false, reason: '编辑只能修改普通用户的角色' };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: '没有权限修改用户角色' };
}
