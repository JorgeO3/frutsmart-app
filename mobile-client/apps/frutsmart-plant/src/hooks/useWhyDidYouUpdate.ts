import { useEffect, useRef } from 'react';

/**
 * Un hook de depuración que imprime en la consola qué prop ha cambiado
 * en un componente y ha causado un re-render.
 * @param name El nombre del componente para identificarlo en los logs.
 * @param props Las props del componente.
 */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function useWhyDidYouUpdate(name: string, props: any) {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const previousProps = useRef<any>(undefined);

  useEffect(() => {
    if (previousProps.current) {
      // Obtener todas las keys de las props actuales y anteriores
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      // Objeto para guardar las diferencias
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const changesObj: any = {};
      // Iterar sobre cada key
      for (const key of allKeys) {
        // Si la prop anterior no es igual a la actual
        if (previousProps.current[key] !== props[key]) {
          changesObj[key] = {
            from: previousProps.current[key],
            to: props[key],
          };
        }
      }

      // Si hay cambios, imprimirlos en la consola
      if (Object.keys(changesObj).length) {
        console.log(`[why-did-you-update] ${name}:`, changesObj);
      }
    }

    // Guardar las props actuales para la siguiente comparación
    previousProps.current = props;
  });
}
