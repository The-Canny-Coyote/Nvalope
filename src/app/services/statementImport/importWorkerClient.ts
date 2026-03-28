import type { CsvColumnMapping, ParsedStatementFile } from '@/app/services/statementImport/types';
import type { ImportWorkerOutboundMessage } from '@/app/workers/importWorkerProtocol';

export interface RunStatementParseOptions {
  fileBuffer: ArrayBuffer;
  format: string;
  fileName: string;
  csvMapping?: CsvColumnMapping;
  onProgress?: (pct: number, stage: string) => void;
}

/**
 * Run statement parsing in a dedicated worker (PDF + text formats). Transfers buffer to worker.
 */
export function runStatementParseInWorker(options: RunStatementParseOptions): Promise<ParsedStatementFile> {
  const { fileBuffer, format, fileName, csvMapping, onProgress } = options;
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../../workers/importWorker.ts', import.meta.url), { type: 'module' });
    const onMessage = (e: MessageEvent<ImportWorkerOutboundMessage>) => {
      const msg = e.data;
      if (msg.type === 'PARSE_PROGRESS') {
        onProgress?.(msg.payload.pct, msg.payload.stage);
        return;
      }
      if (msg.type === 'PARSE_RESULT') {
        worker.removeEventListener('message', onMessage);
        worker.terminate();
        resolve(msg.payload.parsed);
        return;
      }
      if (msg.type === 'PARSE_ERROR') {
        worker.removeEventListener('message', onMessage);
        worker.terminate();
        reject(new Error(msg.payload.message));
      }
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', () => {
      worker.removeEventListener('message', onMessage);
      worker.terminate();
      reject(new Error('Import worker failed to start.'));
    });
    worker.postMessage(
      {
        type: 'PARSE_FILE',
        payload: { fileBuffer, format, fileName, csvMapping },
      },
      [fileBuffer]
    );
  });
}
