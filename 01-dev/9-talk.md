# 部署用 .env.local

伺服器路徑：`/www/wwwroot/mentora.looptw.com/02-web/.env.local`

```
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_c3RlcmxpbmcteWV0aS00OS5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_SECRET_KEY=sk_test_gMGSyQqP0WVctVIchp6QcHGMiKiATf3KXUlPTapUrV
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/chat
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/chat

# PostgreSQL
DATABASE_URL=postgresql://lifementorai:xDRKhGm7wkezN2ih@57.182.129.192:5432/lifementorai

# Admin
ADMIN_USER_IDS=user_3BzZqvCCMcC4GVUbKy5l6LfUHri
```
