// FieldAssist CSV Export Utility

export function exportToCsv<T extends Record<string, any>>(
  filename: string,
  rows: T[],
  columns: { header: string; key: keyof T | ((item: T) => any) }[]
) {
  if (!rows || rows.length === 0) {
    alert('No records available to export.');
    return;
  }

  // Header row
  const headerLine = columns.map((col) => `"${col.header.replace(/"/g, '""')}"`).join(',');

  // Value rows
  const dataLines = rows.map((item) =>
    columns
      .map((col) => {
        let val: any;
        if (typeof col.key === 'function') {
          val = col.key(item);
        } else {
          val = item[col.key];
        }

        if (val === null || val === undefined) {
          return '""';
        }
        if (typeof val === 'number') {
          return String(val);
        }
        if (typeof val === 'boolean') {
          return val ? '"Yes"' : '"No"';
        }
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(',')
  );

  const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.download = safeFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
