# Demo corpus — a tiny multi-service codebase

A small, controlled "monorepo" used as the retrieval corpus


```
corpus/
  auth-service/
    AuthService.ts          # customer authentication entry point (login/logout)
    TokenManager.ts         # JWT access/refresh tokens + token refresh rotation
    PermissionValidator.ts  # RBAC — validate customer permissions
  payments-service/
    PaymentProcessor.ts     # charge customers + handle failed payments
    RefundHandler.ts        # issue full/partial refunds
    CurrencyConverter.ts    # convert money between currencies
  notifications-service/
    EmailSender.ts          # transactional email delivery with retry
    PushNotifier.ts         # mobile push notifications to devices
    TemplateRenderer.ts     # render {{placeholder}} notification templates
```

These files are intentionally simple demo stubs — not production code.
