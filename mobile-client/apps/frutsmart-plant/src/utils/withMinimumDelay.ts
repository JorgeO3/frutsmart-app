/**
 * Una función de utilidad simple que pausa la ejecución asíncrona.
 * @param ms El número de milisegundos a esperar.
 * @returns Una promesa que se resuelve después del tiempo especificado.
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};


/**
 * Envuelve una promesa para garantizar que tarde un tiempo mínimo en resolverse.
 * @param promise La promesa a la que se le aplicará el delay.
 * @param delay El tiempo mínimo en milisegundos que debe durar la operación.
 * @returns El resultado de la promesa original.
 */
export async function withMinimumDelay<T>(task: () => Promise<T>, minMs = 2000): Promise<T> {
  const start = Date.now();
  const result = await task(); // Espera a que el trabajo real termine
  const elapsed = Date.now() - start;

  // Si el trabajo real tardó menos que el tiempo mínimo,
  // esperamos la diferencia restante.
  if (elapsed < minMs) {
    await sleep(minMs - elapsed);
  }

  return result;
}
