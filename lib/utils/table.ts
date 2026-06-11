import { evaluate } from '../browser';

export interface TableDataOptions {
  maxRows?: number;
  includeHeaders?: boolean;
}

export interface TableDataResult {
  rowCount: number;
  data: string[][];
  headers: string[] | null;
  tableCount: number;
  error?: string;
}

export async function getTableData(options: TableDataOptions = {}): Promise<TableDataResult | { error: string }> {
  let { maxRows = 1000, includeHeaders = true } = options;
  maxRows = parseInt(String(maxRows)) || 1000;
  includeHeaders = includeHeaders !== false;

  const result = await evaluate(`
    (function() {
      var includeHeaders = ${includeHeaders};
      var maxRows = ${maxRows};

      var tables = document.querySelectorAll('table');
      var visibleTables = [];
      for (var i = 0; i < tables.length; i++) {
        var rect = tables[i].getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.left > 0 && rect.top > 100) {
          visibleTables.push({
            table: tables[i],
            top: rect.top,
            rows: tables[i].querySelectorAll('tr').length
          });
        }
      }

      if (visibleTables.length === 0) return { error: 'no visible table found' };

      visibleTables.sort(function(a, b) { return a.top - b.top; });

      var allRows = [];
      for (var t = 0; t < visibleTables.length; t++) {
        var rows = visibleTables[t].table.querySelectorAll('tr');
        for (var r = 0; r < rows.length; r++) {
          allRows.push(rows[r]);
        }
      }

      var data = [];
      var startIdx = includeHeaders ? 0 : 1;

      for (var r = startIdx; r < Math.min(allRows.length, maxRows + 1); r++) {
        var cells = allRows[r].querySelectorAll('td, th');
        var rowData = [];
        for (var c = 0; c < cells.length; c++) {
          rowData.push(cells[c].textContent.trim());
        }
        if (rowData.some(function(cell) { return cell !== ''; })) {
          data.push(rowData);
        }
      }

      return {
        rowCount: data.length,
        data: data,
        headers: includeHeaders && data.length > 0 ? data[0] : null,
        tableCount: visibleTables.length
      };
    })()
  `);

  const value = result?.data?.value;
  return value !== undefined ? value : { error: 'evaluation failed' };
}
