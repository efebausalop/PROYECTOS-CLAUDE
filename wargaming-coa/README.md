# COA Wargaming Tool — v0.2

Herramienta para el **Paso 4 del planeamiento OTAN (AJP-5(A) / APP-28(B) Anexo D)**: confrontación de las líneas de acción propias (**BLUE COA**) con las del adversario obtenidas en el IPOE (**RED COA / ECOA**).

La v0.2 parte de **wargaming_nato v2 (EIMGAF)**: conserva su flujo de trabajo, su ORBAT hasta compañía, su catálogo de la Force Ratio Calculator Matrix, su tabla BCTP, la adjudicación con dados, los registros y el asistente. Sobre esa base añade:

- **Varias operaciones** en el mismo navegador, con importación y exportación en JSON. También importa las **copias JSON de wargaming_nato v2**.
- **Varias COA propias y varias COA enemigas por operación.** Cada pareja COA × ECOA tiene su propio registro de confrontación.
- **Planes por turno.** Cada COA define sus enfrentamientos (unidades del ORBAT, % empeñado, tarea, sector, HPT y modificadores) y cada ECOA su despliegue por sector. El motor los empareja automáticamente.
- **Cálculo empírico automático:**
  - equivalentes de fuerza del ORBAT × potencia actual;
  - ratio en el punto de contacto, leído frente a los ratios mínimos de planeamiento;
  - bajas interpoladas en la tabla BCTP;
  - **Monte Carlo** con semilla fija, para que los resultados sean reproducibles.
- **Confrontación turno a turno** con las tres células (azul, blanca y roja) y vista filtrada por célula. El árbitro puede imponer resultado, bajas y modificadores, y el turno siguiente parte del estado adjudicado. Se mantienen las vistas «Tarjetas» y «Hoja» de la v2.
- **Tirada del motor**: un resultado aleatorio extraído de la distribución calculada, además de los dados de la v2.
- **Análisis estadístico**: matriz COA × ECOA con P(éxito), P(todas las DC), potencia final y riesgo FFIR, resultado ponderado por la probabilidad de cada ECOA y peor caso (MDCOA). Incluye distribuciones por enfrentamiento y estado final por unidad (P10–P90).
- **Matriz de sincronización** editable (funciones × turnos), evaluación FACDS y conclusiones por pareja.
- **Interfaz en español e inglés**, con tema claro/oscuro y adaptada a móvil.

## Uso

Abra `index.html` en un navegador (Chrome, Edge o Firefox); no requiere instalación. El flujo sigue la barra lateral:

| Grupo | Sección | Contenido |
|---|---|---|
| Entradas | 1 Datos de planeamiento | Operación y escenario (sectores, fases, medidas de control), orden superior, pasos 1–3 y COA propias, estimaciones, CPG y criterios, COA enemigas con MLCOA/MDCOA y probabilidad |
| | 2 ORBAT | Árbol hasta compañía con APP-6, potencia (%) y tipo de F.E. |
| Preparación | 3 Preparación | Disposición (%), técnica, iniciativa, métodos (eventos críticos, fajas, caja, avenida), eventos críticos, DP, registro, posiciones, supuestos y CCIR |
| | 4 Planes COA / ECOA | Enfrentamientos de la COA y despliegue de la ECOA por turno, con vista previa del cálculo |
| Ejecución | Confrontación | Turno a turno (A-R-CR y tres células), tarjetas u hoja; resultado sugerido por el motor |
| | Correlación de fuerzas | Calculadora ST 100-3; puede cargar directamente un enfrentamiento del turno |
| | Adjudicación | Tirada del motor, tirada enfrentada, tirada d10 y dados |
| | Registros | NAI, TAI, HPT, HVT, DP y CCIR con referencias cruzadas |
| Resultados | Resumen y evaluación | KPI, potencia por turno, observaciones automáticas, registro, matriz de sincronización, criterios ponderados, FACDS y productos del Paso 4 |
| | Análisis estadístico | Matriz COA × ECOA y detalle de cada pareja |
| | Datos y método | Todos los parámetros del motor, editables |

## Escenarios incluidos

- **Operation TRYZUB**: la semilla íntegra de wargaming_nato v2 (ORBAT de 240 unidades, 9 turnos, registros y confrontación de la COA 1 frente a la ECOA-1). En la v0.2 se han añadido el plan de enfrentamientos de la COA 1 y el despliegue por turno de la ECOA-1 y la ECOA-2. La COA 2 queda sin plan, «a desarrollar por el sindicato», como en la v2. El turno BOX A se solapa en el tiempo con los segmentos, así que se evalúa pero no encadena bajas.
- **Operation GARNACHA**: el guion de 6 turnos (MERLOT contra 13th MID) con sus resultados, ramas, matriz de sincronización y conclusiones. Las potencias del guion (escala 1–500) se cargan como F.E. = CP/100. El despliegue por turnos de la ECOA 2 y el F.E. del contraataque del Cuerpo son interpretaciones, y así se indica en la app.
- **Ejercicio MAR AZUL**: asalto anfibio ficticio con dos COA y dos ECOA, para practicar la matriz. Sus F.E. son orientativos.

## Cómo calcula

1. **FE por unidad** = FE del tipo (CGSC ST 100-3) × cantidad × potencia actual × % empeñado. Se suma por enfrentamiento en el punto de contacto.
2. **Ratio efectivo** = FE azul ÷ FE rojo × modificadores (terreno, obstáculos, fuegos/apoyo aéreo-naval, sorpresa, moral/logística, ISR/C2/GE).
3. **Margen** = ratio efectivo ÷ ratio mínimo histórico de la tarea (FM 5-0 / FM 6-0). De él sale el resultado en 6 niveles: éxito decisivo, éxito, éxito parcial, neutral, fracaso y fracaso decisivo.
4. **Bajas** por interpolación logarítmica en la tabla BCTP según la combinación de misiones. Romper el contacto a tiempo multiplica las bajas propias por 0,5. Las bajas rojas se concentran en el HPT.
5. **Monte Carlo** (2.000 iteraciones por defecto) con ruido log-normal sobre ratio y bajas, encadenando los turnos activos.

Los fuegos se cuentan como modificador o como unidades de artillería en el enfrentamiento, no de las dos formas. Todos los parámetros se calibran en «Datos y método».

## Estructura

```
wargaming-coa/
├── index.html
├── css/app.css
└── js/
    ├── catalog.js            Catálogos de la v2: FE (ST 100-3), tabla BCTP, ratios, APP-6
    ├── engine.js             Motor de adjudicación y Monte Carlo
    ├── model.js              Modelo de datos v3 y migración desde v2
    ├── i18n.js               Traducción inglesa (añadir aquí otros idiomas)
    ├── ui-core.js            Estado, campos enlazados, navegación
    ├── ui-inputs.js          Datos, ORBAT, preparación, planes
    ├── ui-wargame.js         Confrontación, correlación, adjudicación, registros
    ├── ui-results.js         Resumen, estadística, datos y método, asistente
    └── scenarios/            TRYZUB (semilla v2 + planes), GARNACHA, MAR AZUL
```

Los datos se guardan en el navegador. Exporte el JSON para conservarlos o compartirlos. La impresión del navegador (Ctrl+P) genera una versión limpia de la sección abierta.
