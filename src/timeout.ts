import { AnyFunction } from "./types";

export default function timeout<T extends AnyFunction>(fn: T, timeout: number): Promise<ReturnType<T>> {
  return Promise.race([
    fn(),
    new Promise((_, reject) => {
      setTimeout(() => reject(Error('timeout')), timeout);
    })
  ]);
}