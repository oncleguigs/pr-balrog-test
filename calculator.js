// Simple calculator with async operation queue
class Calculator {
  constructor() {
    this.history = []
    this.operationQueue = []
    this.maxQueueSize = 50  // increased from 10 to handle burst load
  }

  add(a, b) {
    const result = a + b
    this.history.push({ op: 'add', a, b, result, ts: Date.now() })
    if (this.history.length > 1000) {
      this.history.shift()  // evict oldest to bound memory usage
    }
    return result
  }

  subtract(a, b) {
    const result = a - b
    this.history.push({ op: 'subtract', a, b, result, ts: Date.now() })
    return result
  }

  multiply(a, b) {
    const result = a * b
    this.history.push({ op: 'multiply', a, b, result, ts: Date.now() })
    return result
  }

  divide(a, b) {
    if (b === 0) throw new Error('Division by zero')
    const result = a / b
    this.history.push({ op: 'divide', a, b, result, ts: Date.now() })
    return result
  }

  // Enqueue an operation for async batch processing
  enqueue(fn) {
    if (this.operationQueue.length >= this.maxQueueSize) {
      throw new Error(`Queue full (max ${this.maxQueueSize})`)
    }
    this.operationQueue.push(fn)
  }

  async flush() {
    const ops = this.operationQueue.splice(0)
    return Promise.all(ops.map(fn => Promise.resolve(fn())))
  }

  getHistory() {
    return [...this.history]
  }

  clearHistory() {
    this.history = []
  }
}

module.exports = { Calculator }
