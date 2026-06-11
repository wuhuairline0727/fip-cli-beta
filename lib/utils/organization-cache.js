/**
 * 组织机构缓存管理
 * 用于记录和查询组织机构/项目/部门信息，避免重复点击下拉框
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CACHE_FILE = path.join(os.homedir(), '.fip-orgs.json');
const MAX_CACHE_SIZE = 500; // 最多缓存500条记录

/**
 * 加载缓存
 * @returns {Object} 缓存对象
 */
function loadCache() {
  try {
    const data = fs.readFileSync(CACHE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return {
      version: 1,
      organizations: [],
      lastUpdated: null,
    };
  }
}

/**
 * 保存缓存
 * @param {Object} cache
 */
function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (e) {
    // 忽略写入错误
  }
}

/**
 * 生成记录的唯一标识
 * @param {Object} record
 * @returns {string}
 */
function makeRecordKey(record) {
  return [
    record.organization || '',
    record.project || '',
    record.department || '',
  ].join('|');
}

/**
 * 添加组织机构记录到缓存
 * @param {Object} record - {organization, project, department, plateCode, plateName, profitCenter}
 * @returns {boolean} 是否为新记录
 */
function addOrganizationRecord(record) {
  const cache = loadCache();
  const key = makeRecordKey(record);

  const exists = cache.organizations.find((o) => makeRecordKey(o) === key);
  if (exists) {
    // 更新已有记录的时间戳
    exists.lastUsedAt = new Date().toISOString();
    exists.useCount = (exists.useCount || 0) + 1;
    saveCache(cache);
    return false;
  }

  // 添加新记录
  cache.organizations.push({
    organization: record.organization || '',
    project: record.project || '',
    department: record.department || '',
    plateCode: record.plateCode || '',
    plateName: record.plateName || '',
    profitCenter: record.profitCenter || '',
    recordedAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    useCount: 1,
  });

  // 限制缓存大小，保留最近使用的
  if (cache.organizations.length > MAX_CACHE_SIZE) {
    cache.organizations.sort((a, b) => {
      const countDiff = (b.useCount || 0) - (a.useCount || 0);
      if (countDiff !== 0) return countDiff;
      return new Date(b.lastUsedAt) - new Date(a.lastUsedAt);
    });
    cache.organizations = cache.organizations.slice(0, MAX_CACHE_SIZE);
  }

  cache.lastUpdated = new Date().toISOString();
  saveCache(cache);
  return true;
}

/**
 * 从缓存查找组织机构记录
 * @param {Object} query - 查询条件 {organization?, project?, department?}
 * @returns {Array} 匹配的记录列表
 */
function findOrganization(query = {}) {
  const cache = loadCache();
  if (!cache.organizations.length) return [];

  return cache.organizations.filter((record) => {
    return Object.entries(query).every(([key, value]) => {
      if (!value || value.trim() === '') return true;
      const recordValue = (record[key] || '').toLowerCase();
      const queryValue = value.toLowerCase();
      // 支持部分匹配
      return recordValue.includes(queryValue);
    });
  });
}

/**
 * 获取缓存统计信息
 * @returns {Object}
 */
function getCacheStats() {
  const cache = loadCache();
  return {
    totalRecords: cache.organizations.length,
    lastUpdated: cache.lastUpdated,
    uniqueOrganizations: [
      ...new Set(
        cache.organizations.map((o) => o.organization).filter(Boolean)
      ),
    ],
  };
}

/**
 * 清空缓存
 */
function clearCache() {
  saveCache({
    version: 1,
    organizations: [],
    lastUpdated: new Date().toISOString(),
  });
}

/**
 * 列出所有缓存记录（用于显示）
 * @returns {Array}
 */
function listAllRecords() {
  const cache = loadCache();
  return cache.organizations.map((record, index) => ({
    index: index + 1,
    organization: record.organization,
    project: record.project,
    department: record.department,
    plateCode: record.plateCode,
    plateName: record.plateName,
    profitCenter: record.profitCenter,
    useCount: record.useCount || 0,
    lastUsedAt: record.lastUsedAt,
  }));
}

module.exports = {
  loadCache,
  saveCache,
  addOrganizationRecord,
  findOrganization,
  getCacheStats,
  clearCache,
  listAllRecords,
  CACHE_FILE,
};
