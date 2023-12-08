// The only nicities this one provides are
// automatic task scheduling, execution and
// timeout cleanups upon adding/removing tasks
// to and from a queue and a batch clear method

export type TimeoutId = number;
export type Task = () => void;

export class TaskQueue {
  private timeouts: Map<TimeoutId, Task> = new Map();

  push(task: Task, delay: number): TimeoutId {
    const timeoutId = window.setTimeout(() => {
      this.execute(timeoutId);
    }, delay);
    this.timeouts.set(timeoutId, task);

    return timeoutId;
  }

  remove(timeoutId: TimeoutId) {
    window.clearTimeout(timeoutId);
    this.timeouts.delete(timeoutId);
  }

  clear() {
    for (const timeoutId of this.timeouts.keys()) {
      window.clearTimeout(timeoutId);
    }
    this.timeouts.clear();
  }

  private execute(timeoutId: TimeoutId) {
    const task = this.timeouts.get(timeoutId);
    if (task) {
      task();
      this.timeouts.delete(timeoutId);
    }
  }
}
