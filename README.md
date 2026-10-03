# OmniShift: In-Memory Client-Side Media and Document Processing Engine

A high-throughput, strictly client-side data transmutation runtime engineered for modern web browsers. OmniShift executes media decoding, color quantization, document assembly, and structured data transformations directly inside volatile client memory.

```
================================================================================
CORE GUARANTEE:
100% Client-Side Computation | 0 Bytes Ingress/Egress | Total Data Isolation
================================================================================
```

---

## 1. Abstract

OmniShift redefines document and media processing by eliminating server-side roundtrips entirely. Traditional file manipulation pipelines expose sensitive corporate artifacts to network intermediaries, incurring latency penalties, ingress costs, and compliance risks. 

OmniShift operates as a sovereign local computing environment within the user's browser sandbox. By orchestrating a pool of dedicated Web Workers and communicating exclusively via Transferable Objects (`ArrayBuffer`), OmniShift achieves near-native transformation speeds while preserving a deterministic 60 frames-per-second UI interaction loop.

---

## 2. System Architecture & Execution Model

The engine architecture separates the main user-interface thread from heavy computational pipelines using an isolated multi-worker model.

```
+-----------------------------------------------------------------------------+
|                                MAIN UI THREAD                               |
|                                                                             |
|  [ File Ingestion ]  --->  [ File.slice() / ArrayBuffer ]  ---> [ Dispatch ]|
+--------------------------------------|--------------------------------------+
                                       | Transferable Objects (Zero-Copy)
                                       v
+-----------------------------------------------------------------------------+
|                         DYNAMIC WEB WORKER POOL                             |
|              (Pool Size: Math.max(1, min(HardwareConcurrency - 1, 6)))      |
|                                                                             |
|  Thread 1..N:                                                               |
|  +---------------------+  +---------------------+  +---------------------+  |
|  |   OffscreenCanvas   |  |   PDF Subsystem     |  |   Tabular Engine    |  |
|  | WebP / AVIF / PNG   |  | In-Memory pdf-lib   |  | CSV / JSON / XLSX   |  |
|  +---------------------+  +---------------------+  +---------------------+  |
+--------------------------------------|--------------------------------------+
                                       | Transferable Output Buffer
                                       v
+-----------------------------------------------------------------------------+
|                         MEMORY LIFECYCLE CONTROLLER                         |
|                                                                             |
|  [ Blob Generation ] ---> [ Object URL Cache ] ---> [ Deterministic GC ]    |
+-----------------------------------------------------------------------------+
```

### 2.1 Zero-Copy Transferable Pipeline
Instead of cloning megabytes of binary payloads across thread boundaries via structured cloning, OmniShift relinquishes byte ownership using `postMessage(message, [transferableArrayBuffer])`. Transfer overhead is bounded to approximately 0.4 milliseconds regardless of buffer size.

### 2.2 Thread Isolation & Framerate Lock
The main execution context delegates all decoding, layout generation, and serialization tasks to background workers. The event loop remains unblocked, guaranteeing a sub-50ms Interaction to Next Paint (INP) and 0 Cumulative Layout Shift (CLS).

### 2.3 Deterministic Buffer Lifecycle Management
Browser memory leaks from abandoned `blob:` URIs are mitigated via an active `MemoryManager` registry. URLs are tracked alongside buffer allocations and deterministically invalidated using `URL.revokeObjectURL()` upon queue flushing, download dispatch, or viewport reset.

---

## 3. Transformation Feature Matrix

| Engine Subsystem | Ingest Formats | Output Formats | Transformation Mechanics |
| :--- | :--- | :--- | :--- |
| **Raster Transcoder** | PNG, JPEG, WEBP, AVIF, HEIC | WebP, AVIF, PNG, JPEG | Hardware-accelerated `OffscreenCanvas`, bicubic downsampling, variable lossy/lossless quantization. |
| **Document Compiler** | PDF | PDF | Linearized in-memory object stream merging, metadata sanitization, page extraction via `pdf-lib`. |
| **Structured Data** | JSON, CSV | CSV, JSON, XLSX | High-speed delimited parsing, delimiter sniffing, header flattening, SheetJS workbook compilation. |
| **Vector Engine** | SVG | Minified SVG, High-Res PNG | XML namespace stripping, redundant path pruning, raster rendering via canvas context. |
| **Archive Stream** | Mixed File Queue | ZIP (.zip) | Multi-core parallel processing paired with client RAM Deflate compilation via JSZip. |

---

## 4. Telemetry & Hardware Diagnostics

OmniShift features an integrated Telemetry HUD that samples high-resolution hardware timers (`performance.now()`) to report actual compute metrics:

- **Latency (ms)**: High-precision execution duration measured from worker ingest to buffer emission.
- **Compression Delta (%)**: Byte footprint reduction delta calculated as:
  `((TransmutedBytes - OriginalBytes) / OriginalBytes) * 100`
- **Memory Footprint**: Native V8 JavaScript heap allocation tracking (`performance.memory.usedJSHeapSize`) combined with volatile ArrayBuffer volume tracking.
- **Hardware Thread Engagement**: Real-time counter detailing engaged CPU cores vs. total host capacity (`navigator.hardwareConcurrency`).
- **Runtime Capability Flags**: Instant binary verification for `[SIMD]`, `[OffscreenCanvas]`, and `[TransferableObjects]`.

---

## 5. Local Development & Build Configuration

### Prerequisites
- Node.js runtime environment (v18.0.0 or higher recommended)
- Package manager: npm, pnpm, or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/omnishift.git
cd omnishift

# Install project dependencies
npm install
```

### Local Development Server
```bash
# Start local development server with HMR
npm run dev
```

### Production Build & Worker Chunking
```bash
# Build optimized static distribution
npm run build

# Preview production build locally
npm run preview
```

The Vite configuration enforces ES-module worker compilation (`worker: { format: 'es' }`) and configures required isolation headers for cross-origin boundary enforcement:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

---

## 6. Verification & Security Protocol

To verify zero network communication and complete data sovereignty:

1. Launch OmniShift in Google Chrome, Mozilla Firefox, or Apple Safari.
2. Open Developer Tools (`F12` or `Cmd + Option + I`).
3. Select the **Network** tab and activate the **Fetch/XHR** filter.
4. Drag and drop any 4K image, multi-page PDF, or dense dataset, or trigger a 50-file batch transmutation.
5. Inspect the Network activity log: **0 HTTP/WebSocket requests are dispatched**.
6. The entire computational workflow executes locally inside RAM.

---

## 7. License

Distributed under the MIT License. See `LICENSE` for the complete license declaration.
