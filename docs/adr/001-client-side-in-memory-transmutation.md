# ADR 001: Sovereign In-Memory Client-Side Media and Document Runtime

## Status
Accepted

## Context & Problem Statement
Traditional file converters rely on a server-centric architecture where files are uploaded to remote cloud instances, processed on shared CPU clusters, and downloaded back to the client. This introduces critical vulnerabilities:
1. **Zero Privacy Guarantee:** Sensitive intellectual property, PDFs, and media are exposed to third-party disk persistence.
2. **Bandwidth & Latency Overhead:** Transferring 50-100MB files over public networks bottlenecks conversion speed regardless of local hardware performance.
3. **Infrastructure Cost:** Server instances require autoscaling compute and persistent bandwidth allocation.

## Decision Drivers
- Zero-egress privacy: User data must never leave volatile client RAM.
- Multi-core CPU utilization: Modern client hardware possesses 4-16 hardware threads capable of native media decoding.
- Browser sandboxing: Computation must execute off the main 60 FPS UI thread to prevent UI freezing.

## Considered Options
1. **Server-side processing:** Legacy microservices (Node.js/Python server farms).
2. **Main-thread browser canvas:** Single-threaded JavaScript execution.
3. **Dedicated Web Worker Pool with Transferable ArrayBuffers:** Pure client-side concurrent runtime.

## Decision Outcome
Chosen option: **Dedicated Web Worker Pool with Transferable ArrayBuffers (Option 3)**.

### Architectural Blueprint:
- **Zero-Copy Memory Transfer:** Heavy binary payloads are transferred between the main thread and Worker threads via transferable `ArrayBuffer` objects, eliminating serialization duplication.
- **OffscreenCanvas Image Processing:** Image decoding, orientation normalization (EXIF), and lossless quantization execute off-thread.
- **Hardware-Capped Concurrency:** The worker pool scales dynamically to `Math.min(navigator.hardwareConcurrency - 1, 6)` threads, always leaving a dedicated core free for the 60 FPS browser UI loop.
- **Deterministic RAM Disposal:** Object URLs created via `URL.createObjectURL` are strictly tracked in `memoryManager` and revoked immediately upon task reset.
