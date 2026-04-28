def calcular_categoria(clase1, clase2, clase3, clase4, rv, rb, rsm, rpl, rmf, rp, vac):
    """
    clase1, clase2, clase3, clase4: número de racimos clasificados por clase
    rv, rb, rsm, rpl, rmf, rp, vac: número de racimos por criterio de cosecha
    """
    # Total de racimos para clasificación externa
    total_clasificacion = clase1 + clase2 + clase3 + clase4


    # Calcular porcentaje de racimos en clase 1 y 2
    porcentaje_racimos = (clase1 + clase2) / total_clasificacion if total_clasificacion > 0 else 0


    # Total de racimos para criterios de cosecha
    total_cosecha = rv + rb + rsm + rpl + rmf + rp + vac


    # Calcular porcentaje de racimos verdes
    porcentaje_racimos_verdes = rv / total_cosecha if total_cosecha > 0 else 0


    # Determinar categoría base
    if 0.60 <= porcentaje_racimos <= 1:
        categoria = "ANA"
    elif 0.50 <= porcentaje_racimos <= 0.59:
        categoria = "ANA INTERMEDIO"
    elif 0.40 <= porcentaje_racimos <= 0.49:
        categoria = "ANA MAL APLICADO"
    elif 0 <= porcentaje_racimos <= 0.39:
        categoria = "HÍBRIDO"
    else:
        categoria = "No definido"


    # Aplicar regla: si racimos verdes >= 3%, bajar una categoría
    if porcentaje_racimos_verdes >= 0.03:
        if categoria == "ANA":
            categoria = "ANA INTERMEDIO"
        elif categoria == "ANA INTERMEDIO":
            categoria = "ANA MAL APLICADO"
        elif categoria == "ANA MAL APLICADO":
            categoria = "HÍBRIDO"
        # Si ya es HÍBRIDO, no baja más


    return categoria, porcentaje_racimos, porcentaje_racimos_verdes


# Ejemplo para probar
categoria_final, porc_racimos, porc_verdes = calcular_categoria(
    clase1=25, clase2=20, clase3=10, clase4=5,
    rv=3, rb=40, rsm=5, rpl=2, rmf=1, rp=3, vac=1
)


print(f"Categoría final: {categoria_final}")
print(f"% racimos clase 1 y 2: {porc_racimos:.2%}")
print(f"% racimos verdes: {porc_verdes:.2%}")