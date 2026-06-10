const js = require('@eslint/js');
const prettier = require('eslint-config-prettier');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      // 代码中包含大量通过 CDP 发送到浏览器执行的动态脚本字符串，
      // 字符串中的反斜杠转义在 ESLint 静态分析中被误判为无用转义，
      // 实际在浏览器端执行时这些转义是必需的，故关闭此规则。
      'no-useless-escape': 'off',
      // 现有代码中 Promise executor 使用 async 函数，
      // 虽为反模式但不影响当前功能，暂不重构业务逻辑。
      'no-async-promise-executor': 'off',
    },
  },
  prettier,
];
