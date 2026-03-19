# Dependency Injection Skill

Use this skill when working with dependency injection in this repository.

This project uses `@edo-w/tiny` for dependency injection.

## Goals

- Keep DI wiring explicit and easy to scan.
- Use typed registrations so dependencies stay safe at compile time.
- Keep object creation inside the container when DI-managed dependencies exist.

## Container Basics

- Create containers with `new Tiny()`.
- Use typed keys from `createKey<T>()` for non-class dependencies.
- Resolve dependencies with `tiny.get(...)`.
- Create child scopes with `tiny.createScope()` when scoped resolution is
  needed.

## Registration Types

Tiny supports three main registration styles:

- Class registrations.
- Factory registrations.
- Instance registrations.

## Class Registration Rules

- Register classes with `tiny.addClass(ClassType, deps)`.
- Always pass the `deps` array explicitly.
- Use `[]` for classes with no constructor dependencies.
- Use `[DepA, DepB]` in constructor order when dependencies exist.
- Keep constructor dependency order and registration dependency order aligned.

## Keys And Non-Class Dependencies

- Use `createKey<T>('name')` for config objects or other non-class values.
- Register key-based values with `addInstance(...)` or a factory method.
- Resolve key-based values with `tiny.get(KeyName)`.

## Lifetimes

Tiny supports these lifetimes:

- `transient`
- `scoped`
- `singleton`

Prefer the lifetime helper methods when they match the intent:

- `addSingletonClass(...)`
- `addScopedClass(...)`
- `addSingletonFactory(...)`
- `addScopedFactory(...)`

Choose lifetimes intentionally:

- Use `singleton` for shared process-wide services.
- Use `scoped` for request, command, or operation-bound dependencies.
- Use `transient` when a fresh instance is required each resolution.

## Factory Rules

- Use factories when object creation needs logic beyond constructor injection.
- Resolve factory dependencies through the provided Tiny container instance.
- Keep factories small and focused on assembly.

Example:

```ts
tiny.addScopedFactory(UserService, (t) => {
  return new UserService(t.get(UserRepository), t.get(Logger));
});
```

## Modules

- Use `TinyModule` for reusable registration bundles.
- Add modules to the container with `tiny.addModule(module)`.
- Prefer modules when a feature or subsystem owns several related
  registrations.
- `TinyModule` supports the same lifetime helper methods as `Tiny`.

## Property Injection

- Use `inject(ClassType)` only in property initializers.
- `inject(...)` resolves from the current container resolution context.
- Create instances through `tiny.get(...)`, not `new`, when `inject(...)` is
  involved.

## Conventions

- Prefer constructor injection for core dependencies.
- Use typed keys instead of stringly typed ad hoc lookups.
- Keep registration code centralized and predictable.
- Avoid hidden DI behavior or implicit dependency discovery.
- Keep DI setup separate from business logic.

## Validation

After changing DI wiring or container setup, run:

1. `bun run fmt`
2. `bun run lint`
3. `bun run check`
4. `bun run test`
