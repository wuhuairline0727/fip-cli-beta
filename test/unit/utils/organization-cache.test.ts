import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 使用临时缓存文件进行测试
const TEST_CACHE_FILE = path.join(os.tmpdir(), '.fip-orgs-test.json');

// 加载模块并注入临时缓存文件路径
const {
  loadCache,
  saveCache,
  addOrganizationRecord,
  findOrganization,
  getCacheStats,
  clearCache,
  listAllRecords,
  setCacheFile,
} = require('../../../lib/utils/organization-cache');

// 注入临时缓存文件路径
setCacheFile(TEST_CACHE_FILE);

describe('utils/organization-cache', () => {
  beforeEach(() => {
    // 清空测试缓存
    clearCache();
  });

  after(() => {
    // 清理测试文件
    try {
      fs.unlinkSync(TEST_CACHE_FILE);
    } catch (e) {
      // 忽略清理错误
    }
  });

  describe('loadCache() / saveCache()', () => {
    it('should return default cache when file does not exist', () => {
      // 先删除测试缓存文件
      try {
        fs.unlinkSync(TEST_CACHE_FILE);
      } catch (e) {
        // 文件可能不存在
      }
      const cache = loadCache();
      expect(cache).to.be.an('object');
      expect(cache.version).to.equal(1);
      expect(cache.organizations).to.be.an('array').that.is.empty;
      expect(cache.lastUpdated).to.be.null;
    });

    it('should save and load cache correctly', () => {
      const testCache = {
        version: 1,
        organizations: [{ organization: '测试公司', project: '测试项目' }],
        lastUpdated: '2026-01-01T00:00:00Z',
      };
      saveCache(testCache);
      const loaded = loadCache();
      expect(loaded.organizations).to.have.lengthOf(1);
      expect(loaded.organizations[0].organization).to.equal('测试公司');
    });
  });

  describe('addOrganizationRecord()', () => {
    it('should add a new record', () => {
      const isNew = addOrganizationRecord({
        organization: '中建一局',
        project: '某项目',
        department: '财务部',
        plateCode: '0101',
        plateName: '住宅',
        profitCenter: '某项目',
      });
      expect(isNew).to.be.true;

      const stats = getCacheStats();
      expect(stats.totalRecords).to.equal(1);
    });

    it('should not add duplicate record', () => {
      const record = {
        organization: '中建一局',
        project: '某项目',
        department: '财务部',
      };
      addOrganizationRecord(record);
      const isNew = addOrganizationRecord(record);
      expect(isNew).to.be.false;

      const stats = getCacheStats();
      expect(stats.totalRecords).to.equal(1);
    });

    it('should update useCount for existing record', () => {
      const record = {
        organization: '中建一局',
        project: '某项目',
        department: '财务部',
      };
      addOrganizationRecord(record);
      addOrganizationRecord(record);

      const records = listAllRecords();
      expect(records[0].useCount).to.equal(2);
    });
  });

  describe('findOrganization()', () => {
    beforeEach(() => {
      addOrganizationRecord({
        organization: '中建一局总部',
        project: '总部项目A',
        department: '财务部',
      });
      addOrganizationRecord({
        organization: '中建一局山东分公司',
        project: '山东项目B',
        department: '工程部',
      });
      addOrganizationRecord({
        organization: '中建二局',
        project: '二局项目',
        department: '技术部',
      });
    });

    it('should find by organization name', () => {
      const matches = findOrganization({ organization: '中建一局' });
      expect(matches).to.have.lengthOf(2);
    });

    it('should find by project name', () => {
      const matches = findOrganization({ project: '项目B' });
      expect(matches).to.have.lengthOf(1);
      expect(matches[0].organization).to.equal('中建一局山东分公司');
    });

    it('should find by department name', () => {
      const matches = findOrganization({ department: '财务部' });
      expect(matches).to.have.lengthOf(1);
    });

    it('should support combined query', () => {
      const matches = findOrganization({
        organization: '中建一局',
        department: '工程部',
      });
      expect(matches).to.have.lengthOf(1);
      expect(matches[0].project).to.equal('山东项目B');
    });

    it('should return empty array for no match', () => {
      const matches = findOrganization({ organization: '不存在' });
      expect(matches).to.be.an('array').that.is.empty;
    });

    it('should return all records for empty query', () => {
      const matches = findOrganization({});
      expect(matches).to.have.lengthOf(3);
    });
  });

  describe('getCacheStats()', () => {
    it('should return correct stats', () => {
      addOrganizationRecord({
        organization: '公司A',
        project: '项目1',
        department: '部门1',
      });
      addOrganizationRecord({
        organization: '公司B',
        project: '项目2',
        department: '部门2',
      });

      const stats = getCacheStats();
      expect(stats.totalRecords).to.equal(2);
      expect(stats.uniqueOrganizations).to.include('公司A');
      expect(stats.uniqueOrganizations).to.include('公司B');
      expect(stats.lastUpdated).to.be.a('string');
    });
  });

  describe('listAllRecords()', () => {
    it('should list all records with index', () => {
      addOrganizationRecord({
        organization: '公司A',
        project: '项目1',
        department: '部门1',
      });

      const records = listAllRecords();
      expect(records).to.have.lengthOf(1);
      expect(records[0].index).to.equal(1);
      expect(records[0].organization).to.equal('公司A');
      expect(records[0]).to.have.property('useCount');
      expect(records[0]).to.have.property('lastUsedAt');
    });
  });

  describe('clearCache()', () => {
    it('should clear all records', () => {
      addOrganizationRecord({
        organization: '公司A',
        project: '项目1',
        department: '部门1',
      });
      clearCache();

      const stats = getCacheStats();
      expect(stats.totalRecords).to.equal(0);
    });
  });
});
