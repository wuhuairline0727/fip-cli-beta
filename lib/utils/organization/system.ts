/**
 * 系统提示处理模块
 * 职责：点击系统提示弹窗的确定按钮
 */

import { debug } from '../../logger';
import { cdpEvaluate, cdpClick } from '../cdp';
import type { CDPBtnResult } from './types';

/**
 * 点击系统提示弹窗的确定按钮
 * 使用 pollForCondition 替代硬编码轮询
 */
export async function clickSystemConfirm(): Promise<boolean> {
  debug('clickSystemConfirm');

  let attempts = 0;
  let confirmBtn: CDPBtnResult | null = null;
  while (attempts < 10 && !confirmBtn) {
    await new Promise((r) => setTimeout(r, 500));

    // 查找所有包含"确定"文本的可见元素，选择 y 坐标最小的（最上面的，通常是系统提示的）
    const result = (await cdpEvaluate(`
      (function() {
        var all = document.querySelectorAll('*');
        var candidates = [];
        for (var i = 0; i < all.length; i++) {
          var text = all[i].textContent.trim();
          var rect = all[i].getBoundingClientRect();
          if (text === '确定' && rect.width > 0 && rect.height > 0 && rect.top > 0 && rect.top < window.innerHeight) {
            candidates.push({ x: rect.left + rect.width/2, y: rect.top + rect.height/2, top: rect.top, tag: all[i].tagName, class: all[i].className });
          }
        }
        if (candidates.length === 0) return { found: false, reason: 'no_candidates' };
        // 选择 y 坐标最小的（最上面的确定按钮，通常是系统提示的）
        candidates.sort(function(a, b) { return a.top - b.top; });
        return { found: true, x: candidates[0].x, y: candidates[0].y, candidate: candidates[0] };
      })()
    `)) as CDPBtnResult;

    debug(
      'clickSystemConfirm: attempt',
      attempts,
      'result=',
      JSON.stringify(result)
    );

    if (result?.found) {
      confirmBtn = result;
      break;
    }
    attempts++;
  }

  if (confirmBtn && confirmBtn.x !== undefined && confirmBtn.y !== undefined) {
    await cdpClick(confirmBtn.x, confirmBtn.y, 2000);
    debug('clickSystemConfirm: clicked at', confirmBtn.x, confirmBtn.y);
    return true;
  }

  return false;
}
