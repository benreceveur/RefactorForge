import { Readable, Transform, pipeline } from 'stream';
import { promisify } from 'util';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { logger } from '../utils/logger';
import { AppError, ErrorCode } from '../errors/AppError';

const pipelineAsync = promisify(pipeline);

export interface StreamingOptions {
  chunkSize: number;
  maxConcurrency: number;
  memoryThreshold: number;
  enableGzip: boolean;
  timeout: number;
}

export interface ProcessingStats {
  bytesProcessed: number;
  chunksProcessed: number;
  processingTime: number;
  memoryPeak: number;
  errorsEncountered: number;
  throughputMBps: number;
}

export interface ProcessingResult<T> {
  success: boolean;
  results: T[];
  stats: ProcessingStats;
  errors: Error[];
}

/**
 * High-performance streaming file processor
 * Handles large files with memory efficiency and parallel processing
 */
export class StreamingFileProcessor {
  private options: StreamingOptions;
  private stats: ProcessingStats;

  constructor(options: Partial<StreamingOptions> = {}) {
    this.options = {
      chunkSize: 64 * 1024, // 64KB chunks
      maxConcurrency: 4,
      memoryThreshold: 100 * 1024 * 1024, // 100MB
      enableGzip: false,
      timeout: 30000,
      ...options
    };

    this.stats = {
      bytesProcessed: 0,
      chunksProcessed: 0,
      processingTime: 0,
      memoryPeak: 0,
      errorsEncountered: 0,
      throughputMBps: 0
    };
  }

  /**
   * Process large files using streaming with memory-efficient chunking
   */
  async processLargeFile<T>(
    filePath: string,
    processor: (chunk: Buffer) => Promise<T[]>,
    options: { 
      encoding?: BufferEncoding;
      skipEmptyChunks?: boolean;
      progressCallback?: (progress: number) => void;
    } = {}
  ): Promise<ProcessingResult<T>> {
    const startTime = Date.now();
    const results: T[] = [];
    const errors: Error[] = [];
    let initialMemory = process.memoryUsage().heapUsed;

    try {
      // Get file size for progress tracking
      const fileStats = await fs.stat(filePath);
      const fileSize = fileStats.size;
      
      if (fileSize > this.options.memoryThreshold) {
        logger.info('Processing large file with streaming', {
          filePath,
          fileSize: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
          chunkSize: `${(this.options.chunkSize / 1024).toFixed(2)} KB`
        });
      }

      let bytesRead = 0;
      const concurrentProcessors = new Map<number, Promise<T[]>>();

      // Create readable stream
      const readStream = createReadStream(filePath, {
        highWaterMark: this.options.chunkSize
      });

      // Process chunks with controlled concurrency
      const processChunk = async (chunk: Buffer, chunkIndex: number): Promise<T[]> => {
        try {
          const chunkResults = await processor(chunk);
          this.stats.chunksProcessed++;
          
          // Update memory peak tracking
          const currentMemory = process.memoryUsage().heapUsed;
          if (currentMemory > this.stats.memoryPeak) {
            this.stats.memoryPeak = currentMemory;
          }

          return chunkResults;
        } catch (error) {
          this.stats.errorsEncountered++;
          const processError = new AppError(
            'Chunk processing failed',
            ErrorCode.PROCESSING_ERROR,
            500,
            true,
            { chunkIndex, error: String(error) }
          );
          errors.push(processError);
          return [];
        }
      };

      let chunkIndex = 0;

      // Process stream with backpressure control
      for await (const chunk of readStream) {
        bytesRead += chunk.length;
        this.stats.bytesProcessed += chunk.length;

        // Skip empty chunks if requested
        if (options.skipEmptyChunks && chunk.length === 0) {
          continue;
        }

        // Wait if too many concurrent operations
        while (concurrentProcessors.size >= this.options.maxConcurrency) {
          const completedIndex = await Promise.race(
            Array.from(concurrentProcessors.keys()).map(async (index) => {
              await concurrentProcessors.get(index);
              return index;
            })
          );
          
          const completedResult = await concurrentProcessors.get(completedIndex)!;
          results.push(...completedResult);
          concurrentProcessors.delete(completedIndex);
        }

        // Start processing chunk
        const processingPromise = processChunk(chunk, chunkIndex);
        concurrentProcessors.set(chunkIndex, processingPromise);
        chunkIndex++;

        // Report progress
        if (options.progressCallback && fileSize > 0) {
          const progress = (bytesRead / fileSize) * 100;
          options.progressCallback(Math.min(progress, 100));
        }

        // Memory pressure check
        const currentMemoryUsage = process.memoryUsage().heapUsed;
        if (currentMemoryUsage > this.options.memoryThreshold) {
          logger.warn('High memory usage detected, triggering GC', {
            currentMemory: `${(currentMemoryUsage / 1024 / 1024).toFixed(2)} MB`,
            threshold: `${(this.options.memoryThreshold / 1024 / 1024).toFixed(2)} MB`
          });
          
          if (global.gc) {
            global.gc();
          }
        }
      }

      // Wait for remaining processors to complete
      const remainingResults = await Promise.all(
        Array.from(concurrentProcessors.values())
      );
      
      for (const result of remainingResults) {
        results.push(...result);
      }

      // Calculate final stats
      this.stats.processingTime = Date.now() - startTime;
      this.stats.throughputMBps = (this.stats.bytesProcessed / 1024 / 1024) / (this.stats.processingTime / 1000);

      logger.info('Streaming file processing completed', {
        filePath,
        results: results.length,
        stats: this.stats
      });

      return {
        success: errors.length === 0,
        results,
        stats: { ...this.stats },
        errors
      };

    } catch (error) {
      this.stats.processingTime = Date.now() - startTime;
      this.stats.errorsEncountered++;
      
      const processingError = new AppError(
        'File processing failed',
        ErrorCode.FILE_PROCESSING_ERROR,
        500,
        true,
        { filePath, error: String(error) }
      );

      return {
        success: false,
        results: [],
        stats: { ...this.stats },
        errors: [processingError]
      };
    }
  }

  /**
   * Process multiple files concurrently with streaming
   */
  async processMultipleFiles<T>(
    filePaths: string[],
    processor: (filePath: string, chunk: Buffer) => Promise<T[]>,
    options: {
      maxConcurrentFiles?: number;
      progressCallback?: (fileIndex: number, progress: number) => void;
    } = {}
  ): Promise<Map<string, ProcessingResult<T>>> {
    const { maxConcurrentFiles = 3 } = options;
    const results = new Map<string, ProcessingResult<T>>();
    const processing = new Map<string, Promise<ProcessingResult<T>>>();

    logger.info('Starting concurrent file processing', {
      totalFiles: filePaths.length,
      maxConcurrent: maxConcurrentFiles
    });

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];

      // Wait if too many concurrent files
      while (processing.size >= maxConcurrentFiles) {
        const completed = await Promise.race(
          Array.from(processing.entries()).map(async ([path, promise]) => {
            const result = await promise;
            return { path, result };
          })
        );
        
        results.set(completed.path, completed.result);
        processing.delete(completed.path);
      }

      // Start processing file
      if (!filePath) continue;

      const fileProcessor = async (chunk: Buffer) => 
        processor(filePath, chunk);

      const progressCallback = options.progressCallback 
        ? (progress: number) => options.progressCallback!(i, progress)
        : undefined;

      const processingPromise = this.processLargeFile(
        filePath,
        fileProcessor,
        { progressCallback }
      );

      processing.set(filePath, processingPromise);
    }

    // Wait for remaining files
    const remaining = await Promise.all(
      Array.from(processing.entries()).map(async ([path, promise]) => ({
        path,
        result: await promise
      }))
    );

    for (const { path, result } of remaining) {
      results.set(path, result);
    }

    return results;
  }

  /**
   * Create a transform stream for real-time processing
   */
  createProcessingStream<T>(
    processor: (chunk: Buffer) => Promise<T[]>,
    options: {
      objectMode?: boolean;
      highWaterMark?: number;
    } = {}
  ): Transform {
    const { objectMode = true, highWaterMark = 16 } = options;
    let chunkCounter = 0;

    return new Transform({
      objectMode,
      highWaterMark,
      async transform(chunk: Buffer, encoding, callback) {
        try {
          const chunkIndex = chunkCounter++;
          logger.debug('Processing stream chunk', { chunkIndex, size: chunk.length });

          const results = await processor(chunk);
          
          // Note: Cannot update stats from Transform stream context
          // Stats will be updated in the main processor

          // Emit results
          for (const result of results) {
            this.push(result);
          }

          callback();
        } catch (error) {
          // Note: Cannot update stats from Transform stream context
          callback(new AppError(
            'Stream processing error',
            ErrorCode.STREAM_PROCESSING_ERROR,
            500,
            true,
            { chunk: chunk.length, error: String(error) }
          ));
        }
      }
    });
  }

  /**
   * Process data with automatic batching and memory management
   */
  async processBatches<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options: {
      batchSize?: number;
      maxConcurrency?: number;
      memoryCheck?: boolean;
      progressCallback?: (processed: number, total: number) => void;
    } = {}
  ): Promise<ProcessingResult<R>> {
    const {
      batchSize = 100,
      maxConcurrency = 4,
      memoryCheck = true,
      progressCallback
    } = options;

    const startTime = Date.now();
    const results: R[] = [];
    const errors: Error[] = [];
    const activeBatches = new Map<number, Promise<R[]>>();
    
    let processed = 0;
    let batchIndex = 0;

    logger.info('Starting batch processing', {
      totalItems: items.length,
      batchSize,
      maxConcurrency,
      memoryCheck
    });

    // Process items in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      // Wait if too many concurrent batches
      while (activeBatches.size >= maxConcurrency) {
        const completedBatch = await Promise.race(
          Array.from(activeBatches.keys()).map(async (index) => {
            const result = await activeBatches.get(index)!;
            return { index, result };
          })
        );

        results.push(...completedBatch.result);
        activeBatches.delete(completedBatch.index);
        processed += batchSize;

        if (progressCallback) {
          progressCallback(processed, items.length);
        }
      }

      // Process batch
      const batchPromise = this.processBatchWithErrorHandling(
        batch,
        processor,
        batchIndex
      );

      activeBatches.set(batchIndex, batchPromise);
      batchIndex++;

      // Memory check
      if (memoryCheck && batchIndex % 10 === 0) {
        const memoryUsage = process.memoryUsage();
        if (memoryUsage.heapUsed > this.options.memoryThreshold) {
          logger.warn('High memory usage in batch processing', {
            heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
            threshold: `${(this.options.memoryThreshold / 1024 / 1024).toFixed(2)} MB`
          });

          if (global.gc) {
            global.gc();
          }
        }
      }
    }

    // Wait for remaining batches
    const remainingResults = await Promise.allSettled(
      Array.from(activeBatches.values())
    );

    for (const result of remainingResults) {
      if (result.status === 'fulfilled') {
        results.push(...result.value);
      } else {
        errors.push(result.reason);
        this.stats.errorsEncountered++;
      }
    }

    // Final stats
    const processingTime = Date.now() - startTime;
    this.stats.processingTime = processingTime;
    this.stats.throughputMBps = (this.stats.bytesProcessed / 1024 / 1024) / (processingTime / 1000);

    logger.info('Batch processing completed', {
      totalItems: items.length,
      results: results.length,
      errors: errors.length,
      processingTime: `${processingTime}ms`,
      throughput: `${this.stats.throughputMBps.toFixed(2)} MB/s`
    });

    return {
      success: errors.length === 0,
      results,
      stats: { ...this.stats },
      errors
    };
  }

  /**
   * Get current processing statistics
   */
  getStats(): ProcessingStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      bytesProcessed: 0,
      chunksProcessed: 0,
      processingTime: 0,
      memoryPeak: 0,
      errorsEncountered: 0,
      throughputMBps: 0
    };
  }

  // Private helper methods

  private async processBatchWithErrorHandling<T, R>(
    batch: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchIndex: number
  ): Promise<R[]> {
    try {
      const result = await Promise.race([
        processor(batch),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Batch processing timeout')), this.options.timeout);
        })
      ]);

      return result;
    } catch (error) {
      this.stats.errorsEncountered++;
      logger.error('Batch processing error', {
        batchIndex,
        batchSize: batch.length,
        error: String(error)
      });
      
      throw new AppError(
        'Batch processing failed',
        ErrorCode.PROCESSING_ERROR,
        500,
        true,
        { batchIndex, batchSize: batch.length, error: String(error) }
      );
    }
  }
}

/**
 * Memory-efficient file content reader
 */
export class StreamingFileReader {
  /**
   * Read file content in chunks without loading entire file into memory
   */
  static async *readFileChunks(
    filePath: string,
    chunkSize: number = 64 * 1024
  ): AsyncGenerator<Buffer, void, unknown> {
    const stream = createReadStream(filePath, { highWaterMark: chunkSize });
    
    try {
      for await (const chunk of stream) {
        yield chunk as Buffer;
      }
    } finally {
      stream.destroy();
    }
  }

  /**
   * Process file lines efficiently without loading entire file
   */
  static async processFileLines(
    filePath: string,
    lineProcessor: (line: string, lineNumber: number) => Promise<void>,
    options: {
      encoding?: BufferEncoding;
      maxLineLength?: number;
      skipEmptyLines?: boolean;
    } = {}
  ): Promise<{ linesProcessed: number; errors: number }> {
    const { encoding = 'utf8', maxLineLength = 10000, skipEmptyLines = true } = options;
    
    let linesProcessed = 0;
    let errors = 0;
    let buffer = '';
    let lineNumber = 0;

    try {
      for await (const chunk of this.readFileChunks(filePath)) {
        buffer += chunk.toString(encoding);
        
        let lineEnd: number;
        while ((lineEnd = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, lineEnd).replace(/\r$/, ''); // Remove \r from Windows line endings
          buffer = buffer.slice(lineEnd + 1);
          lineNumber++;

          if (skipEmptyLines && line.trim() === '') {
            continue;
          }

          if (line.length > maxLineLength) {
            logger.warn('Line exceeds maximum length', {
              filePath,
              lineNumber,
              lineLength: line.length,
              maxLineLength
            });
            continue;
          }

          try {
            await lineProcessor(line, lineNumber);
            linesProcessed++;
          } catch (error) {
            errors++;
            logger.error('Line processing error', {
              filePath,
              lineNumber,
              error: String(error)
            });
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim() && !skipEmptyLines) {
        lineNumber++;
        try {
          await lineProcessor(buffer.trim(), lineNumber);
          linesProcessed++;
        } catch (error) {
          errors++;
        }
      }

    } catch (error) {
      logger.error('File reading error', {
        filePath,
        error: String(error)
      });
      errors++;
    }

    return { linesProcessed, errors };
  }
}

// Export utility functions
export const createStreamingProcessor = (options?: Partial<StreamingOptions>) => 
  new StreamingFileProcessor(options);

export const processLargeFileStreaming = async <T>(
  filePath: string,
  processor: (chunk: Buffer) => Promise<T[]>,
  options?: Partial<StreamingOptions>
) => {
  const streamProcessor = new StreamingFileProcessor(options);
  return streamProcessor.processLargeFile(filePath, processor);
};