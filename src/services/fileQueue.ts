export class FileWriteQueue {
  private readonly queues = new Map<string, Promise<unknown>>();

  enqueue<T>(path: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(path) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task);

    this.queues.set(
      path,
      next.finally(() => {
        if (this.queues.get(path) === next) {
          this.queues.delete(path);
        }
      }),
    );

    return next;
  }
}
