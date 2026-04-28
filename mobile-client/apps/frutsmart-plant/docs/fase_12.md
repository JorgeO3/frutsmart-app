Sí: para cerrar completamente la Fase 12, hace falta un plan formal de performance + memory + correctness de soporte. Revisando FrutSmartP/docs/migration_plan_nano_rt.md, la Fase 12 no se puede cerrar solo porque “los tests pasan”; hay que demostrar que la estrategia actual de buffers/workspaces es correcta y suficientemente eficiente, o abrir explícitamente una subfase de optimización.
Qué exige exactamente la Fase 12
- Medir:
  - clasificación plant/field
  - segmentación plant/field
  - warmup
  - shutdown/restart
- Registrar:
  - tiempo por inferencia
  - tiempo total por workflow
  - delta vs baseline anterior
  - crecimiento de direct/native buffers si se puede observar
  - threads vivos
  - child jobs
- Tomar una decisión final:
  - copias actuales aceptables
  - o hay que optimizar la API / estrategia de buffers
Dónde estamos hoy
- Ya existe base útil:
  - modules/nano-rt/android/src/androidTest/kotlin/expo/modules/nanort/module/workflows/WorkflowPerformanceRegressionAndroidTest.kt
  - modules/nano-rt/android/src/androidTest/kotlin/expo/modules/nanort/module/workflows/WorkflowWorkspaceCompatibilityAndroidTest.kt
- Ya medimos parcialmente:
  - clasificación y segmentación
  - thread delta
  - child jobs
  - heap growth
  - shutdown/restart parcial
- Pero todavía falta para cerrar Fase 12:
  - baseline comparativo formal
  - benchmark explícito de warmup
  - cobertura de restart más amplia
  - observación de memoria native/direct
  - artefacto/documento final de sign-off
  - decisión explícita sobre buffers/workspaces
Conclusión sobre correctness adicional
- Sí, sí hacen falta más pruebas, pero no una reapertura masiva de correctness.
- Hacen falta pruebas quirúrgicas, porque sin ellas los números de performance pueden ser engañosos.
Pruebas nuevas que recomiendo añadir
- WarmupBenchmarkAndroidTest
  - mide warmup total y por modelo
  - confirma que al terminar no quedan replies/thread leaks/session sucia
- WorkflowRestartMatrixAndroidTest
  - valida restart repetido sobre:
    - plant external/internal classification
    - field external/internal classification
    - plant segmentation
    - field segmentation
  - confirma éxito post-shutdown sin corrupción de workspace ni fatal terminations
- ClassificationProcessorRegressionAndroidTest
  - hoy Phase 11 pide regresión explícita de preprocess de clasificación y no veo una dedicada
  - protege correctness del input tensor mientras medimos rendimiento
- DirectBufferGrowthObservationAndroidTest o equivalente
  - no para correctness funcional, sino para confirmar que la estrategia actual no genera crecimiento anómalo de memoria native/direct
Plan completo para cerrar Fase 12
1. Congelar el criterio de cierre
- Definir que Fase 12 se cierra solo si:
  - todas las pruebas críticas están verdes
  - no hay regresión severa
  - existe baseline comparativo documentado
  - existe decisión escrita sobre buffers/workspaces
- Entregable:
  - docs/nano_rt_phase12_validation.md
2. Separar el trabajo en 3 carriles
- Carril A - correctness que protege performance
  - tests nuevos quirúrgicos
- Carril B - benchmark reproducible
  - perf battery dedicada con métricas estables
- Carril C - sign-off
  - tabla baseline vs actual + decisión final
3. Completar correctness mínimo necesario
- Revisar y dejar como gate:
  - WorkflowWorkspaceCompatibilityAndroidTest
  - seguridad de lease/buffers
  - leak/thread/child-job tests
- Añadir:
  - WarmupBenchmarkAndroidTest
  - WorkflowRestartMatrixAndroidTest
  - ClassificationProcessorRegressionAndroidTest
- Objetivo:
  - que los números de perf no escondan corrupción, aliasing, o restart defectuoso
4. Expandir la batería de performance
- La batería debe medir explícitamente:
  - warmup total
  - warmup por modelo
  - p50/p95 por workflow
  - restart latency tras shutdown()
  - thread delta
  - child-job delta
  - heap delta
  - native/direct memory delta si logramos instrumentarla
- Mantener separación:
  - tests de umbral corto para gate
  - runs más largos para diagnóstico
5. Foco especial en segmentación
- Es el mayor riesgo por la doble copia potencial hacia:
  - workspace.detTensor
  - workspace.protoTensor
- La validación debe responder esto con datos:
  - ¿la p95 sigue aceptable?
  - ¿la memoria sube pero estabiliza?
  - ¿hay crecimiento monotónico?
- Si falla:
  - no se cierra Fase 12
  - se abre subfase de optimización de outputs lease-bound
6. Medición de memoria correcta
- Heap sola no basta.
- Plan de instrumentación recomendado:
  - heap Java
  - native heap (Debug.getNativeHeapAllocatedSize() o equivalente)
  - si es viable, dumpsys meminfo/observación externa en corrida controlada
- Resultado esperado:
  - evidencia razonable de que no hay crecimiento sostenido por buffers/direct memory
7. Construir baseline real
- Necesitamos una referencia explícita.
- Opción ideal:
  - comparar contra RNOptimizedPipelines en mismo dispositivo/emulador y condiciones similares
- Opción operativa si eso no es reproducible:
  - congelar baseline local con una corrida formal inicial y comparar todas las siguientes contra esa referencia
- El documento final debe incluir:
  - dispositivo
  - build fingerprint
  - variante
  - fecha
  - commit/estado del código
  - número de repeticiones
8. Matriz de ejecución
- Gate corto:
  - :nano-rt:connectedDebugAndroidTest
  - perf tests dedicados
- Diagnóstico medio:
  - repeats por workflow
  - reinicios repetidos
- Diagnóstico largo:
  - soakRun con perfiles:
    - mixed
    - workflow_classification
    - workflow_segmentation
    - shutdown
- Todos con artefactos preservados
9. Umbrales de aceptación
- Mantener como mínimo los actuales:
  - clasificación p95 <= 600ms
  - segmentación p95 <= 1500ms
  - thread delta <= 1
  - child-job delta <= 2
  - fatalTerminationCount = 0
  - pendingReplies = 0
- Añadir criterios de cierre:
  - warmup dentro de umbral acordado
  - restart latency sin degradación severa
  - sin crecimiento monotónico de memoria native/direct
  - sin regresión severa vs baseline
- Regla práctica:
  - si segmentación empeora materialmente o memoria native/direct se dispara, Fase 12 no cierra
10. Artefactos obligatorios
- Documento:
  - docs/nano_rt_phase12_validation.md
- Carpeta de evidencia:
  - artifacts/nanort-phase12/
- Contenido:
  - resultados de androidTest
  - resultados de perf tests
  - reportes soak
  - tabla baseline vs actual
  - conclusión final:
    - buffer strategy acceptable
    - o optimization subphase required
11. Criterio final de cierre
- Fase 12 queda cerrada solo si podemos afirmar con evidencia:
  - correctness preservado en rutas sensibles a buffers/workspaces
  - rendimiento aceptable en clasificación y segmentación
  - warmup y restart estables
  - no leaks/thread growth/child-job growth
  - no señal fuerte de crecimiento direct/native problemático
  - decisión explícita documentada sobre la estrategia actual de copias
Orden recomendado de implementación
1. Añadir tests faltantes de correctness de soporte
2. Añadir benchmark explícito de warmup y restart matrix
3. Añadir observabilidad de native/direct memory
4. Ejecutar batería completa
5. Consolidar baseline vs actual
6. Tomar decisión final y documentarla
Lo más importante
- La Fase 12 no es solo “medir rápido”.
- Es la fase que decide si el runtime migrado es seguro de aprobar en rendimiento sin esconder un problema estructural de buffers.
Una pregunta clave para dejar el plan totalmente cerrado:  
¿Qué quieres usar como baseline anterior? Mi recomendación es: primero intentar baseline contra RNOptimizedPipelines en el mismo emulador/dispositivo; si eso no es reproducible, congelamos un baseline formal del nano-rt actual y documentamos que el cierre de Fase 12 será contra esa referencia local. Esto cambia el formato del reporte final, pero no cambia las pruebas que debemos implementar.