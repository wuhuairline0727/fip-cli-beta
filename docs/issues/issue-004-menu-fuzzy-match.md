## 问题描述

`lib/utils/navigation.js` 第 20 行使用 `indexOf` 进行菜单模糊匹配：

```javascript
var target = items.find(function(item) {
  return item.textContent.trim().indexOf('${menuName}') !== -1;
});
```

**问题**：
- 用户传 `"税务系统"`，会同时匹配 `"税务系统"`、`"税务系统管理员"`、`"税务系统配置"` 等
- 用户传 `"未开票收入"`，会同时匹配 `"未开票收入台账"` 和 `"未开票收入汇总"`
- 匹配结果不可预测，取决于 DOM 遍历顺序

## 实际风险

在 FIP 平台中，侧边菜单存在同名/相似菜单项（如不同模块下的"查询"、"导出"），模糊匹配可能导致：
- 打开错误的菜单页面
- 后续操作在错误页面上执行，产生不可预期的结果

## 修复方向

**方案 A**：改用完全相等 `===`
```javascript
return item.textContent.trim() === '${menuName}';
```

**方案 B**：要求精确包含边界（前后是标签结束符或空白）
```javascript
var text = item.textContent.trim();
return text === '${menuName}' || text.startsWith('${menuName} ') || text.endsWith(' ${menuName}');
```

**兼容性考虑**：
- 需要检查现有调用方是否依赖模糊匹配（如 `"税务系统"` 匹配 `"税务系统管理"`）
- 如果存在依赖，可先改为 `startsWith` 作为过渡

## 影响范围

- `openSideMenu(menuName)` — 侧边菜单打开
- `clickDrawerItem(itemName)` — Drawer 子菜单点击（第 66 行同样使用 `indexOf`）

---

**标签**: `bug`, `P0`, `navigation`, `gwt`
**文件**: `lib/utils/navigation.js:20`, `lib/utils/navigation.js:66`
