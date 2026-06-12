import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const CACHE_FILE: string = path.join(os.homedir(), '.fip-orgs.json');
const MAX_CACHE_SIZE = 500;

// 用于测试的注入点
let _cacheFileOverride: string | null = null;

export function setCacheFile(filePath: string): void {
  _cacheFileOverride = filePath;
}

export function getCacheFile(): string {
  return _cacheFileOverride || CACHE_FILE;
}

export interface OrganizationRecord {
  organization: string;
  project: string;
  department: string;
  plateCode?: string;
  plateName?: string;
  profitCenter?: string;
  recordedAt?: string;
  lastUsedAt?: string;
  useCount?: number;
}

export interface CacheData {
  version: number;
  organizations: OrganizationRecord[];
  lastUpdated: string | null;
}

export function loadCache(): CacheData {
  try {
    const data = fs.readFileSync(getCacheFile(), 'utf8');
    return JSON.parse(data) as CacheData;
  } catch (_e) {
    return {
      version: 1,
      organizations: [],
      lastUpdated: null,
    };
  }
}

export function saveCache(cache: CacheData): void {
  try {
    fs.writeFileSync(getCacheFile(), JSON.stringify(cache, null, 2), 'utf8');
  } catch (_e) {
    // 忽略写入错误
  }
}

function makeRecordKey(record: OrganizationRecord): string {
  return [
    record.organization || '',
    record.project || '',
    record.department || '',
  ].join('|');
}

export function addOrganizationRecord(record: OrganizationRecord): boolean {
  const cache = loadCache();
  const key = makeRecordKey(record);

  const exists = cache.organizations.find((o) => makeRecordKey(o) === key);
  if (exists) {
    exists.lastUsedAt = new Date().toISOString();
    exists.useCount = (exists.useCount || 0) + 1;
    saveCache(cache);
    return false;
  }

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

  if (cache.organizations.length > MAX_CACHE_SIZE) {
    cache.organizations.sort((a, b) => {
      const countDiff = (b.useCount || 0) - (a.useCount || 0);
      if (countDiff !== 0) return countDiff;
      return (
        new Date(b.lastUsedAt || 0).getTime() -
        new Date(a.lastUsedAt || 0).getTime()
      );
    });
    cache.organizations = cache.organizations.slice(0, MAX_CACHE_SIZE);
  }

  cache.lastUpdated = new Date().toISOString();
  saveCache(cache);
  return true;
}

export function findOrganization(
  query: Partial<OrganizationRecord> = {}
): OrganizationRecord[] {
  const cache = loadCache();
  if (!cache.organizations.length) return [];

  return cache.organizations.filter((record) => {
    return Object.entries(query).every(([key, value]) => {
      if (!value || (typeof value === 'string' && value.trim() === ''))
        return true;
      const recordValue = (record[key as keyof OrganizationRecord] || '')
        .toString()
        .toLowerCase();
      const queryValue = value.toString().toLowerCase();
      return recordValue.includes(queryValue);
    });
  });
}

export interface CacheStats {
  totalRecords: number;
  lastUpdated: string | null;
  uniqueOrganizations: string[];
}

export function getCacheStats(): CacheStats {
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

export function clearCache(): void {
  saveCache({
    version: 1,
    organizations: [],
    lastUpdated: new Date().toISOString(),
  });
}

export function listAllRecords(): Array<
  OrganizationRecord & { index: number }
> {
  const cache = loadCache();
  return cache.organizations.map((record, index) => ({
    index: index + 1,
    ...record,
  }));
}
