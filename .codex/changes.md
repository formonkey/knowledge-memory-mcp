# Changes Memory

Este archivo es la fuente de verdad de las correcciones y criterios aprendidos.
Cada entrada debe crearse a traves del MCP para mantener un formato consistente.

## Formato

Cada cambio se guarda como una seccion `##` seguida de un bloque JSON parseable.

### Ejemplo

```json
{
  "id": "CHG-EXAMPLE",
  "createdAt": "2026-08-11T00:00:00.000Z",
  "title": "Ejemplo de criterio",
  "summary": "Describe el error recurrente o la preferencia detectada.",
  "requestedChange": "Que hay que hacer a partir de ahora.",
  "rationale": "Por que se pide este cambio.",
  "kind": "anti-pattern",
  "scope": "global",
  "tags": [
    "example"
  ],
  "relatedPaths": [],
  "before": "Antes se hacia X",
  "after": "Ahora se debe hacer Y",
  "examples": [
    "No tocar componentes fuera del alcance"
  ]
}
```

## CHG-20260811-001-no-repetir-errores-ya-co | No repetir errores ya corregidos
```json
{
  "id": "CHG-20260811-001-no-repetir-errores-ya-co",
  "createdAt": "2026-08-11T08:33:22.681Z",
  "title": "No repetir errores ya corregidos",
  "summary": "Cuando se haya corregido un patron en otra conversacion, debe poder recuperarse antes de tocar codigo.",
  "requestedChange": "Consultar el MCP de cambios antes de implementar o revisar.",
  "rationale": "Reduce reincidencias entre conversaciones separadas.",
  "kind": "anti-pattern",
  "scope": "global",
  "tags": [
    "memory",
    "review",
    "agents"
  ],
  "relatedPaths": [],
  "before": "Los agentes trabajan sin conocer correcciones previas",
  "after": "Los agentes recuperan criterios relevantes al inicio",
  "examples": []
}
```


