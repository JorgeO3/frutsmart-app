# Portada / Metadatos del informe

| Campo necesario | Valor |
|---|---|
| titulo_informe | Informe de Revisión de Calidad en Planta  |
| descripcion_intro | Encuentre de manera detallada los resultados de la revisión de calidad realizada en la planta. |

# Resumen general – Clasificación externa

| Campo necesario | Tabla (DB) | Campo (DB) |
|---|---|---|
| clase_1_cantidad | classified_segments | external_summary_json |
| clase_2_cantidad | classified_segments | external_summary_json |
| clase_3_cantidad | classified_segments | external_summary_json |
| clase_4_cantidad | classified_segments | external_summary_json |
| total_racimos | NO DB | Sum of all classes |

# Resumen general – Criterios de cosecha

| Campo necesario | Tabla (DB) | Campo (DB) |
|---|---|---|
| rb_cantidad | quality_analyses | criteria_rb |
| rv_cantidad | quality_analyses | criteria_rv |
| rsm_cantidad | quality_analyses | criteria_rsm |
| rmf_cantidad | quality_analyses | criteria_rmf |
| rpl_cantidad | quality_analyses | criteria_rpl |
| rp_cantidad | quality_analyses | criteria_rp |
| vac_cantidad | quality_analyses | criteria_vac |
| total_racimos | NO DB | Sum of all criteria |

# Resumen general – Clasificación interna

| Campo necesario | Tabla (DB) | Campo (DB) |
|---|---|---|
| tipo_a_cantidad | quality_analyses | internal_summary_json |
| tipo_b_cantidad | quality_analyses | internal_summary_json |
| tipo_c_cantidad | quality_analyses | internal_summary_json |
| tipo_d_cantidad | quality_analyses | internal_summary_json |
| total_racimos | NO DB | Sum of all types |

# Resumen detallado – Datos generales de la sesión (Fruto Propio)

| Campo necesario | Tabla (DB) | Campo (DB) |
|---|---|---|
| procedencia_fruto | quality_analyses | provider |
| programa | quality_analyses | program_id |
| lote_codigo | quality_analysis_lots | lot_id |
| placa_vehiculo | quality_analyses | truck_plate |
| numero_consecutivo | quality_analyses | consecutive_number |
| verificador_usuario | NO DB | user_verifier |

# Resumen detallado – Datos generales de la sesión (Compra de Terceros)

| Campo necesario | Tabla (DB) | Campo (DB) |
|---|---|---|
| procedencia_fruto | quality_analyses | provider |
| proveedor | quality_analyses | vendor |
| subproveedor | quality_analyses | subvendor |
| placa_vehiculo | quality_analyses | truck_plate |
| numero_consecutivo | quality_analyses | consecutive_number |
| verificador_usuario | NO DB | user_verifier |

# Lanzamientos – Fotografías y soporte (por vehículo)

| Campo necesario | Tabla (DB) | Campo (DB) |
|---|---|---|
| lanzamiento_numero | quality_classifications | iteration_index |
| foto_externa_path | quality_classifications | internal_segmented_photo_uri |
| foto_interna_path | classified_segments | uri |