// The only nicities this one provides are
// automatic task scheduling, execution and
// timeout cleanups upon adding/removing tasks
// to and from a queue and a batch clear method.
// also runs your callbacks immediately after a task execution.
// beware that you cannot unregister this callbacks
// they will keep be called upon a task execution while queue is in memory

export type TimeoutId = number;
export type Task = () => void;

export class TaskQueue {
  private timeouts: Map<TimeoutId, Task> = new Map();
  private onExecuteListeners: Task[] = [];

  push(task: Task, delay: number): TimeoutId {
    const timeoutId = window.setTimeout(() => {
      this.execute(timeoutId);
    }, delay);

    this.timeouts.set(timeoutId, task);

    return timeoutId;
  }

  get length(): number {
    return this.timeouts.size;
  }

  remove(timeoutId: TimeoutId) {
    window.clearTimeout(timeoutId);
    this.timeouts.delete(timeoutId);
  }

  executeImmediately() {
    for (const timeoutId of this.timeouts.keys()) {
      window.clearTimeout(timeoutId);
      this.execute(timeoutId);
    }
  }

  clear() {
    for (const timeoutId of this.timeouts.keys()) {
      window.clearTimeout(timeoutId);
    }
    this.timeouts.clear();
  }

  onExecute(cb: Task) {
    this.onExecuteListeners.push(cb);
  }

  private execute(timeoutId: TimeoutId) {
    const task = this.timeouts.get(timeoutId);

    if (task) {
      task();
      this.timeouts.delete(timeoutId);

      for (const cb of this.onExecuteListeners) {
        cb();
      }
    }
  }
}
