# WeMarket API Reference

## Base URL
- **Production**: `https://api.wemarket.com/api`
- **Staging**: `https://staging-api.wemarket.com/api`
- **Local**: `http://localhost:3000/api`

## Authentication

All authenticated endpoints require a Bearer token:

```
Authorization: Bearer <access_token>
```

### Token Endpoints
- `POST /api/auth/login` - Login with email/phone
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/register` - Register new user
- `POST /api/auth/logout` - Invalidate refresh token

### Token Format
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

---

## Core Resources

### Stores
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stores` | List stores (with filters) |
| GET | `/stores/:id` | Get store details |
| POST | `/stores` | Create store (admin) |
| PATCH | `/stores/:id` | Update store |
| DELETE | `/stores/:id` | Delete store |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stores/:storeId/products` | List products |
| GET | `/stores/:storeId/products/:id` | Get product |
| POST | `/stores/:storeId/products` | Create product |
| PATCH | `/stores/:storeId/products/:id` | Update product |
| DELETE | `/stores/:storeId/products/:id` | Delete product |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/orders` | List orders (with filters) |
| GET | `/orders/:id` | Get order details |
| POST | `/orders` | Create order |
| PATCH | `/orders/:id/status` | Update order status |
| POST | `/orders/:id/cancel` | Cancel order |
| POST | `/orders/:id/refund` | Request refund |

### Customers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/customers` | List customers |
| GET | `/customers/:id` | Get customer |
| POST | `/customers` | Create customer |
| PATCH | `/customers/:id` | Update customer |
| GET | `/customers/:id/orders` | Customer order history |
| GET | `/customers/:id/points` | Loyalty points |

---

## AI/ML Endpoints

### Menu Analysis & Generation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/describe-menu` | Generate menu description |
| POST | `/api/ai/instagram` | Generate Instagram copy |
| POST | `/api/ai/storytelling` | Generate menu storytelling |
| POST | `/api/ai/propose-menu-full` | Full menu proposal |
| POST | `/api/ai/analyze-menu-list` | Analyze menu list |
| POST | `/api/ai/recommend-image-enhancement` | Image enhancement filters |

### Recommendations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/recommend` | Personalized menu recommendations |
| POST | `/api/ai/recommend-dessert` | Dessert pairing recommendations |
| POST | `/api/ai/recommend-pairing` | Menu pairing recommendations |
| POST | `/api/ai/tinkerbell-rec` | TinkerBell AI recommendations |

### Translation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/translate` | Translate text |
| POST | `/api/ai/translate-menu` | Batch menu translation |

### Image & OCR
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/scan-menu-image` | OCR menu image |
| POST | `/api/ai/generate-menu-image` | Generate menu image |

### Reviews & Feedback
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/generate-review-reply` | Generate review reply |

---

## AI Assistant Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai-assistant/chat` | Chat with AI assistant |
| POST | `/api/ai-assistant/translate` | Real-time translation |

---

## Menu Optimization

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/menu-optimization/store/:storeId/analysis` | Menu profitability analysis |
| GET | `/api/menu-optimization/store/:storeId/proposal` | AI set menu proposals |

---

## Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/store/:storeId/sales` | Sales analysis |
| GET | `/api/analytics/store/:storeId/products` | Popular products ranking |
| GET | `/api/analytics/store/:storeId/comparison` | Period comparison |

---

## Waiting & Reservations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/waiting/store/:storeId/status` | Store waiting status |
| POST | `/api/waiting/register` | Register for waitlist |
| PATCH | `/api/waiting/:id/status` | Update wait status |
| GET | `/api/waiting/my/:phone` | My wait status |
| GET | `/api/waiting/store/:storeId/ai-suggestions` | AI menu suggestions while waiting |

---

## Payments (Toss Payments)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/request` | Request payment |
| POST | `/api/payments/confirm` | Confirm payment |
| POST | `/api/payments/cancel` | Cancel payment |
| GET | `/api/payments/:id` | Get payment details |

---

## Health & Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Liveness probe |
| GET | `/api/health/deep` | Deep health check |
| GET | `/api/health/circuits` | Circuit breaker status |
| GET | `/api/health/sla` | SLA metrics |
| GET | `/api/ai-usage/stats` | AI usage statistics |

---

## Error Responses

All errors follow RFC 7807 format:

```json
{
  "type": "https://api.wemarket.com/errors/validation-error",
  "title": "Validation Failed",
  "status": 400,
  "detail": "Request validation failed",
  "instance": "/api/orders",
  "errors": [
    {
      "field": "storeId",
      "message": "storeId is required"
    }
  ]
}
```

### Common Status Codes
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

---

## Rate Limiting

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| AI Generation | 10-60 req/min | 60s |
| AI Chat/Recommend | 60 req/min | 60s |
| Standard API | 100 req/min | 60s |
| Auth | 10 req/min | 60s |

Headers:
- `X-RateLimit-Limit`: Max requests
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp

---

## Webhooks

### Order Events
```json
{
  "event": "order.created",
  "timestamp": "2025-01-27T10:30:00Z",
  "data": {
    "orderId": "ord_123",
    "storeId": 42,
    "amount": 15000,
    "items": [...]
  }
}
```

### Payment Events
```json
{
  "event": "payment.completed",
  "timestamp": "2025-01-27T10:30:00Z",
  "data": {
    "paymentId": "pay_123",
    "orderId": "ord_123",
    "amount": 15000,
    "method": "card"
  }
}
```

---

## SDK Examples

### JavaScript/TypeScript
```typescript
import { WeMarketClient } from '@wemarket/sdk';

const client = new WeMarketClient({
  baseUrl: 'https://api.wemarket.com/api',
  accessToken: 'your-access-token'
});

// Create order
const order = await client.orders.create({
  storeId: 42,
  items: [
    { productId: 123, quantity: 2, options: {} }
  ],
  paymentMethod: 'toss'
});

// AI Recommendation
const recommendations = await client.ai.recommend({
  storeId: 42,
  weather: 'rainy',
  mood: 'cozy'
});
```

### Python
```python
from wemarket import WeMarketClient

client = WeMarketClient(
    base_url="https://api.wemarket.com/api",
    access_token="your-access-token"
)

# Get popular products
products = client.analytics.get_popular_products(store_id=42)

# AI Translation
translated = client.ai.translate_menu(
    store_id=42,
    target_lang="en"
)
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2025-01-27 | Added AI endpoints, menu optimization, waiting AI |
| 1.1.0 | 2025-01-15 | Added analytics, menu optimization |
| 1.0.0 | 2025-01-01 | Initial release |

---

*Last Updated: 2025-01-27*  
*Version: 2.0.0*
