# TEMPLATE DIAGRAMA ARQUITECTURA MERMAID

## Uso
1. Copiar en leccion nueva o refactor de leccion existente.
2. Sustituir nombres de nodos por nombres reales de la app del modulo.
3. Mantener semantica de 4 flechas.

```mermaid
flowchart LR
  subgraph CORE[Core / Domain]
    C1[Entidad]
    C2[Servicio de dominio]
  end

  subgraph APP[Application]
    A1[Caso de uso]
    A2[Puerto]
  end

  subgraph UI[Interface]
    U1[ViewModel o Presenter]
    U2[Vista]
  end

  subgraph INFRA[Infrastructure]
    I1[API]
    I2[Persistencia]
  end

  A1 --> C1
  A1 -.-> A2
  U1 -.o A1
  A1 --o U1
  A2 -.-> I1
  A2 -.-> I2
```

## Texto de soporte sugerido
1. `-->` representa ejecucion directa en runtime.
2. `-.->` representa contrato estable entre modulo y adaptador.
3. `-.o` representa wiring/composicion desde bootstrap o capa superior.
4. `--o` representa salida de estado/resultado hacia la capa consumidora.
