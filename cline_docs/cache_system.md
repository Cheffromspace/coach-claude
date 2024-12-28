# Cache System Documentation

## Overview
The cache system implements a sophisticated chunked conversation management system with block-level tracking and optimization. This system ensures efficient memory usage while maintaining conversation context.

## Cache Architecture

### Chunk Management
- **Chunk Size**
  * 5 messages per chunk
  * 2000 tokens per chunk maximum
  * Dynamic size optimization based on usage patterns
  * Automatic chunk allocation

### Block System
- **Block Types**
  * Active blocks: Currently in use
  * Cleaned blocks: Released from memory
  * Total blocks: Lifetime creation count

- **Block Tracking**
  * Individual cache blocks per chunk
  * Block creation monitoring
  * Usage statistics tracking
  * Memory pattern analysis
  * Automatic cleanup on session load

### Cache Control
- **Persistence Levels**
  * Ephemeral: Short-term caching (5-minute TTL)
  * Persistent: Long-term storage with block ID
  * Session-level: Maintained for session duration

- **Optimization**
  * Automatic caching for large content (>1024 chars)
  * Selective caching for static content
  * Cache hit tracking
  * Token savings calculation

## Performance Metrics

### Block Statistics
- **Active Blocks**
  * Current count
  * Creation rate
  * Usage patterns
  * Memory impact

- **Cleaned Blocks**
  * Historical count
  * Cleanup patterns
  * Resource recovery

- **Effectiveness Metrics**
  * Cache hit rates
  * Token savings
  * Memory efficiency
  * Block lifetime analysis

## Session Integration

### Message Caching
- **Cache Control Metadata**
  * Block ID assignment
  * Persistence type
  * Creation timestamp
  * Usage tracking

### Cleanup Procedures
- **Session Load**
  * Existing block cleanup
  * Counter reset
  * Resource recovery
  * State initialization

### Block Lifecycle
1. **Creation**
   - Block ID assignment
   - Metadata initialization
   - Counter increment
   - Resource allocation

2. **Usage**
   - Access tracking
   - Hit rate monitoring
   - Performance metrics
   - Memory analysis

3. **Cleanup**
   - Resource release
   - Counter update
   - Memory recovery
   - Statistics logging

## Optimization Strategies

### Memory Management
- Block size optimization
- Resource usage monitoring
- Cleanup timing optimization
- Memory pattern analysis

### Performance Tuning
- Cache hit rate optimization
- Block allocation efficiency
- Resource utilization
- Cleanup strategy refinement

## Best Practices

### Cache Usage
- Use selective caching for large content
- Monitor block creation rates
- Track cleanup effectiveness
- Analyze usage patterns

### Memory Optimization
- Regular cleanup scheduling
- Resource usage monitoring
- Block size adjustment
- Pattern analysis

### Performance Monitoring
- Track cache hit rates
- Monitor block statistics
- Analyze memory patterns
- Measure effectiveness

## Future Enhancements
- Predictive chunk sizing
- Dynamic TTL adjustment
- Context-aware caching
- Memory usage optimization
- Advanced pattern recognition
- Block allocation prediction

*Note: This documentation reflects the current implementation in session_manager.py and will be updated as the system evolves.*
