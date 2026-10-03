export function promiseAnyWithPrecedence<T>(promises: Promise<T | null>[]): Promise<T | null> {
  if (promises.length === 0) return Promise.resolve(null);

  return new Promise((resolve) => {
    const results = new Array(promises.length).fill(undefined);
    let done = false;

    promises.forEach((p, i) => {
      p.then(val => {
        if (done) return;
        results[i] = val;

        for (let j = 0; j < promises.length; j++) {
          if (results[j] === undefined) break; // still waiting for higher priority
          if (results[j] !== null) {
            done = true;
            return resolve(results[j]);
          }
        }

        if (results.every(r => r !== undefined)) {
          done = true;
          resolve(null);
        }
      });
    });
  });
}
