# GUIA DIAGRAMAS ARQUITECTURA CAPAS Y FLECHAS

Fecha: 2026-02-27

## Objetivo
Estandarizar los diagramas de arquitectura en iOS, Android y SDD para que el alumno entienda de forma consistente capas, modulos, features y tipo de acoplamiento.

## Capas canonicas
1. `Core/Domain`: reglas de negocio e invariantes.
2. `Application`: casos de uso, orquestacion y politicas.
3. `Interface`: UI, presentacion, view models/presenters.
4. `Infrastructure`: red, persistencia, frameworks, IO externo.

## Estructura visual minima
1. Cada capa debe estar contenida en un `subgraph` propio.
2. Cada feature debe estar agrupada dentro de su capa (no nodos sueltos si forman parte del mismo modulo).
3. Los boundaries entre capas deben poder leerse sin zoom extremo.
4. Toda conexion debe usar una de las 4 flechas canonicas.

## Semantica de flechas (obligatoria)
1. `-->` dependencia directa en runtime.
2. `-.->` contrato/abstraccion.
3. `-.o` wiring/configuracion/composicion.
4. `--o` salida/propagacion de resultado/evento.

## Paleta sugerida por capa
1. Core/Domain: fondo `#1E2A4A`, borde `#7EA6FF`, texto `#DCE8FF`.
2. Application: fondo `#1E3D31`, borde `#7BD9B2`, texto `#D9FBEF`.
3. Interface: fondo `#3D2A1E`, borde `#FFB870`, texto `#FFE6CC`.
4. Infrastructure: fondo `#3A1F3A`, borde `#E79AFF`, texto `#F7DEFF`.

## Paleta de flechas
1. `-->`: `#F48FB1`
2. `-.->`: `#9AB6FF`
3. `-.o`: `#B0BEC5`
4. `--o`: `#8EE6B8`

## Plantilla base Mermaid
```mermaid
flowchart LR
  classDef layerCore fill:#1E2A4A,stroke:#7EA6FF,color:#DCE8FF,stroke-width:1.5px
  classDef layerApp fill:#1E3D31,stroke:#7BD9B2,color:#D9FBEF,stroke-width:1.5px
  classDef layerUI fill:#3D2A1E,stroke:#FFB870,color:#FFE6CC,stroke-width:1.5px
  classDef layerInfra fill:#3A1F3A,stroke:#E79AFF,color:#F7DEFF,stroke-width:1.5px

  subgraph CORE[Core / Domain]
    D1[Entity]
    D2[Policy]
  end

  subgraph APP[Application]
    A1[UseCase]
    A2[Port]
  end

  subgraph UI[Interface]
    U1[ViewModel]
    U2[View]
  end

  subgraph INFRA[Infrastructure]
    I1[API Client]
    I2[DB Adapter]
  end

  A1 --> D1
  A1 -.-> A2
  U1 -.o A1
  A1 --o U1
  A2 -.-> I1
  A2 -.-> I2

  class D1,D2 layerCore
  class A1,A2 layerApp
  class U1,U2 layerUI
  class I1,I2 layerInfra

  linkStyle 0 stroke:#F48FB1,stroke-width:2px
  linkStyle 1 stroke:#9AB6FF,stroke-dasharray:5 3,stroke-width:2px
  linkStyle 2 stroke:#B0BEC5,stroke-dasharray:4 4,stroke-width:2px
  linkStyle 3 stroke:#8EE6B8,stroke-width:2px
  linkStyle 4 stroke:#9AB6FF,stroke-dasharray:5 3,stroke-width:2px
  linkStyle 5 stroke:#9AB6FF,stroke-dasharray:5 3,stroke-width:2px
```

## Checklist de publicacion
1. Usa las 4 flechas en el diagrama (o explica por que una no aplica en ese contexto).
2. Nombra capas y modulos con terminos del curso, no placeholders.
3. Evita cruces innecesarios de lineas; prioriza lectura de izquierda a derecha.
4. El diagrama debe tener explicacion textual de 4-8 lineas debajo.
5. Incluye snippet de soporte que conecte con el diagrama.
