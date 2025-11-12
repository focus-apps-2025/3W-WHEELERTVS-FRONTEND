export const darkModeClasses = {
  bg: {
    primary: 'bg-white dark:bg-gray-900',
    secondary: 'bg-gray-50 dark:bg-gray-800',
    tertiary: 'bg-gray-100 dark:bg-gray-700',
    card: 'bg-white dark:bg-gray-900',
    hover: 'hover:bg-gray-50 dark:hover:bg-gray-800',
    active: 'bg-primary-50 dark:bg-primary-900/20',
  },
  text: {
    primary: 'text-gray-900 dark:text-gray-100',
    secondary: 'text-gray-600 dark:text-gray-400',
    tertiary: 'text-gray-500 dark:text-gray-500',
    heading: 'text-gray-900 dark:text-gray-100',
    muted: 'text-gray-500 dark:text-gray-400',
    link: 'text-primary-600 dark:text-primary-400',
  },
  border: {
    default: 'border-gray-200 dark:border-gray-700',
    light: 'border-gray-100 dark:border-gray-800',
    focus: 'focus:border-primary-500 dark:focus:border-primary-400',
  },
  button: {
    primary: 'bg-primary-600 dark:bg-primary-500 text-white hover:bg-primary-700 dark:hover:bg-primary-400',
    secondary: 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-300 border border-primary-600 dark:border-primary-400 hover:bg-primary-50 dark:hover:bg-gray-700',
    ghost: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
    danger: 'bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-400',
  },
  input: {
    default: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 placeholder-gray-400 dark:placeholder-gray-500',
    focus: 'focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400',
  },
  table: {
    header: 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
    row: 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800',
    cell: 'text-gray-900 dark:text-gray-100',
  },
  badge: {
    success: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    error: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  },
};

export const getDarkModeClass = (category: keyof typeof darkModeClasses, variant: string) => {
  const categoryClasses = darkModeClasses[category] as Record<string, string>;
  return categoryClasses[variant] || '';
};
