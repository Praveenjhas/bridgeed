/**
 * Small binary min-heap used for bounded Top-K selection.
 *
 * Keeping the heap ordered by the *eviction* comparator (worst item at the
 * root) means a stream of N candidates can be reduced to the best K in
 * O(N log K) time and O(K) memory, instead of sorting all N candidates.
 */
export class MinHeap<T> {
  private readonly items: T[] = [];

  constructor(private readonly compare: (a: T, b: T) => number) {}

  get size(): number {
    return this.items.length;
  }

  /** The item the heap would evict next, or undefined when empty. */
  peek(): T | undefined {
    return this.items[0];
  }

  /** Read only view of the heap contents; the order is not sorted. */
  values(): readonly T[] {
    return this.items;
  }

  push(value: T): void {
    this.items.push(value);
    this.siftUp(this.items.length - 1);
  }

  /**
   * Replaces the current minimum with a better item and restores the heap.
   * This is the bounded Top-K hot path, so it avoids any array resizing.
   */
  replaceMin(value: T): void {
    if (this.items.length === 0) {
      this.items.push(value);
      return;
    }

    this.items[0] = value;
    this.siftDown(0);
  }

  /** True when the item at `leftIndex` should be ordered before `rightIndex`. */
  private isLessThan(leftIndex: number, rightIndex: number): boolean {
    const left = this.items[leftIndex];
    const right = this.items[rightIndex];

    if (left === undefined || right === undefined) {
      return false;
    }

    return this.compare(left, right) < 0;
  }

  private swap(firstIndex: number, secondIndex: number): void {
    const first = this.items[firstIndex];
    const second = this.items[secondIndex];

    if (first === undefined || second === undefined) {
      return;
    }

    this.items[firstIndex] = second;
    this.items[secondIndex] = first;
  }

  private siftUp(startIndex: number): void {
    let index = startIndex;

    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);

      if (!this.isLessThan(index, parentIndex)) {
        return;
      }

      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }

  private siftDown(startIndex: number): void {
    let index = startIndex;

    for (;;) {
      const leftIndex = index * 2 + 1;
      const rightIndex = leftIndex + 1;
      let smallestIndex = index;

      if (
        leftIndex < this.items.length &&
        this.isLessThan(leftIndex, smallestIndex)
      ) {
        smallestIndex = leftIndex;
      }

      if (
        rightIndex < this.items.length &&
        this.isLessThan(rightIndex, smallestIndex)
      ) {
        smallestIndex = rightIndex;
      }

      if (smallestIndex === index) {
        return;
      }

      this.swap(index, smallestIndex);
      index = smallestIndex;
    }
  }
}
