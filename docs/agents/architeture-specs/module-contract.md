# Module Contract Template

## Purpose

This document defines the standard template for documenting each backend module. Every module in the system must have a contract document following this structure. The contract serves as the single source of truth for the Claude Code agent to implement the module correctly and consistently.

## How to Use This Template

1. Copy this template into `docs/modules/.md`
2. Replace all `` values with module-specific content
3. Remove sections that do not apply to the module
4. Add sections if the module has unique requirements
5. Keep all sections that DO apply, even if they seem obvious — the AI agent needs explicit information

---

## Template

# Module: 

## 1. Overview

### 1.1 Name


### 1.3 Description


### 1.3 Classification

| Type | Value |
|---|---|
| Module Type |  |
| Table Prefix | `_` |
| Base Route | `/` |

### 1.4 Dependencies
- **NestJS packages**: 
- **External packages**: 
- **Internal module dependencies**: 
- **Core dependencies**: 

---

## 2. Data Schema

### 2.1 Tables

For each table in this module:

#### Table: `_`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | INT UNSIGNED | NO | AUTO_INCREMENT | Primary key |
|  |  |  |  |  |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Last update time |

**Indexes:**

| Name | Columns | Type | Description |
|---|---|---|---|
|  |  |  |  |

**Logical Foreign Keys (references to other modules' tables):**

| Column | References | Notes |
|---|---|---|
|  | ..id | Logical FK only — no physical constraint |

### 2.2 Entities (TypeORM)

List each TypeORM entity class with its key properties and decorators:

```typescript
@Entity('_')
export class  {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: '' })
  : ;
}
```

---

## 3. API Contract

### 3.1 Endpoints Overview

| Method | Path | Description | Auth Required | Cacheable |
|---|---|---|---|---|
|  | // |  | YES |  |

### 3.2 Endpoint Details

For each endpoint:

####  //

**Description:** 

**Request:**
- **Headers:**

| Header | Required | Description |
|---|---|---|
| Cookie | YES | httpOnly cookie containing access_token JWT |
| X-Cache-Key | YES | HMAC cache token for Tent cache keying |

- **Params:**

| Param | Type | Required | Description |
|---|---|---|---|
|  |  |  |  |

- **Query:**

| Query | Type | Required | Default | Description |
|---|---|---|---|---|
|  |  |  |  |  |

- **Body:**

```json
{
  "": ""
}
```

**Response:**
- **Status:** 
- **Body:**

```json
{
  "": ""
}
```

- **Error responses:**

| Status | Condition | Body |
|---|---|---|
| 400 |  | `{ "message": "", "code": "" }` |
| 401 |  | `{ "message": "Unauthorized" }` |
| 403 |  | `{ "message": "Forbidden" }` |
| 404 |  | `{ "message": "Not found" }` |

---

## 4. Events

### 4.1 Events Emitted

For each event this module publishes:

#### Event: `.`

| Property | Value |
|---|---|
| Event Name | `.` |
| Emitted When |  |
| Payload Type | `` |

**Payload:**

```typescript
class  {
  : ;
}
```

### 4.2 Events Consumed

For each event this module listens to:

#### Listens to: `.`

| Property | Value |
|---|---|
| Event Name | `.` |
| Emitted By |  module |
| Handler | `` |
| Action |  |

---

## 5. Service Interface (Exported Methods)

List the methods that this module's service exports for other modules to use via DI. Only include methods that other modules need — internal helper methods should not be listed here.

```typescript
export interface ServiceInterface {
  findById(id: number): Promise;
  (): Promise<>;
}
```

---

## 6. Business Rules

### 6.1 Validation Rules
- 
- 

### 6.2 State Transitions

If the module has entities with state/status fields, document the valid transitions:

```
 ->  (trigger: )
 ->  (trigger: )
```

### 6.3 Access Control

| Role | Permissions |
|---|---|
|  |  |

### 6.4 Constraints
- 
- 

---

## 7. Security Considerations

### 7.1 Data Sensitivity

| Field | Sensitivity | Encryption at Rest | Notes |
|---|---|---|---|
|  |  |  |  |

### 7.2 Required Guards

| Endpoint | Guard | Notes |
|---|---|---|
|  | JwtGuard | Verify access token from cookie |

### 7.3 Rate Limiting



---

## 8. Testing Requirements

### 8.1 Unit Tests
- 

### 8.2 E2E Tests
- 

### 8.3 Test Data


---

## 9. Migration Plan

### 9.1 Migration Files

| Order | Filename | Description |
|---|---|---|
| 1 | --create-.ts |  |

### 9.2 Seed Data


---

## 10. Implementation Notes

### 10.1 Module Registration

How this module is registered in `app.module.ts`:

```typescript
// For always-on modules:
@Module({
  imports: [AuthModule],
})
export class AppModule {}

// For lazy modules:
// Registered via LazyModuleLoader
const { LazyModule } = await this.lazyModuleLoader.load(
  () => import('./modules/lazy/lazy.module').then(m => m.LazyModule)
);
```

### 10.2 Environment Variables

| Variable | Description | Required | Default |
|---|---|---|---|
|  |  |  |  |

### 10.3 Known Limitations
- 
- 

### 10.4 Future Considerations
- 
- 

---

## Conventions

### Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Module name | kebab-case | `bank`, `call-log` |
| Table prefix | lowercase + underscore | `banco_`, `proto_` |
| Route prefix | kebab-case | `/banco`, `/proto` |
| Event names | dot-separated | `transaction.created` |
| Entity classes | PascalCase | `BankAccount`, `CallLog` |
| Service interfaces | PascalCase + Interface suffix | `BankServiceInterface` |
| DTO classes | PascalCase + Dto suffix | `CreateTransactionDto` |

### File Naming

| File | Convention | Example |
|---|---|---|
| Module file | `.module.ts` | `bank.module.ts` |
| Controller file | `.controller.ts` | `bank.controller.ts` |
| Service file | `.service.ts` | `bank.service.ts` |
| Entity files | `.entity.ts` | `bank-account.entity.ts` |
| DTO files | `-.dto.ts` | `create-transaction.dto.ts` |
| Event files | `.event.ts` | `transaction-created.event.ts` |
| Test files | `.spec.ts` | `bank.service.spec.ts` |

### API Conventions

- All endpoints return JSON
- All endpoints require JWT authentication (except auth endpoints themselves)
- Error responses follow the format: `{ "message": string, "code"?: string, "details"?: any }`
- Success responses return the entity/DTO directly, or a paginated result for lists
- Pagination uses query params: `?page=1&limit=20`
- List responses include: `{ "data": [...], "total": number, "page": number, "limit": number }`

### Security Conventions

- Every endpoint (except auth) requires the JwtGuard
- No endpoint returns sensitive data (passwords, tokens) in responses
- User isolation is enforced at the service level — every query filters by `userId`
- Input validation is mandatory via DTO class-validator decorators
- SQL injection prevention via TypeORM parameterized queries (never raw string concatenation)