# TypeScript Skill

Use this skill for any TypeScript implementation in this repository.

## Goals

- Keep TypeScript strict and readable.
- Make behavior explicit instead of relying on implicit coercion or loose
  typing.
- Ensure important data shapes are validated at runtime, not only at compile
  time.

## Naming

- Use `PascalCase` for classes, types, interfaces, and enums.
- Use `camelCase` for methods, variables, and local functions.
- Use `snake_case` only for JSON payload fields, persisted contract fields, and
  DTO or model properties that intentionally mirror external contract names.
- Prefer singular, present-tense names in general to avoid ambiguity.
- Use the `noun.verb` pattern for event names in present or base form.
- Prefer `interface` for object-shaped contracts.
- Reserve `type` for unions, function aliases, mapped types, conditional types,
  and other advanced composition cases.
- End `type` aliases with a semicolon.
- When similar variables are in scope, use consistent descriptive names instead
  of mixing generic and specific names.
- Group related lines together and use blank lines to separate distinct phases
  of logic.

## Imports And Exports

- Use ESM imports and exports.
- Prefer named exports in application code.
- Prefer `export function foo(...) {}` for exported functions instead of
  `export const foo = (...) => {}` unless there is a clear reason to use a
  function expression, such as callbacks, closures, or higher-order function
  composition.
- Order imports as built-in runtime imports first, then package imports, then
  project imports.
- Keep import blocks compact with no extra blank lines between import
  statements.
- For Node built-ins, prefer namespace-style imports such as
  `import path from 'node:path'`.
- Use project subpath imports such as `#src/...` and `#test/...` instead of
  deep relative paths when available.
- Do not include file extensions like `.ts` in project subpath imports.
- Avoid circular imports between services, repos, models, and shapes.

## Data Shapes And Contracts

- Every data class or record class must have a matching Zod schema.
- Construction must validate unknown input at runtime before assignment.
- Prefer record or data classes for IO-bound contracts such as config objects,
  DTOs, models, and event payloads.
- Declare the full object shape explicitly for contract objects.
- For nullable contract fields, use `type | null` instead of optional `?` so
  the property is always present.
- Reserve optional properties for internal in-memory helper objects where
  `undefined` is the natural representation.
- Keep transport-specific shapes separate from internal feature shapes.
- When a concept exists in both persistence and transport, define separate
  classes or schemas for each layer.
- Use TypeScript `enum` for closed enum sets and pass the enum into `z.enum(...)`
  when defining the schema.
- For discriminated union result shapes that will grow over time, prefer named
  `interface` declarations for each result variant and then compose them into a
  final union `type` alias, instead of writing large inline object members
  directly inside the union.
- Prefer result variants that describe the feature or operation outcome at the
  right abstraction level. Do not make top-level result unions overly specific
  to a single sub-resource when the operation itself is broader.
- When an operation affects multiple resources, model those resources as a
  separate shared shape and attach per-resource status there, instead of
  exploding the top-level result union into one variant per resource outcome.
- All JSON data should use `snake_case`.
- Date and timestamp fields should use the `name_date` pattern.

Recommended constructor pattern:

```ts
class ExampleRecord {
  static schema = z.object({
    id: z.string(),
  });

  id!: string;

  constructor(fields: unknown) {
    const parsed = ExampleRecord.schema.parse(fields);

    Object.assign(this, parsed);
  }
}
```

## Class And Function Style

- Declare class properties with the other fields and assign them in the
  constructor.
- Avoid constructor parameter properties.
- Avoid inline collection or object initializers for class state; initialize
  them in the constructor instead.
- Keep functions focused and composable.
- Avoid `any`. If a type is unknown, narrow it deliberately.
- Exported functions and public methods should declare explicit return types.
- Prefer built-in platform types directly when they already exist instead of
  using `ReturnType<...>`.
- Use library types directly instead of recreating local minimal interfaces for
  them.
- Avoid inline object type annotations for internal helpers and local
  functions when TypeScript can infer the shape clearly.
- If an explicit object type is truly needed, define a separate `interface`
  instead of writing an inline object type annotation at the callsite or
  function signature, except in rare cases where the inline form is genuinely
  simpler.
- Do not use the broad `Function` type.
- Avoid dense inline transformations that are hard to scan.
- When mapping or conversion has real logic, assign it to a local variable
  before returning.
- Break complex callsites into intermediate variables when that improves
  readability.
- When a callsite needs non-trivial object construction before invoking another
  function, extract that constructed object into a named local variable instead
  of inlining it directly in the function call.
- Apply the same pattern to other values built alongside that call, such as
  scoped containers, so command actions remain easy to scan top to bottom.
- Do not introduce tiny generic helpers unless they remove real repetition
  without increasing abstraction cost.
- Use `Promise.allSettled(...)` by default when coordinating multiple async
  operations that should all be awaited.

## Validation

In this repository:

- `bun run lint` is the all-in-one Biome pass and covers formatting, lint
  rules, and import sorting.
- `bun run fmt` remains available when you want formatting-only cleanup without
  lint output.
- `bun run check` is the TypeScript check.

After implementing TypeScript changes, run:

1. `bun run fmt`
2. `bun run lint`
3. `bun run check`
4. `bun run test`

Do not consider the task complete until these steps have run, or any blocker
has been reported clearly.
