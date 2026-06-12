import * as fs from 'fs';
import * as path from 'path';
import { evaluate } from '../browser';
import { sleep } from './common';
import { cdpClick } from './cdp';

export interface AttachmentOptions {
  downloadDir?: string;
}

export interface AttachmentInfo {
  name: string;
  size: string;
  uploader: string;
  uploadTime: string;
  rowIndex: number;
}

export interface ListAttachmentsResult {
  attachmentCount: number;
  attachments: AttachmentInfo[];
  downloadDir: string;
}

export async function listAttachments(options: AttachmentOptions = {}): Promise<ListAttachmentsResult> {
  const { downloadDir = './downloads' } = options;

  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const attachBtn = await evaluate(`
    (function() {
      var all = document.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        var text = all[i].textContent.trim();
        if (text === '附件' || text.startsWith('附件')) {
          var rect = all[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
          }
        }
      }
      return { found: false };
    })()
  `);

  const btnVal = attachBtn?.data?.value;
  if (!btnVal?.found) {
    throw new Error('Attachment button not found');
  }

  await cdpClick(btnVal.x, btnVal.y);
  await sleep(2000);

  const attachments = await evaluate(`
    (function() {
      var result = [];
      var popups = document.querySelectorAll('.FD26IYC-a-g, .gwt-DialogBox, [class*=DialogBox]');
      var visiblePopup = null;
      for (var i = 0; i < popups.length; i++) {
        var rect = popups[i].getBoundingClientRect();
        if (rect.left > 0 && rect.width > 0) {
          visiblePopup = popups[i];
          break;
        }
      }
      if (!visiblePopup) return result;

      var rows = visiblePopup.querySelectorAll('tr');
      for (var i = 0; i < rows.length; i++) {
        var cells = rows[i].querySelectorAll('td');
        if (cells.length === 7) {
          var rect = rows[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            var name = cells[1] ? cells[1].textContent.trim() : '';
            var size = cells[2] ? cells[2].textContent.trim() : '';
            if (name === '名称' || size === '文件大小') continue;
            result.push({
              name: name,
              size: size,
              uploader: cells[3] ? cells[3].textContent.trim() : '',
              uploadTime: cells[4] ? cells[4].textContent.trim() : '',
              rowIndex: i
            });
          }
        }
      }
      return result;
    })()
  `);

  const attVal = attachments?.data?.value || [];

  return {
    attachmentCount: attVal.length,
    attachments: attVal,
    downloadDir,
  };
}

export interface DownloadOptions extends AttachmentOptions {
  chromeDownloadDir?: string;
}

export interface DownloadedFile {
  name: string;
  moved: boolean;
  path?: string;
  error?: string;
}

export interface DownloadResult {
  downloaded: number;
  total: number;
  files: DownloadedFile[];
  downloadDir: string;
}

export async function downloadAttachments(options: DownloadOptions = {}): Promise<DownloadResult> {
  const defaultChromeDir = fs.existsSync('D:/下载')
    ? 'D:/下载'
    : path.join(require('os').homedir(), 'Downloads');
  const { downloadDir = './downloads', chromeDownloadDir = defaultChromeDir } = options;

  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const attachBtn = await evaluate(`
    (function() {
      var all = document.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        var text = all[i].textContent.trim();
        if (text === '附件' || text.startsWith('附件')) {
          var rect = all[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
          }
        }
      }
      return { found: false };
    })()
  `);

  const btnVal = attachBtn?.data?.value;
  if (!btnVal?.found) {
    throw new Error('Attachment button not found');
  }

  await cdpClick(btnVal.x, btnVal.y);
  await sleep(2000);

  const attachmentRows = await evaluate(`
    (function() {
      var popups = document.querySelectorAll('.FD26IYC-a-g, .gwt-DialogBox, [class*=DialogBox]');
      var visiblePopup = null;
      for (var i = 0; i < popups.length; i++) {
        var rect = popups[i].getBoundingClientRect();
        if (rect.left > 0 && rect.width > 0) {
          visiblePopup = popups[i];
          break;
        }
      }
      if (!visiblePopup) return [];

      var rows = visiblePopup.querySelectorAll('tr');
      var result = [];
      for (var i = 0; i < rows.length; i++) {
        var cells = rows[i].querySelectorAll('td');
        if (cells.length === 7) {
          var rect = rows[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            var name = cells[1] ? cells[1].textContent.trim() : '';
            var size = cells[2] ? cells[2].textContent.trim() : '';
            if (name !== '名称' && size !== '文件大小') {
              result.push({ name: name, rowIndex: i, x: rect.left + rect.width/2, y: rect.top + rect.height/2 });
            }
          }
        }
      }
      return result;
    })()
  `);

  const rows = attachmentRows?.data?.value || [];
  if (rows.length === 0) {
    await closeAttachmentPopup();
    return { downloaded: 0, total: 0, files: [], downloadDir };
  }

  const downloadedFiles: DownloadedFile[] = [];
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    if (!row.name) continue;

    const selectResult = await evaluate(`
      (function() {
        var popups = document.querySelectorAll('.FD26IYC-a-g, .gwt-DialogBox, [class*=DialogBox]');
        var visiblePopup = null;
        for (var i = 0; i < popups.length; i++) {
          var rect = popups[i].getBoundingClientRect();
          if (rect.left > 0 && rect.width > 0) {
            visiblePopup = popups[i];
            break;
          }
        }
        if (!visiblePopup) return { found: false };

        var rows = visiblePopup.querySelectorAll('tr');
        var dataRows = [];
        for (var i = 0; i < rows.length; i++) {
          var cells = rows[i].querySelectorAll('td');
          if (cells.length === 7) {
            var rect = rows[i].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              var name = cells[1] ? cells[1].textContent.trim() : '';
              var size = cells[2] ? cells[2].textContent.trim() : '';
              if (name !== '名称' && size !== '文件大小') {
                dataRows.push({ index: i, element: rows[i] });
              }
            }
          }
        }

        var targetRow = dataRows[${idx}];
        if (!targetRow) return { found: false };

        targetRow.element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        targetRow.element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        targetRow.element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return { found: true, name: targetRow.element.textContent.trim().substring(0, 30) };
      })()
    `);
    await sleep(500);

    const downloadBtn = await evaluate(`
      (function() {
        var popups = document.querySelectorAll('.FD26IYC-a-g, .gwt-DialogBox, [class*=DialogBox]');
        var visiblePopup = null;
        for (var i = 0; i < popups.length; i++) {
          var rect = popups[i].getBoundingClientRect();
          if (rect.left > 0 && rect.width > 0) {
            visiblePopup = popups[i];
            break;
          }
        }
        if (!visiblePopup) return { found: false };

        var all = visiblePopup.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
          if (all[i].textContent.trim() === '下载') {
            var rect = all[i].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.top < 350) {
              return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
            }
          }
        }
        return { found: false };
      })()
    `);

    const btn = downloadBtn?.data?.value;
    if (btn?.found) {
      await cdpClick(btn.x, btn.y);
      await sleep(1000);

      const fileName = await waitForDownload(chromeDownloadDir, row.name, 60000);
      if (fileName) {
        const srcPath = path.join(chromeDownloadDir, fileName);
        const destPath = path.join(downloadDir, fileName);
        try {
          fs.renameSync(srcPath, destPath);
          downloadedFiles.push({ name: fileName, moved: true, path: destPath });
        } catch (e: any) {
          downloadedFiles.push({ name: fileName, moved: false, error: e.message });
        }
      } else {
        downloadedFiles.push({ name: row.name, moved: false, error: 'timeout' });
      }
    }
  }

  await closeAttachmentPopup();

  return {
    downloaded: downloadedFiles.filter((f) => f.moved).length,
    total: rows.length,
    files: downloadedFiles,
    downloadDir,
  };
}

export async function closeAttachmentPopup(): Promise<{ closed: boolean; reason?: string; method?: string }> {
  const result = await evaluate(`
    (function() {
      var popups = document.querySelectorAll('.FD26IYC-a-g, .gwt-DialogBox, [class*=DialogBox]');
      var visiblePopup = null;
      for (var i = 0; i < popups.length; i++) {
        var rect = popups[i].getBoundingClientRect();
        if (rect.left > 0 && rect.width > 0) {
          visiblePopup = popups[i];
          break;
        }
      }
      if (!visiblePopup) return { closed: true, reason: 'no_popup' };

      var closeBtn = visiblePopup.querySelector('.FD26IYC-jb-a.FD26IYC-I-a');
      if (closeBtn) {
        closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return { closed: true, method: 'close_button' };
      }

      var all = visiblePopup.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        var rect = all[i].getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.left > 1300 && rect.top < 300) {
          all[i].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          return { closed: true, method: 'fallback' };
        }
      }

      return { closed: false };
    })()
  `);

  await sleep(1000);
  return result?.data?.value || { closed: false };
}

export async function waitForDownload(downloadDir: string, expectedName: string, timeoutMs = 60000): Promise<string | null> {
  const startTime = Date.now();
  const ext = path.extname(expectedName) || '.pdf';
  const baseName = path.basename(expectedName, ext).replace(/\+/g, ' ');

  let lastSize = -1;
  let stableCount = 0;
  let candidateFile: string | null = null;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const files = fs.readdirSync(downloadDir);
      const matchingFiles = files
        .filter((f) => {
          if (f.endsWith('.crdownload')) return false;
          if (!f.endsWith(ext)) return false;
          const normalizedExpected = baseName.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
          const normalizedActual = f.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
          return normalizedActual.includes(normalizedExpected.substring(0, 10));
        })
        .map((f) => ({
          name: f,
          path: path.join(downloadDir, f),
          stat: fs.statSync(path.join(downloadDir, f)),
          mtime: fs.statSync(path.join(downloadDir, f)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (matchingFiles.length > 0) {
        const newest = matchingFiles[0];

        if (newest.stat.size === lastSize) {
          stableCount++;
          if (stableCount >= 2) {
            return newest.name;
          }
        } else {
          lastSize = newest.stat.size;
          stableCount = 0;
          candidateFile = newest.name;
        }
      }
    } catch (e) {
      // Directory might not exist yet
    }

    await sleep(300);
  }

  return null;
}
