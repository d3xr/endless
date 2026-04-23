export const withPerf = <T extends Array<any>, U>(
  name: string,
  fn: (...args: T) => U
) => {
  return (...args: T): U => {
    const t0 = performance.now()
    const res = fn(...args)
    const time = +(performance.now() - t0).toFixed(4)
    //@ts-ignore
    if (window?.endless?.logsShow) console.log('⏱ ' + name.padEnd(32, ' '), time)

    //@ts-ignore
    if (window.endless) {
      //@ts-ignore
      window.endless.logs ??= {}
      //@ts-ignore
      window.endless.logs[name] ??= []
      //@ts-ignore
      window.endless.logs[name].push(time)
    }
    return res
  }
}
