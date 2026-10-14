# COA Wargaming Tool — v0.1

Herramienta pedagógica para el **Paso 4 del planeamiento OTAN (AJP-5(A) / APP-28(B) Anexo D)**: confrontación de las líneas de acción propias (**BLUE COA**) con las líneas de acción del adversario obtenidas en el IPOE (**RED COA / OCOA**).

Es una aplicación web estática: no hace falta instalar nada. Para usarla, abra `index.html` en un navegador (Chrome, Edge o Firefox). Los datos se guardan en el navegador y se pueden exportar e importar en JSON.

## Flujo de trabajo (pestañas)

| # | Pestaña | Qué se hace |
|---|---------|-------------|
| 1 | Operación | Crear, duplicar, importar o exportar operaciones. Misión, intención, iniciativa, umbral FFIR, criterios del comandante. Se eligen **una o varias técnicas de confrontación** (eventos clave, fajas, avenida en profundidad, caja). Se definen los **sectores** y los **eventos críticos** (turnos), cada uno con su técnica y su condición decisiva. |
| 2 | Fuerzas | Orden de batalla azul y rojo en **Equivalentes de Fuerza (FE)**, con una biblioteca de referencia. |
| 3 | Líneas de acción | Varias **BLUE COA** (por evento: acción y enfrentamientos con tarea, unidades, % empeñado, esfuerzo principal, HPT y modificadores previstos) y varias **RED COA** (MLCOA/MDCOA, probabilidad estimada, pre-acción, reacción y despliegue por sector). |
| 4 | Confrontación | Turno a turno: Pre-acción roja → Acción azul → Reacción roja → Contrarreacción azul → Árbitro. Tres células (azul, blanca, roja) con vista filtrada por célula. La célula blanca ve el cálculo de cada enfrentamiento y las probabilidades Monte Carlo, y puede imponer resultado, bajas y modificadores. Cada turno parte del estado adjudicado del anterior. |
| 5 | Productos | Hoja de trabajo (APP-28 Anexo D), matriz de sincronización (funciones conjuntas × turnos) y matriz de apoyo a la decisión. |
| 6 | Resultados | Matriz **COA × OCOA** (P(éxito), P(todas las DC), CP final, riesgo FFIR), ponderación por probabilidad de la OCOA y peor caso; detalle por enfrentamiento con distribuciones, gráficos de potencia de combate, estado final por unidad (P10–P90), FACDS, fortalezas, debilidades, refinamientos y conclusión. |
| 7 | Datos y método | Todos los parámetros del modelo son editables: ratios mínimos, tablas de bajas, modificadores, parámetros de simulación y umbrales. |

## Cómo calcula

1. **Potencia de combate** en el punto de contacto: Σ FE × fuerza actual × % empeñado (Force Ratio Calculator Matrix, CGSC ST 100-3). Se compara sector a sector, nunca brigada contra división. Si en un sector hay varios enfrentamientos, cada uno puede indicar contra qué unidades rojas combate.
2. **Modificadores**: terreno, obstáculos, fuegos y apoyo aéreo-naval, sorpresa, moral y logística, ISR/C2/GE.
3. **Lectura doctrinal** frente a los ratios mínimos históricos de planeamiento (FM 5-0 / FM 6-0): retardo 1:6, defensa preparada 1:3, defensa precipitada 1:2,5, contraataque 1:1, ataque precipitado 2,5:1, ataque deliberado y asalto anfibio 3:1. Margen = ratio efectivo ÷ ratio mínimo, que da el resultado: decisivo, éxito, parcial o fracaso.
4. **Bajas** interpoladas en las tablas BCTP del ejemplo SIRKO. Romper el contacto a tiempo deja las bajas en la mitad aproximadamente. Las bajas rojas se concentran en el HPT designado.
5. **Incertidumbre**: simulación Monte Carlo (2.000 iteraciones por defecto) con ruido log-normal sobre ratio y bajas. Se encadenan todos los turnos y se usa una semilla fija, así que el resultado es reproducible.

Con los parámetros por defecto, el ejemplo TRYZUB reproduce los ratios del documento SIRKO: 1:2,4 (EA1), 1:3,5 (norte, T1) y 1,3:1 (contraataque de XII ARMD BDE).

## Ejemplos incluidos

- **Operation TRYZUB** (EUMAM-UA): X Assault Bde “SIRKO”, COA 1 frente a OCOA 1 (MLCOA) y OCOA 2 (MDCOA), con la confrontación de la COA 1 frente a la OCOA 1 ya registrada (notas, DP, CCIR, matriz de sincronización, DSM, FACDS y refinamientos). La **COA 2** y el despliegue por turnos de la **OCOA 2** son **ilustrativos** y no figuran en la documentación. Se incluyen para practicar la comparación.
- **Ejercicio MAR AZUL** (ficticio): asalto anfibio de una brigada de IM, con dos COA y dos OCOA. Sus FE son orientativos.

## Estructura

```
wargaming-coa/
├── index.html        Estructura y pestañas
├── css/app.css       Estilos (tema claro/oscuro, impresión)
└── js/
    ├── engine.js     Motor de adjudicación y Monte Carlo (sin dependencias)
    ├── examples.js   Escenarios de ejemplo y biblioteca de FE
    └── app.js        Interfaz
```

Para imprimir un producto, use la impresión del navegador (Ctrl+P). La hoja de estilos de impresión oculta la navegación.

## Limitaciones de esta versión

- Las unidades tienen un único valor de FE; los fuegos entran como modificador y no se cuentan por sistemas.
- El gráfico de potencia de combate muestra como máximo 8 unidades por bando.
- Los datos viven en el navegador. Exporte el JSON para conservarlos o pasarlos a otro equipo.
