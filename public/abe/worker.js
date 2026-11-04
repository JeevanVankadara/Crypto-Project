importScripts('/abe/wasm_exec.js');
const go = new Go();
const ready = WebAssembly.instantiateStreaming(fetch('/abe/helper.wasm'), go.importObject).then(
  async ({ instance }) => {
    go.run(instance).catch((error) => {
      console.error(error.message);
    });
    if (typeof academicABE !== 'function') throw new Error('ABE runtime did not start.');
  },
);
self.onmessage = async ({ data }) => {
  try {
    await ready;
    const value = JSON.parse(academicABE(JSON.stringify(data.request)));
    self.postMessage({ id: data.id, ...value });
  } catch (error) {
    self.postMessage({ id: data.id, error: `ABE runtime unavailable: ${error.message}` });
  }
};
