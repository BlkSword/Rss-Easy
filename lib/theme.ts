/**
 * Ant Design 主题配置
 * 书签风格 - 温暖、亲切、有温度
 */
import { theme } from 'antd';
import type { ThemeConfig } from 'antd';

export const antdTheme: ThemeConfig = {
  token: {
    // 主色：温暖的橙红色（像书签）
    colorPrimary: '#F97316',
    colorSuccess: '#10B981',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    colorInfo: '#3B82F6',

    // 字体 - 更圆润
    fontSize: 14,
    fontSizeHeading1: 28,
    fontSizeHeading2: 24,
    fontSizeHeading3: 20,
    fontSizeHeading4: 18,
    fontFamily: 'system-ui, -apple-system, sans-serif',

    // 圆角 - 更圆润
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    borderRadiusXS: 6,

    // 间距
    marginXS: 8,
    marginSM: 12,
    margin: 16,
    marginMD: 20,
    marginLG: 24,
    marginXL: 32,

    // 动画 - 更柔和
    motionDurationSlow: '0.3s',
  },
  components: {
    // Button - 书签风格按钮
    Button: {
      colorPrimary: '#F97316',
      colorPrimaryHover: '#EA580C',
      colorPrimaryActive: '#C2410C',
      colorPrimaryBg: '#FFF7ED',
      colorPrimaryBgHover: '#FFEDD5',
      primaryShadow: '0 2px 8px rgba(249, 115, 22, 0.25)',
      defaultShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
      defaultBg: '#FEF3C7',
      paddingContentHorizontal: 20,
      paddingContentVertical: 10,
      fontWeight: 500,
      borderRadius: 10,
    },

    // Card - 柔和的卡片
    Card: {
      colorBgElevated: '#FFFBF7',
      colorBorderSecondary: '#FEE6CC',
      borderRadiusLG: 16,
      boxShadowTertiary: '0 2px 8px rgba(0, 0, 0, 0.04)',
      boxShadow: '0 4px 12px rgba(249, 115, 22, 0.08)',
    },

    // Input - 温暖的输入框
    Input: {
      colorBgContainer: '#FFFBF7',
      colorBgContainerDisabled: '#FEE6CC',
      colorBorder: '#FEE6CC',
      borderRadius: 10,
      paddingSM: 8,
      paddingLG: 12,
      activeBorderColor: '#F97316',
      hoverBorderColor: '#F97316',
    },

    // Modal - 温暖的弹窗
    Modal: {
      contentBg: '#FFFBF7',
      headerBg: '#FFFBF7',
      colorBgMask: 'rgba(0, 0, 0, 0.4)',
      borderRadiusLG: 16,
    },

    // Select - 下拉选择
    Select: {
      colorBgElevated: '#FFFBF7',
      optionSelectedBg: '#FFF7ED',
      optionActiveBg: '#FEE6CC',
      borderRadius: 10,
    },

    // Notification - 温暖的通知
    Notification: {
      colorBgElevated: '#FFFBF7',
      colorText: '#1F2937',
      colorInfo: '#3B82F6',
      colorInfoBg: '#EFF6FF',
      colorInfoBorder: '#BFDBFE',
      colorSuccess: '#10B981',
      colorSuccessBg: '#ECFDF5',
      colorSuccessBorder: '#A7F3D0',
      colorWarning: '#F97316',
      colorWarningBg: '#FFF7ED',
      colorWarningBorder: '#FED7AA',
      colorError: '#EF4444',
      colorErrorBg: '#FEF2F2',
      colorErrorBorder: '#FECACA',
      borderRadiusLG: 12,
      boxShadow: '0 4px 16px rgba(249, 115, 22, 0.12)',
    },

    // Switch - 开关
    Switch: {
      colorPrimary: '#F97316',
      colorPrimaryHover: '#EA580C',
    },

    // Tag - 标签
    Tag: {
      borderRadiusSM: 8,
      defaultBg: '#FEE6CC',
      defaultColor: '#78350F',
    },

    // Segmented - 分段控制器
    Segmented: {
      itemSelectedBg: '#F97316',
      itemSelectedColor: '#FFFFFF',
      borderRadius: 10,
    },

    // Tabs - 标签页
    Tabs: {
      itemActiveColor: '#F97316',
      itemSelectedColor: '#F97316',
      inkBarColor: '#F97316',
    },

    // Checkbox - 复选框
    Checkbox: {
      colorPrimary: '#F97316',
      colorPrimaryHover: '#EA580C',
      borderRadiusSM: 6,
    },

    // Radio - 单选框
    Radio: {
      colorPrimary: '#F97316',
      colorPrimaryHover: '#EA580C',
      borderRadiusSM: 6,
    },
  },
  algorithm: theme.defaultAlgorithm,
};
