import type { CsvColumnMapping, ParsedStatementFile } from '@/app/services/statementImport/types';

export type ImportWorkerInboundMessage = {
  type: 'PARSE_FILE';
  payload: {
    fileBuffer: ArrayBuffer;
    format: string;
    fileName: string;
    csvMapping?: CsvColumnMapping;
  };
};

export type ImportWorkerOutboundMessage =
  | { type: 'PARSE_PROGRESS'; payload: { pct: number; stage: string } }
  | { type: 'PARSE_RESULT'; payload: { parsed: ParsedStatementFile } }
  | { type: 'PARSE_ERROR'; payload: { message: string } };
