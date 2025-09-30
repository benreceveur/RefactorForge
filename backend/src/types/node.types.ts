/**
 * Node.js Internal API Type Definitions
 * Provides type safety for Node.js internal APIs
 */

// Node.js Process with internal methods
export interface NodeProcess extends NodeJS.Process {
  _getActiveHandles(): unknown[];
  _getActiveRequests(): unknown[];
}

// Type guard to check if process has internal methods
export function hasInternalMethods(process: NodeJS.Process): process is NodeProcess {
  return (
    typeof (process as NodeProcess)._getActiveHandles === 'function' &&
    typeof (process as NodeProcess)._getActiveRequests === 'function'
  );
}

// Safe wrappers for accessing internal Node.js APIs
export const processUtils = {
  getActiveHandleCount(): number {
    try {
      if (hasInternalMethods(process)) {
        return process._getActiveHandles().length;
      }
      return 0;
    } catch {
      return 0;
    }
  },

  getActiveRequestCount(): number {
    try {
      if (hasInternalMethods(process)) {
        return process._getActiveRequests().length;
      }
      return 0;
    } catch {
      return 0;
    }
  },

  getProcessInfo(): {
    activeHandles: number;
    activeRequests: number;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  } {
    return {
      activeHandles: this.getActiveHandleCount(),
      activeRequests: this.getActiveRequestCount(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };
  }
};

// Performance monitoring types
export interface PerformanceEntry {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  kind?: string;
}

export interface ExtendedPerformanceEntry extends PerformanceEntry {
  kind?: 'request' | 'response' | 'database' | 'external' | 'computation';
  metadata?: Record<string, unknown>;
}

// Memory usage with additional metrics
export interface ExtendedMemoryUsage extends NodeJS.MemoryUsage {
  gcCount?: number;
  gcDuration?: number;
  heapSpaceUsed?: Record<string, number>;
}

// CPU usage with additional metrics
export interface ExtendedCpuUsage extends NodeJS.CpuUsage {
  utilization?: number;
  loadAverage?: number[];
}

// System metrics interface
export interface SystemMetrics {
  memory: ExtendedMemoryUsage;
  cpu: ExtendedCpuUsage;
  uptime: number;
  activeHandles: number;
  activeRequests: number;
  eventLoopLag?: number;
  gc?: {
    count: number;
    duration: number;
    lastRun?: number;
  };
}