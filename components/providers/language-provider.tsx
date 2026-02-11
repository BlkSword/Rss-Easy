/**
 * 语言提供者 - 管理应用语言
 */

'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

type Language = 'zh-CN' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'rss-easy-language';

// 翻译字典
const translations: Record<Language, Record<string, string>> = {
  'zh-CN': {
    // 通用
    'app.name': 'Rss-Easy',
    'app.description': '智能RSS资讯聚合平台',
    'app.loading': '加载中...',
    'app.empty': '暂无数据',
    'app.no_more': '没有更多了',
    'app.load_more': '加载更多',
    'app.view_all': '查看全部',
    'app.show_more': '显示更多',
    'app.show_less': '收起',
    'app.collapse': '折叠',
    'app.expand': '展开',
    'app.back': '返回',
    'app.next': '下一步',
    'app.prev': '上一步',
    'app.finish': '完成',
    'app.done': '完成',
    'app.ok': '确定',
    'app.yes': '是',
    'app.no': '否',
    'app.on': '开启',
    'app.off': '关闭',
    'app.enable': '启用',
    'app.disable': '禁用',
    'app.active': '启用中',
    'app.inactive': '已禁用',
    'app.status': '状态',
    'app.search': '搜索',
    'app.search_placeholder': '搜索...',
    'app.filter': '筛选',
    'app.sort': '排序',
    'app.date': '日期',
    'app.time': '时间',
    'app.today': '今天',
    'app.yesterday': '昨天',
    'app.this_week': '本周',
    'app.this_month': '本月',
    'app.just_now': '刚刚',
    'app.minutes_ago': '分钟前',
    'app.hours_ago': '小时前',
    'app.days_ago': '天前',
    
    // 导航
    'nav.all': '全部文章',
    'nav.unread': '未读',
    'nav.starred': '星标',
    'nav.archive': '归档',
    'nav.ai_reports': 'AI 报告',
    'nav.categories': '分组',
    'nav.feeds': '订阅源',
    'nav.settings': '设置',
    'nav.notifications': '通知',
    'nav.search': '搜索',
    'nav.home': '首页',
    'nav.profile': '个人资料',
    'nav.logout': '登出',
    'nav.login': '登录',
    'nav.register': '注册',
    'nav.shortcuts': '快捷键',
    'nav.add_feed': '添加订阅',
    'nav.manage_feeds': '管理订阅源',
    
    // 操作
    'action.refresh': '刷新',
    'action.save': '保存',
    'action.save_changes': '保存更改',
    'action.cancel': '取消',
    'action.delete': '删除',
    'action.remove': '移除',
    'action.edit': '编辑',
    'action.modify': '修改',
    'action.add': '添加',
    'action.create': '创建',
    'action.new': '新建',
    'action.close': '关闭',
    'action.confirm': '确认',
    'action.apply': '应用',
    'action.reset': '重置',
    'action.clear': '清空',
    'action.clear_all': '清空全部',
    'action.subscribe': '订阅',
    'action.unsubscribe': '取消订阅',
    'action.mark_read': '标记为已读',
    'action.mark_unread': '标记为未读',
    'action.mark_all_read': '全部标为已读',
    'action.star': '收藏',
    'action.unstar': '取消收藏',
    'action.archive': '归档',
    'action.unarchive': '取消归档',
    'action.download': '下载',
    'action.upload': '上传',
    'action.import': '导入',
    'action.export': '导出',
    'action.share': '分享',
    'action.copy': '复制',
    'action.paste': '粘贴',
    'action.cut': '剪切',
    'action.select': '选择',
    'action.select_all': '全选',
    'action.deselect': '取消选择',
    'action.move': '移动',
    'action.rename': '重命名',
    'action.duplicate': '复制',
    'action.open': '打开',
    'action.view': '查看',
    'action.preview': '预览',
    'action.print': '打印',
    'action.send': '发送',
    'action.submit': '提交',
    'action.retry': '重试',
    'action.refresh_list': '刷新列表',
    'action.go_back': '返回',
    'action.learn_more': '了解更多',
    'action.get_started': '开始使用',
    'action.see_all': '查看全部',
    'action.show_details': '查看详情',
    'action.hide_details': '隐藏详情',
    
    // 设置
    'settings.title': '设置',
    'settings.description': '管理您的应用偏好和账户设置',
    'settings.appearance': '外观设置',
    'settings.appearance_desc': '自定义应用的外观和显示方式',
    'settings.reading': '阅读设置',
    'settings.reading_desc': '配置阅读和文章显示行为',
    'settings.notifications': '通知设置',
    'settings.notifications_desc': '管理通知偏好',
    'settings.ai': 'AI 设置',
    'settings.ai_desc': '配置 AI 摘要和报告功能',
    'settings.data': '数据管理',
    'settings.data_desc': '导入、导出和管理您的数据',
    'settings.api': 'API 设置',
    'settings.api_desc': '管理 API 密钥和访问令牌',
    'settings.account': '账户设置',
    'settings.account_desc': '管理您的账户信息和安全',
    'settings.language': '语言',
    'settings.theme': '主题',
    'settings.theme.light': '浅色',
    'settings.theme.dark': '深色',
    'settings.theme.system': '跟随系统',
    'settings.items_per_page': '每页显示文章数',
    'settings.auto_mark_read': '自动标记为已读',
    'settings.auto_mark_read_desc': '点击文章后自动标记为已读',
    'settings.show_full_content': '显示完整内容',
    'settings.show_full_content_desc': '在列表中显示文章完整内容而非摘要',
    'settings.show_unread_count': '显示未读计数',
    'settings.show_unread_count_desc': '在订阅源旁边显示未读文章数量',
    
    // 主题
    'theme.light': '浅色',
    'theme.dark': '深色',
    'theme.system': '跟随系统',
    
    // 提示
    'toast.success': '操作成功',
    'toast.error': '操作失败',
    'toast.saved': '已保存',
    'toast.deleted': '已删除',
    'toast.updated': '已更新',
    'toast.created': '已创建',
    'toast.copied': '已复制',
    'toast.loading': '加载中...',
    'toast.please_wait': '请稍候...',
    'toast.confirm_delete': '确定要删除吗？此操作不可恢复。',
    'toast.confirm_unsubscribe': '确定要取消订阅吗？',
    'toast.no_results': '没有找到结果',
    'toast.search_results': '找到 {count} 个结果',
    
    // 订阅源
    'feed.add': '添加订阅源',
    'feed.add_new': '添加新订阅源',
    'feed.manage': '管理订阅源',
    'feed.edit': '编辑订阅源',
    'feed.delete': '删除订阅源',
    'feed.url': '订阅地址',
    'feed.title': '标题',
    'feed.description': '描述',
    'feed.category': '分类',
    'feed.site_url': '网站地址',
    'feed.favicon': '图标',
    'feed.last_update': '最后更新',
    'feed.unread_count': '未读数量',
    'feed.total_entries': '文章总数',
    'feed.status': '状态',
    'feed.active': '启用',
    'feed.inactive': '禁用',
    'feed.error': '错误',
    'feed.no_feeds': '还没有订阅源',
    'feed.add_first': '添加您的第一个订阅源',
    'feed.discover': '自动发现',
    'feed.discover_desc': '输入 URL 自动发现订阅源',
    'feed.import_opml': '导入 OPML',
    'feed.export_opml': '导出 OPML',
    
    // 文章
    'entry.read': '已读',
    'entry.unread': '未读',
    'entry.reading_time': '阅读时间',
    'entry.minutes': '分钟',
    'entry.min': '分钟',
    'entry.by_author': '作者',
    'entry.published_at': '发布时间',
    'entry.updated_at': '更新时间',
    'entry.source': '来源',
    'entry.tags': '标签',
    'entry.no_entries': '没有找到文章',
    'entry.all_caught_up': '全部已读',
    'entry.all_caught_up_desc': '您已经阅读了所有文章',
    
    // 分类
    'category.all': '全部分类',
    'category.uncategorized': '未分类',
    'category.new': '新建分组',
    'category.edit': '编辑分组',
    'category.delete': '删除分组',
    'category.name': '分组名称',
    'category.color': '颜色',
    'category.no_categories': '还没有分组',
    
    // 搜索
    'search.title': '搜索',
    'search.placeholder': '搜索文章...',
    'search.results': '搜索结果',
    'search.no_results': '没有找到相关文章',
    'search.try_other': '尝试使用其他关键词',
    'search.advanced': '高级搜索',
    'search.filter_by': '筛选条件',
    'search.sort_by': '排序方式',
    'search.date_range': '日期范围',
    
    // AI
    'ai.summary': 'AI 摘要',
    'ai.generate_summary': '生成摘要',
    'ai.summary_placeholder': '点击生成 AI 摘要...',
    'ai.daily_report': '日报',
    'ai.weekly_report': '周报',
    'ai.generate_report': '生成报告',
    'ai.report_placeholder': '点击生成 AI 报告...',
    'ai.thinking': 'AI 思考中...',
    'ai.smart_categorize': '智能分类',
    
    // 表单
    'form.required': '必填',
    'form.optional': '可选',
    'form.invalid': '格式不正确',
    'form.email_invalid': '请输入有效的邮箱地址',
    'form.url_invalid': '请输入有效的 URL',
    'form.password_too_short': '密码至少需要 6 个字符',
    'form.password_not_match': '两次输入的密码不一致',
    'form.save_success': '保存成功',
    'form.save_failed': '保存失败',
    
    // 快捷键
    'shortcuts.title': '键盘快捷键',
    'shortcuts.navigation': '导航',
    'shortcuts.actions': '操作',
    'shortcuts.next_item': '下一项',
    'shortcuts.prev_item': '上一项',
    'shortcuts.open_item': '打开',
    'shortcuts.refresh': '刷新',
    'shortcuts.search': '搜索',
    'shortcuts.close': '关闭',
  },
  'en': {
    // General
    'app.name': 'Rss-Easy',
    'app.description': 'Smart RSS Aggregator',
    'app.loading': 'Loading...',
    'app.empty': 'No data',
    'app.no_more': 'No more',
    'app.load_more': 'Load more',
    'app.view_all': 'View all',
    'app.show_more': 'Show more',
    'app.show_less': 'Show less',
    'app.collapse': 'Collapse',
    'app.expand': 'Expand',
    'app.back': 'Back',
    'app.next': 'Next',
    'app.prev': 'Previous',
    'app.finish': 'Finish',
    'app.done': 'Done',
    'app.ok': 'OK',
    'app.yes': 'Yes',
    'app.no': 'No',
    'app.on': 'On',
    'app.off': 'Off',
    'app.enable': 'Enable',
    'app.disable': 'Disable',
    'app.active': 'Active',
    'app.inactive': 'Inactive',
    'app.status': 'Status',
    'app.search': 'Search',
    'app.search_placeholder': 'Search...',
    'app.filter': 'Filter',
    'app.sort': 'Sort',
    'app.date': 'Date',
    'app.time': 'Time',
    'app.today': 'Today',
    'app.yesterday': 'Yesterday',
    'app.this_week': 'This week',
    'app.this_month': 'This month',
    'app.just_now': 'Just now',
    'app.minutes_ago': 'minutes ago',
    'app.hours_ago': 'hours ago',
    'app.days_ago': 'days ago',
    
    // Navigation
    'nav.all': 'All Articles',
    'nav.unread': 'Unread',
    'nav.starred': 'Starred',
    'nav.archive': 'Archive',
    'nav.ai_reports': 'AI Reports',
    'nav.categories': 'Categories',
    'nav.feeds': 'Feeds',
    'nav.settings': 'Settings',
    'nav.notifications': 'Notifications',
    'nav.search': 'Search',
    'nav.home': 'Home',
    'nav.profile': 'Profile',
    'nav.logout': 'Logout',
    'nav.login': 'Login',
    'nav.register': 'Register',
    'nav.shortcuts': 'Shortcuts',
    'nav.add_feed': 'Add Feed',
    'nav.manage_feeds': 'Manage Feeds',
    
    // Actions
    'action.refresh': 'Refresh',
    'action.save': 'Save',
    'action.save_changes': 'Save Changes',
    'action.cancel': 'Cancel',
    'action.delete': 'Delete',
    'action.remove': 'Remove',
    'action.edit': 'Edit',
    'action.modify': 'Modify',
    'action.add': 'Add',
    'action.create': 'Create',
    'action.new': 'New',
    'action.close': 'Close',
    'action.confirm': 'Confirm',
    'action.apply': 'Apply',
    'action.reset': 'Reset',
    'action.clear': 'Clear',
    'action.clear_all': 'Clear All',
    'action.subscribe': 'Subscribe',
    'action.unsubscribe': 'Unsubscribe',
    'action.mark_read': 'Mark as Read',
    'action.mark_unread': 'Mark as Unread',
    'action.mark_all_read': 'Mark All as Read',
    'action.star': 'Star',
    'action.unstar': 'Unstar',
    'action.archive': 'Archive',
    'action.unarchive': 'Unarchive',
    'action.download': 'Download',
    'action.upload': 'Upload',
    'action.import': 'Import',
    'action.export': 'Export',
    'action.share': 'Share',
    'action.copy': 'Copy',
    'action.paste': 'Paste',
    'action.cut': 'Cut',
    'action.select': 'Select',
    'action.select_all': 'Select All',
    'action.deselect': 'Deselect',
    'action.move': 'Move',
    'action.rename': 'Rename',
    'action.duplicate': 'Duplicate',
    'action.open': 'Open',
    'action.view': 'View',
    'action.preview': 'Preview',
    'action.print': 'Print',
    'action.send': 'Send',
    'action.submit': 'Submit',
    'action.retry': 'Retry',
    'action.refresh_list': 'Refresh List',
    'action.go_back': 'Go Back',
    'action.learn_more': 'Learn More',
    'action.get_started': 'Get Started',
    'action.see_all': 'See All',
    'action.show_details': 'Show Details',
    'action.hide_details': 'Hide Details',
    
    // Settings
    'settings.title': 'Settings',
    'settings.description': 'Manage your app preferences and account settings',
    'settings.appearance': 'Appearance',
    'settings.appearance_desc': 'Customize the look and feel of the app',
    'settings.reading': 'Reading',
    'settings.reading_desc': 'Configure reading and article display behavior',
    'settings.notifications': 'Notifications',
    'settings.notifications_desc': 'Manage your notification preferences',
    'settings.ai': 'AI Settings',
    'settings.ai_desc': 'Configure AI summary and report features',
    'settings.data': 'Data Management',
    'settings.data_desc': 'Import, export and manage your data',
    'settings.api': 'API Settings',
    'settings.api_desc': 'Manage API keys and access tokens',
    'settings.account': 'Account',
    'settings.account_desc': 'Manage your account information and security',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'settings.theme.system': 'System',
    'settings.items_per_page': 'Items per page',
    'settings.auto_mark_read': 'Auto mark as read',
    'settings.auto_mark_read_desc': 'Automatically mark articles as read when clicked',
    'settings.show_full_content': 'Show full content',
    'settings.show_full_content_desc': 'Display full content in list instead of summary',
    'settings.show_unread_count': 'Show unread count',
    'settings.show_unread_count_desc': 'Display unread count next to feeds',
    
    // Theme
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'theme.system': 'System',
    
    // Toast
    'toast.success': 'Success',
    'toast.error': 'Error',
    'toast.saved': 'Saved',
    'toast.deleted': 'Deleted',
    'toast.updated': 'Updated',
    'toast.created': 'Created',
    'toast.copied': 'Copied',
    'toast.loading': 'Loading...',
    'toast.please_wait': 'Please wait...',
    'toast.confirm_delete': 'Are you sure you want to delete? This cannot be undone.',
    'toast.confirm_unsubscribe': 'Are you sure you want to unsubscribe?',
    'toast.no_results': 'No results found',
    'toast.search_results': 'Found {count} results',
    
    // Feed
    'feed.add': 'Add Feed',
    'feed.add_new': 'Add New Feed',
    'feed.manage': 'Manage Feeds',
    'feed.edit': 'Edit Feed',
    'feed.delete': 'Delete Feed',
    'feed.url': 'Feed URL',
    'feed.title': 'Title',
    'feed.description': 'Description',
    'feed.category': 'Category',
    'feed.site_url': 'Site URL',
    'feed.favicon': 'Icon',
    'feed.last_update': 'Last Update',
    'feed.unread_count': 'Unread',
    'feed.total_entries': 'Total Entries',
    'feed.status': 'Status',
    'feed.active': 'Active',
    'feed.inactive': 'Inactive',
    'feed.error': 'Error',
    'feed.no_feeds': 'No feeds yet',
    'feed.add_first': 'Add your first feed',
    'feed.discover': 'Auto Discover',
    'feed.discover_desc': 'Enter URL to auto-discover feeds',
    'feed.import_opml': 'Import OPML',
    'feed.export_opml': 'Export OPML',
    
    // Entry
    'entry.read': 'Read',
    'entry.unread': 'Unread',
    'entry.reading_time': 'Reading time',
    'entry.minutes': 'minutes',
    'entry.min': 'min',
    'entry.by_author': 'by',
    'entry.published_at': 'Published',
    'entry.updated_at': 'Updated',
    'entry.source': 'Source',
    'entry.tags': 'Tags',
    'entry.no_entries': 'No entries found',
    'entry.all_caught_up': 'All caught up',
    'entry.all_caught_up_desc': 'You have read all articles',
    
    // Category
    'category.all': 'All Categories',
    'category.uncategorized': 'Uncategorized',
    'category.new': 'New Category',
    'category.edit': 'Edit Category',
    'category.delete': 'Delete Category',
    'category.name': 'Category Name',
    'category.color': 'Color',
    'category.no_categories': 'No categories yet',
    
    // Search
    'search.title': 'Search',
    'search.placeholder': 'Search articles...',
    'search.results': 'Search Results',
    'search.no_results': 'No articles found',
    'search.try_other': 'Try different keywords',
    'search.advanced': 'Advanced Search',
    'search.filter_by': 'Filter by',
    'search.sort_by': 'Sort by',
    'search.date_range': 'Date Range',
    
    // AI
    'ai.summary': 'AI Summary',
    'ai.generate_summary': 'Generate Summary',
    'ai.summary_placeholder': 'Click to generate AI summary...',
    'ai.daily_report': 'Daily Report',
    'ai.weekly_report': 'Weekly Report',
    'ai.generate_report': 'Generate Report',
    'ai.report_placeholder': 'Click to generate AI report...',
    'ai.thinking': 'AI thinking...',
    'ai.smart_categorize': 'Smart Categorize',
    
    // Form
    'form.required': 'Required',
    'form.optional': 'Optional',
    'form.invalid': 'Invalid format',
    'form.email_invalid': 'Please enter a valid email',
    'form.url_invalid': 'Please enter a valid URL',
    'form.password_too_short': 'Password must be at least 6 characters',
    'form.password_not_match': 'Passwords do not match',
    'form.save_success': 'Saved successfully',
    'form.save_failed': 'Failed to save',
    
    // Shortcuts
    'shortcuts.title': 'Keyboard Shortcuts',
    'shortcuts.navigation': 'Navigation',
    'shortcuts.actions': 'Actions',
    'shortcuts.next_item': 'Next item',
    'shortcuts.prev_item': 'Previous item',
    'shortcuts.open_item': 'Open',
    'shortcuts.refresh': 'Refresh',
    'shortcuts.search': 'Search',
    'shortcuts.close': 'Close',
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('zh-CN');
  const [mounted, setMounted] = useState(false);

  // 初始化语言
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored && (stored === 'zh-CN' || stored === 'en')) {
      setLanguageState(stored);
    }
    setMounted(true);
  }, []);

  // 更新 document lang 属性
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.lang = language;
    localStorage.setItem(STORAGE_KEY, language);
  }, [language, mounted]);

  const setLanguage = useCallback((newLanguage: Language) => {
    setLanguageState(newLanguage);
    localStorage.setItem(STORAGE_KEY, newLanguage);
  }, []);

  // 翻译函数
  const t = useCallback((key: string): string => {
    return translations[language][key] || key;
  }, [language]);

  // 始终提供 Context，防止在未挂载时使用 useLanguage 报错
  const value = { language, setLanguage, t };

  return (
    <LanguageContext.Provider value={value}>
      {mounted ? children : <>{children}</>}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
