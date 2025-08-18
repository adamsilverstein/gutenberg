# Native Web Worker Implementation

This directory contains a native Web Worker implementation that replaces the deprecated `@shopify/web-worker` package.

## Overview

The `worker-factory.ts` file provides a `createVipsWorker()` function that creates a Web Worker using native browser APIs. This worker handles intensive image processing operations using VIPS/WASM off the main thread to avoid blocking the UI.

## How it Works

### 1. CORS-Safe Worker Creation

Instead of loading a separate worker file (which could cause CORS issues), the worker code is:
- Defined inline as a string within the factory function
- Converted to a Blob URL using `URL.createObjectURL()`
- Passed to the native `Worker()` constructor

This approach ensures the worker can be loaded from any origin without CORS restrictions.

### 2. Promise-Based Interface

The worker factory creates a promise-based interface that matches the original `@shopify/web-worker` API:

```typescript
const worker = createVipsWorker();

// All methods return promises
const result = await worker.resizeImage(id, buffer, type, resize, smartCrop);
```

### 3. Message Passing Protocol

The worker uses a structured message passing protocol:

**Main Thread → Worker:**
```javascript
{
  id: number,        // Unique message ID
  method: string,    // Method name to call
  args: any[]        // Arguments array
}
```

**Worker → Main Thread:**
```javascript
{
  id: number,        // Matching message ID
  result?: any,      // Result data (if successful)
  error?: object,    // Error object (if failed)
  success: boolean   // Success flag
}
```

## Supported Methods

The worker exposes the following methods from the `@wordpress/vips` package:

- `convertImageFormat(id, buffer, inputType, outputType, quality?, interlaced?)`
- `compressImage(id, buffer, type, quality?, interlaced?)`
- `resizeImage(id, buffer, type, resize, smartCrop?)`
- `cancelOperations(id)`

## Migration from @shopify/web-worker

### Before (using @shopify/web-worker):
```typescript
import { createWorkerFactory } from '@shopify/web-worker';

const createVipsWorker = createWorkerFactory(
  () => import('@wordpress/vips')
);
const vipsWorker = createVipsWorker();
```

### After (using native worker):
```typescript
import { createVipsWorker } from '../utils/worker-factory';

const vipsWorker = createVipsWorker();
```

The API remains exactly the same, ensuring no changes are required in consuming code.

## Benefits

1. **No External Dependencies**: Removes the need for `@shopify/web-worker`
2. **CORS-Safe**: Worker code is inlined, eliminating cross-origin issues
3. **Lightweight**: Smaller bundle size without the extra dependency
4. **Compatible**: Maintains the same API as the original implementation
5. **Modern**: Uses native Web Worker APIs directly

## Browser Support

This implementation uses standard Web Worker APIs that are supported in all modern browsers:
- Chrome 4+
- Firefox 3.5+
- Safari 4+
- Edge (all versions)

## Error Handling

The worker implementation includes comprehensive error handling:
- Worker-level errors are caught and forwarded to the main thread
- Unhandled promise rejections are logged
- Failed operations reject their corresponding promises
- Worker termination cleans up all pending operations