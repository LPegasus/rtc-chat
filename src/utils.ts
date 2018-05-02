export class Defer<T> {
  promise!: Promise<T>;
  resolve!: (result: T) => void;
  reject!: (reason: any) => void;
  new() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

export async function asyncTimout<T>(fn: (...args: any[]) => Promise<T>, timeout: number, message = 'timeout') {
  return (...args) => {
    const defer = new Defer<T>();

    const task = fn();

    const timer = setTimeout(() => {
      defer.reject(new Error(message));
    }, timeout);

    const resolve = (result: T) => {
      clearTimeout(timer);
      defer.resolve(result);
    }

    task.then(resolve);

    return defer.promise;
  }
}
