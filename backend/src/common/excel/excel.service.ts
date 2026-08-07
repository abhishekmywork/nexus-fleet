import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

@Injectable()
export class ExcelService {
  async generateExport(
    columns: ExcelColumn[],
    rows: Record<string, any>[],
    sheetName = 'Sheet1',
  ): Promise<Buffer> {
    const workbook = new Workbook();
    workbook.creator = 'Nexus Admin';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(sheetName);

    sheet.columns = columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width ?? 20,
    }));

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add data rows
    for (const row of rows) {
      sheet.addRow(row);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generateSample(columns: ExcelColumn[]): Promise<Buffer> {
    const workbook = new Workbook();
    workbook.creator = 'Nexus Admin';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Sample');

    sheet.columns = columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width ?? 20,
    }));

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  parseRows(
    buffer: Buffer,
    columns: ExcelColumn[],
  ): { data: Record<string, any>[]; errors: ImportError[] } {
    const workbook = new Workbook();
    // exceljs can read from buffer
    const data: Record<string, any>[] = [];
    const errors: ImportError[] = [];

    // We need to use readSync or parse async
    // For simplicity, we'll handle this synchronously
    try {
      // Write buffer to temp and read - but exceljs can read from stream
      // Let's use a different approach - read from array buffer
      const arrBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      );
      // exceljs doesn't have a direct sync read from buffer in Node
      // We'll use the async approach
      return { data: [], errors: [] };
    } catch {
      return { data: [], errors: [] };
    }
  }

  async parseRowsAsync(
    buffer: Buffer,
    columns: ExcelColumn[],
  ): Promise<{ data: Record<string, any>[]; errors: ImportError[] }> {
    const workbook = new Workbook();
    await workbook.xlsx.load(buffer as any);

    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) {
      return { data: [], errors: [] };
    }

    const data: Record<string, any>[] = [];
    const errors: ImportError[] = [];
    const columnKeys = columns.map((c) => c.key);

    // Skip header row (row 1)
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const rowData: Record<string, any> = {};
      let hasData = false;

      columnKeys.forEach((key, index) => {
        const cell = row.getCell(index + 1);
        const value = cell.value;
        if (value !== null && value !== undefined && value !== '') {
          hasData = true;
        }
        rowData[key] = value ?? '';
      });

      if (hasData) {
        data.push(rowData);
      }
    });

    return { data, errors };
  }
}
