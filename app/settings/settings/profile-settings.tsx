/**
 * 个人资料设置组件 - 增强交互反馈
 */

'use client';

import { useState, useEffect } from 'react';
import { User, Mail, Calendar, Save, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { notifySuccess, notifyError } from '@/lib/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

interface ProfileSettingsProps {
  user: any;
}

export function ProfileSettings({ user }: ProfileSettingsProps) {
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isSaving, setIsSaving] = useState(false);

  const { mutate: updateProfile } = trpc.settings.updateProfile.useMutation();

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setBio(user.bio || '');
    }
  }, [user]);

  const handleSave = async () => {
    if (!username.trim()) {
      notifyError('用户名不能为空');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({ username: username.trim(), bio: bio.trim() });
      notifySuccess('个人资料已更新');
    } catch (error) {
      notifyError(error instanceof Error ? error.message : '更新失败');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = username !== (user?.username || '') || bio !== (user?.bio || '');

  return (
    <div className="space-y-6">
      {/* 用户信息卡片 */}
      <Card className="overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-3xl font-bold shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl group-hover:rotate-3">
                {user?.username?.charAt(0).toUpperCase() || '?'}
              </div>
              <button className="absolute -bottom-1 -right-1 p-2 bg-background rounded-full shadow-md border border-border/60 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 active:scale-95 icon-btn-hover">
                <Camera className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold">{user?.username || '未设置'}</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                <Mail className="h-4 w-4" />
                {user?.email}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4" />
                加入于 {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '未知'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 编辑表单 */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
          <CardDescription>更新您的个人资料信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 用户名 */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="输入用户名"
              className={cn(
                'w-full px-4 py-3 rounded-xl border-2 border-border bg-background',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                'transition-all duration-200 input-warm',
                'placeholder:text-muted-foreground/50'
              )}
            />
          </div>

          {/* 个人简介 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">个人简介</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="介绍一下自己..."
              rows={3}
              className={cn(
                'w-full px-4 py-3 rounded-xl border-2 border-border bg-background',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                'transition-all duration-200 resize-none input-warm',
                'placeholder:text-muted-foreground/50'
              )}
            />
          </div>

          {/* 保存按钮 */}
          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={isSaving}
              disabled={!hasChanges || isSaving}
              leftIcon={<Save className="h-4 w-4" />}
            >
              保存更改
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
