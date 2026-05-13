# Security Specification: NexusPDF

## 1. Data Invariants
- A `Document` entry must contain a `userId`.
- Users can only read and write their own documents.
- `updatedAt` must be set to the server time.
- All fields must be properly typed and constrained in size.

## 2. The "Dirty Dozen" Payloads
1. **Spoofed Owner**: Create a document with a different `userId` than the current user.
2. **Missing Required Fields**: Create a document without `name` or `size`.
3. **Huge String Injection**: Try to inject a 10MB string into the `name` field.
4. **Invalid Type**: Send a boolean for the `size` field.
5. **Unauthorized Read**: Attempt to read a document belonging to another `userId`.
6. **Unauthorized Update**: Attempt to update another user's document.
7. **Bypassing Server Timestamp**: Send a manual string instead of `request.time` for `updatedAt`.
8. **Shadow Field Injection**: Add an `isVerified: true` field not in the schema.
9. **Invalid ID Poisoning**: Use a document ID that contains malicious characters.
10. **Terminated Record Update**: (N/A for this simple schema, but good to keep in mind).
11. **PII Leak**: (N/A currently, but `userId` is isolated by ownership).
12. **Recursive Cost Attack**: Attempt to list documents without filtering by `userId`.

## 3. Test Runner (Conceptual)
All tests would theoretically ensure `PERMISSION_DENIED` for the above scenarios.
